/**
 * Retención por cohorte de alta.
 *
 * Las tarjetas de DAU/WAU dicen cuánta gente estuvo activa ayer; ninguna dice
 * si esa gente vuelve. Aquí se agrupa a los usuarios por la SEMANA en que se
 * dieron de alta y se mide, semana a semana contando desde su propia alta,
 * qué parte de la cohorte seguía dando señales de vida.
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

function isoDate(dayIndex: number): string {
  return new Date(dayIndex * DAY_MS).toISOString().slice(0, 10);
}

export type RetentionCell = {
  retained: number;
  pct: number;
  /** El tramo aún no ha terminado para todos los miembros de la cohorte. */
  partial: boolean;
};

export type RetentionCohort = {
  /** Lunes (UTC) de la semana de alta, en ISO corto. */
  weekStart: string;
  users: number;
  /** Una celda por semana desde el alta; el índice 0 es la semana del alta. */
  weeks: RetentionCell[];
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
  /** Cuántas columnas de semana trae cada cohorte. */
  weeks: number;
  cohorts: RetentionCohort[];
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
 * @param weeks       columnas de la tabla. Se recorta a lo que el rango
 *                    seleccionado permite medir de verdad.
 */
export function buildRetention({
  signups,
  activity,
  now,
  weeks = 5,
  milestoneDays = DEFAULT_MILESTONE_DAYS,
}: {
  signups: RetentionSignup[];
  activity: RetentionActivity[];
  now: Date;
  weeks?: number;
  milestoneDays?: number[];
}): RetentionSummary {
  const columns = Math.max(1, Math.min(12, Math.floor(weeks)));
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

  const byWeek = new Map<number, string[]>();
  for (const [userId, signupDay] of signupDayOf.entries()) {
    const key = mondayIndex(signupDay);
    const list = byWeek.get(key) ?? [];
    list.push(userId);
    byWeek.set(key, list);
  }

  const cohorts: RetentionCohort[] = Array.from(byWeek.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([weekStartDay, userIds]) => ({
      weekStart: isoDate(weekStartDay),
      users: userIds.length,
      weeks: Array.from({ length: columns }, (_, n) => {
        const from = n * 7;
        const to = from + 7;
        let retained = 0;
        for (const userId of userIds) {
          const offsets = offsetsOf.get(userId);
          if (!offsets) continue;
          for (const offset of offsets) {
            if (offset >= from && offset < to) {
              retained += 1;
              break;
            }
          }
        }
        // El último en darse de alta esa semana lo hizo, como muy tarde, el
        // domingo (lunes + 6). Su semana n se cierra 7*(n+1) días después.
        const closesOn = weekStartDay + 6 + 7 * (n + 1);
        return { retained, pct: pctOf(retained, userIds.length), partial: nowDay < closesOn };
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
    weeks: columns,
    cohorts,
    overall: {
      users,
      returnEligible,
      returned,
      returnedPct: returnEligible > 0 ? pctOf(returned, returnEligible) : null,
      milestones,
    },
  };
}
