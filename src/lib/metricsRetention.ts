/**
 * Retención por cohorte de alta.
 *
 * Las tarjetas de DAU/WAU dicen cuánta gente estuvo activa ayer; ninguna dice
 * si esa gente vuelve. Aquí se agrupa a los usuarios por el TRAMO en que se
 * dieron de alta (una semana, o un día cuando se pide grano fino) y se mide,
 * tramo a tramo contando desde su propia alta, qué parte de la cohorte seguía
 * dando señales de vida.
 *
 * Tres decisiones que conviene tener a la vista al leer la tabla:
 *
 * 1. El reloj es el de cada persona, no el del calendario. La semana 1 de
 *    quien se dio de alta un jueves va de su jueves al miércoles siguiente.
 *    La semana 0 incluye el día del alta, así que esa columna es activación
 *    ("hizo algo la primera semana"); la retención de verdad empieza en la 1.
 *
 * 2. Una celda cuyo tramo todavía no ha terminado para TODOS los miembros de
 *    la cohorte sale marcada como parcial. Solo puede subir, así que pintarla
 *    igual que una cerrada haría parecer que una cohorte fresca retiene mal.
 *
 * 3. Los hitos D1/D7/D30 son "sin techo": D7 = seguía activo el día 7 o
 *    DESPUÉS. Con tres activos al día, el conteo clásico (activo el día 7
 *    clavado) daría cero casi siempre y no diría nada. Sin techo la curva es
 *    monótona y se lee como lo que interesa: cuánta gente sigue ahí.
 */

/**
 * Filas de `UserMetric` que escribe el servidor sin que la persona toque
 * nada. Cuentan como actividad suya solo si nadie mira: un correo de ciclo
 * de vida enviado el día 12 marcaría "activo el día 12" a quien lleva desde
 * el día 2 sin abrir la app.
 */
export const SERVER_WRITTEN_METRIC_EVENTS = [
  "lifecycle_email_sent",
  "resume_story_push_sent",
  "journey_bridge_push_sent",
  "next_story_push_sent",
];

const DAY_MS = 86400000;

/** Días UTC transcurridos desde epoch. El día del alta es el índice 0. */
function utcDayIndex(date: Date): number {
  return Math.floor(date.getTime() / DAY_MS);
}

/**
 * Índice del lunes de la semana a la que pertenece ese día. El día 0 de
 * epoch (1970-01-01) fue jueves, de ahí el desplazamiento de 3.
 */
function mondayIndex(dayIndex: number): number {
  return dayIndex - ((dayIndex + 3) % 7);
}

/**
 * Primer día del tramo de alta al que pertenece ese día. En semanal es el
 * lunes; en diario, el día mismo.
 */
function bucketStart(dayIndex: number, bucketDays: number): number {
  return bucketDays === 7 ? mondayIndex(dayIndex) : dayIndex;
}

function isoDate(dayIndex: number): string {
  return new Date(dayIndex * DAY_MS).toISOString().slice(0, 10);
}

export type RetentionCell = {
  retained: number;
  pct: number;
  /** El tramo aún no ha terminado para todos los miembros de la cohorte. */
  partial: boolean;
  /**
   * Quiénes componen el porcentaje. Sin esto una celda al 33% obliga a
   * cruzar la tabla con la lista de altas a mano para saber de quién habla.
   */
  retainedIds: string[];
};

export type RetentionCohort = {
  /** Primer día (UTC) del tramo de alta, en ISO corto. */
  start: string;
  users: number;
  /** Una celda por tramo desde el alta; el índice 0 es el tramo del alta. */
  cells: RetentionCell[];
  /** Todos los de la cohorte, para poder nombrar también a quien no volvió. */
  userIds: string[];
};

export type RetentionMilestone = {
  day: number;
  /** Cuántos llevan dados de alta el tiempo suficiente para poder medirlos. */
  eligible: number;
  retained: number;
  /** null cuando nadie es elegible todavía: no es 0%, es "aún no se sabe". */
  pct: number | null;
};

export type RetentionSummary = {
  /** Ancho de cada tramo en días: 7 en la vista semanal, 1 en la diaria. */
  bucketDays: number;
  /** Cuántas columnas de tramo trae cada cohorte. */
  buckets: number;
  cohorts: RetentionCohort[];
  /** Cohortes más antiguas que se dejaron fuera por el tope de filas. */
  omittedCohorts: number;
  overall: {
    users: number;
    /** Elegibles para "volver": llevan al menos un día dados de alta. */
    returnEligible: number;
    /** Dieron señal en un día distinto al del alta. */
    returned: number;
    returnedPct: number | null;
    milestones: RetentionMilestone[];
  };
};

export type RetentionSignup = { userId: string; createdAt: Date };
export type RetentionActivity = { userId: string; createdAt: Date };

/**
 * El dia 1 sin techo seria, palabra por palabra, "volvio algun otro dia", que
 * ya sale como cifra aparte. Los hitos empiezan donde dejan de repetirla.
 */
const DEFAULT_MILESTONE_DAYS = [7, 30];

