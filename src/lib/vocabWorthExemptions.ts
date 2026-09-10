/**
 * EXENCIONES POR JOURNEY de `journey-vocab-worth-teaching`.
 *
 * POR QUE (decision del usuario, 2026-09-10). El check mide si cada plaza es
 * vocabulario del idioma o color local, y para eso necesita un lexico graduado
 * hasta C1. Solo existe en espanol; en cualquier otro idioma devuelve
 * `not-implemented`, que bloquea igual que un fallo. Asi ningun journey
 * portugues completo podia guardarse.
 *
 * La regla general NO cambia: fuera del espanol el check sigue bloqueando. Lo
 * que hay aqui es una lista cerrada de journeys eximidos, cada uno con su
 * motivo y con la revision plaza por plaza que la sustituye. Sin revision
 * escrita no se entra en la lista.
 *
 * Por que no se usan las listas PT que si existen (A1/A2 y B1): medidas sobre
 * el catalogo, marcan palabras corrientes (cair, cuidado, geladeira, sorriso),
 * y el Traveler PT publicado saldria con 6,57 plazas "de color" por historia.
 * Calibrar un tope contra eso no mediria nada.
 */
export const EXENCION_UTILIDAD: Record<string, { motivo: string; revision: string }> = {
  cmtvpqsfv000832hgemzk20cl: {
    motivo:
      "Traveler PT-BR A0: PT no tiene lexico graduado hasta C1, y las listas A1/A2 y B1 marcan palabras corrientes. " +
      "Las 83 plazas que marcan se revisaron una a una (62 se ensenan, 17 anclas culturales, 4 cambiadas).",
    revision: "src/lib/vocabWorthReview.pt-a0.json",
  },
};

/** El motivo de la exencion de este journey, o null si no esta eximido. */
export function exencionUtilidad(journeyId: string | null | undefined): string | null {
  const e = journeyId ? EXENCION_UTILIDAD[journeyId] : undefined;
  return e ? `${e.motivo} Revision: ${e.revision}` : null;
}
