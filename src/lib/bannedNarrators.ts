/**
 * VOCES VETADAS COMO NARRADOR. Una voz puede estar aprobada para produccion y
 * aun asi no servir para llevar una historia entera: la aprobacion dice que el
 * usuario la acepto, no que valga para cada papel.
 *
 * Esta lista solo QUITA permisos, nunca los da, asi que vive fuera de
 * `approvedVoices.ts` (que solo edita el usuario, con su frase de aprobacion).
 * Anadir una fila aqui es siempre mas restrictivo; para levantar un veto, lo
 * dice el usuario y se borra la fila.
 *
 * Se comprueba en el chokepoint de narracion, no al elegir el mapa de voces:
 * los mapas por tema estan repartidos por `scripts/` y cualquiera de ellos
 * podria saltarselo.
 */
export const NARRADORES_VETADOS: Record<string, string> = {
  zwsW3KvGYEC2nBc7rlnA:
    "Narrator CL - Carlos (chilena, m). Vetada como narrador por el usuario el 2026-09-09, " +
    "al elegir voz chilena para el tema 4 del B1 latam. Sus 3 historias viven en un journey " +
    "archivado, asi que el veto no deja deuda que arrastrar.",
};

export function esNarradorVetado(voiceId: string | null | undefined): boolean {
  return !!voiceId && voiceId in NARRADORES_VETADOS;
}

export function assertNarradorPermitido(voiceId: string | null | undefined, contexto = ""): void {
  if (!esNarradorVetado(voiceId)) return;
  throw new Error(
    `VOZ VETADA COMO NARRADOR: ${voiceId}${contexto ? ` (${contexto})` : ""}. ` +
    `${NARRADORES_VETADOS[voiceId as string]} ` +
    `Si el veto ya no vale, lo levanta el usuario y se borra la fila de src/lib/bannedNarrators.ts.`
  );
}