function pctOf(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

/**
 * @param signups     altas de la cohorte que se está mirando (Clerk manda).
 * @param activity    filas de actividad de esa misma gente, ya filtradas de
 *                    los eventos que escribe el servidor.
 * @param now         momento de la medición; se inyecta para poder testear.
 * @param buckets     columnas de la tabla. Se recorta a lo que el rango
 *                    seleccionado permite medir de verdad.
 * @param bucketDays  7 agrupa por semana de alta; 1, por día.
 * @param maxCohorts  tope de filas. Sobran las más viejas, no las de arriba:
 *                    en diario, 180 días de rango darían 180 filas.
 */
export function buildRetention({
  signups,
  activity,
  now,
  buckets = 5,
  bucketDays = 7,
  maxCohorts = 60,
  milestoneDays = DEFAULT_MILESTONE_DAYS,
}: {
  signups: RetentionSignup[];
  activity: RetentionActivity[];
  now: Date;
  buckets?: number;
  bucketDays?: 1 | 7;
  maxCohorts?: number;
  milestoneDays?: number[];
}): RetentionSummary {
  const width = bucketDays === 1 ? 1 : 7;
  // El techo de columnas va en días para que el diario no se dispare: doce
  // semanas de ancho, o treinta días.
  const columns = Math.max(1, Math.min(width === 1 ? 30 : 12, Math.floor(buckets)));
  const nowDay = utcDayIndex(now);

  const signupDayOf = new Map<string, number>();
  for (const s of signups) {
    const day = utcDayIndex(s.createdAt);
    const prev = signupDayOf.get(s.userId);
    // Si por lo que sea llegan dos altas del mismo id, manda la primera.
    if (prev === undefined || day < prev) signupDayOf.set(s.userId, day);
  }

  // Desplazamientos (en días desde el alta) en los que cada usuario dio señal.
  const offsetsOf = new Map<string, Set<number>>();
  for (const a of activity) {
    const signupDay = signupDayOf.get(a.userId);
    if (signupDay === undefined) continue;
    const offset = utcDayIndex(a.createdAt) - signupDay;
    // Un evento anterior al alta es ruido de reloj (o un id reutilizado);
    // no se le regala una señal de retención a nadie por eso.
    if (offset < 0) continue;
    const set = offsetsOf.get(a.userId) ?? new Set<number>();
    set.add(offset);
    offsetsOf.set(a.userId, set);
  }

  const byBucket = new Map<number, string[]>();
  for (const [userId, signupDay] of signupDayOf.entries()) {
    const key = bucketStart(signupDay, width);
    const list = byBucket.get(key) ?? [];
    list.push(userId);
    byBucket.set(key, list);
  }

  const ordered = Array.from(byBucket.entries()).sort((a, b) => b[0] - a[0]);
  const omittedCohorts = Math.max(0, ordered.length - maxCohorts);

  const cohorts: RetentionCohort[] = ordered
    .slice(0, maxCohorts)
    .map(([startDay, userIds]) => ({
      start: isoDate(startDay),
      users: userIds.length,
      userIds: [...userIds],
      cells: Array.from({ length: columns }, (_, n) => {
        const from = n * width;
        const to = from + width;
        const retainedIds: string[] = [];
        for (const userId of userIds) {
          const offsets = offsetsOf.get(userId);
          if (!offsets) continue;
          for (const offset of offsets) {
            if (offset >= from && offset < to) {
              retainedIds.push(userId);
              break;
            }
          }
        }
        // El último en darse de alta en ese tramo lo hizo, como muy tarde, el
        // último día del tramo. Su tramo n se cierra width*(n+1) días después.
        const closesOn = startDay + (width - 1) + width * (n + 1);
        return {
          retained: retainedIds.length,
          pct: pctOf(retainedIds.length, userIds.length),
          partial: nowDay < closesOn,
          retainedIds,
        };
      }),
    }));

  const users = signupDayOf.size;
  let returnEligible = 0;
  let returned = 0;
  for (const [userId, signupDay] of signupDayOf.entries()) {
    if (nowDay - signupDay < 1) continue;
    returnEligible += 1;
    const offsets = offsetsOf.get(userId);
    if (offsets && Array.from(offsets).some((o) => o >= 1)) returned += 1;
  }

  const milestones: RetentionMilestone[] = milestoneDays.map((day) => {
    let eligible = 0;
    let retained = 0;
    for (const [userId, signupDay] of signupDayOf.entries()) {
      // Sin techo: para poder decir "seguía el día N" basta con que el día N
      // haya llegado; lo que pase después cuenta a favor.
      if (nowDay - signupDay < day) continue;
      eligible += 1;
      const offsets = offsetsOf.get(userId);
      if (offsets && Array.from(offsets).some((o) => o >= day)) retained += 1;
    }
    return { day, eligible, retained, pct: eligible > 0 ? pctOf(retained, eligible) : null };
  });

  return {
    bucketDays: width,
    buckets: columns,
    cohorts,
    omittedCohorts,
    overall: {
      users,
      returnEligible,
      returned,
      returnedPct: returnEligible > 0 ? pctOf(returned, returnEligible) : null,
      milestones,
    },
  };
}
