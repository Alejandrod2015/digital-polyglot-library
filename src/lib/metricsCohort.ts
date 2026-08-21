import { prisma } from "@/lib/prisma";

/**
 * Quién produjo cada número del dashboard. Hasta ahora /studio/metrics
 * sumaba en el mismo bote a los beta testers del móvil y a la gente que
 * llegó por la web (compradores de libros y altas libres), que son dos
 * poblaciones con comportamientos distintos: al tester se le regaló
 * premium, así que nunca pasa por el checkout y hunde el funnel de pago
 * sin haberlo visto siquiera.
 *
 * El eje es la PERSONA, no la plataforma del evento: un tester que además
 * abre el lector web sigue siendo feedback de beta y no demanda de
 * mercado. `metadata.platform` (ios / android / web) queda como corte
 * secundario dentro de cada cohorte.
 *
 * Las tres opciones son exhaustivas y excluyentes. "public" es todo el que
 * no está en el programa, compre o no: el desglose comprador vs alta libre
 * vive en la tabla de Audiencia, no aquí.
 */
export type MetricsCohort = "all" | "beta" | "public";

export function parseMetricsCohort(raw: string | null | undefined): MetricsCohort {
  const value = raw?.trim().toLowerCase();
  if (value === "beta") return "beta";
  if (value === "public") return "public";
  return "all";
}

/**
 * Estados que ocupan plaza de tester, los mismos que `ACTIVE_STATUSES` en
 * `src/lib/betaProgram.ts`. Quien está en lista de espera o sin decidir NO
 * es beta: hoy ninguno tiene cuenta, pero el día que la tenga contaría como
 * tester sin serlo.
 */
const BETA_ACTIVE_STATUSES = ["invited", "accepted"];

const BETA_IDS_TTL_MS = 5 * 60 * 1000;
let betaIdsCache: { ids: string[]; loadedAt: number } | null = null;

/**
 * Los Clerk userIds del programa de beta, cacheados 5 minutos igual que la
 * lista de internos.
 *
 * Sale de una sola consulta a la base y no le pregunta a Clerk, a propósito.
 * `clerkUserId` se rellena solo: al abrir sesión, `reconcileBetaTesterLink`
 * enlaza la fila, y el panel de beta del Studio repara con `backfill` a
 * quien se quedara atrás. Una fila `invited` sin enlazar es alguien que
 * todavía no entró, y quien no entró no emite un solo evento, así que no hay
 * nada que cruzar por correo. Además así el filtro también funciona en
 * local, donde Clerk es la instancia de desarrollo y un cruce por email no
 * encontraría a nadie.
 */
export async function getBetaUserIds(): Promise<string[]> {
  if (betaIdsCache && Date.now() - betaIdsCache.loadedAt < BETA_IDS_TTL_MS) {
    return betaIdsCache.ids;
  }
  const rows = await prisma.betaSignup.findMany({
    where: { clerkUserId: { not: null }, status: { in: BETA_ACTIVE_STATUSES } },
    select: { clerkUserId: true },
  });
  const ids = Array.from(
    new Set(rows.map((r) => r.clerkUserId).filter((id): id is string => Boolean(id))),
  );
  betaIdsCache = { ids, loadedAt: Date.now() };
  return ids;
}

/** Filtro de `userId` listo para spreadear en cualquier `where`. */
export type MetricsUserScope = { userId?: { in?: string[]; notIn?: string[] } };

/**
 * UN solo filtro de usuario, que junta la exclusión del equipo interno y la
 * cohorte elegida.
 *
 * CUIDADO al usarlo: se spreadea (`...userScope`) en decenas de `where`, y
 * poner una segunda clave `userId` al lado lo machacaría en silencio (en un
 * objeto literal gana la última), devolviendo al dashboard el tráfico
 * interno que llevamos meses excluyendo. Si necesitas filtrar por usuario
 * además de esto, cómponlo aquí dentro.
 *
 * Un `in: []` significa cero filas y se devuelve tal cual: colapsarlo a `{}`
 * (el idioma que usa la exclusión de internos cuando la lista está vacía)
 * convertiría "beta sin nadie enlazado" en "todo el mundo".
 */
export async function buildMetricsUserScope(
  cohort: MetricsCohort,
  internalIds: string[],
): Promise<MetricsUserScope> {
  if (cohort === "all") {
    return internalIds.length > 0 ? { userId: { notIn: internalIds } } : {};
  }
  const betaIds = await getBetaUserIds();
  if (cohort === "beta") {
    const internal = new Set(internalIds);
    return { userId: { in: betaIds.filter((id) => !internal.has(id)) } };
  }
  const excluded = Array.from(new Set([...internalIds, ...betaIds]));
  return excluded.length > 0 ? { userId: { notIn: excluded } } : {};
}

/** Etiqueta para cabeceras y avisos. */
export function metricsCohortLabel(cohort: MetricsCohort): string {
  if (cohort === "beta") return "Beta";
  if (cohort === "public") return "Público";
  return "Todos";
}
