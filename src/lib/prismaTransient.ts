// Clasificador de errores transitorios de Prisma/Neon. Vive fuera de
// src/lib/prisma.ts (que es `server-only`) para poder ejercitarlo sin
// arrancar Next.

/**
 * Errores transitorios típicos cuando Neon + pgbouncer cierra una
 * conexión idle mid-query (serverless cold/warm cycle). El engine
 * reporta una "response empty" o termina la conexión. Reintentar la
 * misma query suele resolverlo porque Prisma abre nueva conexión.
 */
const TRANSIENT_ERROR_PATTERNS: RegExp[] = [
  /Response from the Engine was empty/i,
  /Engine is not yet connected/i,
  /Engine is not yet started/i,
  /Closed Connection/i,
  /Connection terminated/i,
  /Connection refused/i,
  /Connection reset by peer/i,
  /ECONNRESET/i,
  /server has gone away/i,
  // Neon suspende el compute cuando no hay tráfico; el primer intento
  // tras el idle llega antes de que despierte (2026-07-28: 2 de cada 3
  // arranques en frío). Prisma lo reporta como P1001.
  /Can't reach database server/i,
  /Timed out fetching a new connection/i,
];

/**
 * Códigos de PrismaClientInitializationError que SÍ se reintentan: la
 * base no está accesible todavía. Deliberadamente fuera: P1000 (auth
 * inválida), P1003 (la base no existe) y demás errores determinísticos,
 * donde reintentar solo retrasa el fallo real.
 */
const RETRYABLE_INIT_CODES: ReadonlySet<string> = new Set([
  "P1001", // Can't reach database server
  "P1002", // Server reached but timed out
  "P1008", // Operations timed out
  "P1017", // Server has closed the connection
]);

/**
 * Mensajes de "la base no está accesible (todavía)". Se comprueban además
 * del código porque Prisma envuelve el error de inicialización dentro del
 * de invocación ("Invalid `prisma.x.findMany()` invocation…") y en ese
 * camino `err.code` llega `undefined` (verificado provocando un P1001 real
 * contra un host muerto, 2026-07-28).
 */
const UNREACHABLE_PATTERNS: RegExp[] = [
  /Can't reach database server/i,
  /Timed out fetching a new connection/i,
  /Server has closed the connection/i,
];

/** Error de arranque/conexión: merece un backoff más largo (Neon tarda en despertar). */
export function isConnectionInitError(err: unknown): boolean {
  const code = (err as { code?: unknown } | null)?.code;
  if (typeof code === "string" && RETRYABLE_INIT_CODES.has(code)) return true;
  const message = err instanceof Error ? err.message : "";
  // Ojo: P1000 (auth) y P1003 (base inexistente) también son
  // PrismaClientInitializationError, pero sus mensajes NO casan aquí, así
  // que siguen fallando rápido en vez de reintentar.
  return UNREACHABLE_PATTERNS.some((re) => re.test(message));
}

export function isTransientError(err: unknown): boolean {
  if (!err) return false;
  if (isConnectionInitError(err)) return true;
  // PrismaClientUnknownRequestError = el engine devolvió un error sin
  // código conocido. En la práctica es casi siempre transitorio: el
  // pooler de Neon (pgbouncer) corta/recicla conexiones bajo
  // concurrencia y la query cae con un error opaco. Reintentar suele
  // aterrizar en una conexión fresca y resolver. Los errores
  // determinísticos (constraint, validación) son KnownRequestError /
  // ValidationError, otra clase, así que no entran aquí.
  const name = err instanceof Error ? err.name : "";
  if (name === "PrismaClientUnknownRequestError") return true;
  const message =
    err instanceof Error ? err.message : typeof err === "string" ? err : String(err);
  return TRANSIENT_ERROR_PATTERNS.some((re) => re.test(message));
}

/**
 * Backoff por intento. Los fallos de conexión arrancan más arriba
 * porque despertar un compute de Neon tarda segundos, no milisegundos:
 * 500ms → 1s → 2s → 4s (~7,5s en total) frente a 200ms → 1,6s (~3s).
 */
export function retryDelayMs(attempt: number, err: unknown): number {
  const base = isConnectionInitError(err) ? 500 : 200;
  return base * Math.pow(2, attempt);
}
