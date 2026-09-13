// Puente entre journeys: cuál es el siguiente de un journey dado.
//
// Antes el puente era SOLO el puntero `Journey.nextJourneyId`, y ese puntero lo
// escribía a mano quien creaba o publicaba el journey siguiente. Se olvidaba:
// el 2026-09-13 el Traveler PT-BR A2 y el Traveler ES latam A1 no apuntaban a
// nada aunque su siguiente nivel estaba publicado, así que quien terminaba no
// veía por dónde seguir y el aviso del día siguiente nunca salía.
//
// Ahora el puente se DERIVA: mismo tipo, misma lengua, misma variante y el
// nivel inmediatamente superior. El puntero sigue mandando cuando existe (es
// la forma de fijar a propósito un siguiente distinto), pero ya no hace falta
// escribirlo para que el puente exista.
//
// Solo el nivel CONTIGUO: un A1 no salta a un C1 aunque no haya nada en medio.
// Un hueco en la escalera se arregla creando el nivel que falta, no enviando
// al lector dos niveles arriba.

export const LEVEL_LADDER = ["a0", "a1", "a2", "b1", "b2", "c1", "c2"] as const;

export type ChainJourney = {
  id: string;
  typeSlug: string | null;
  language: string;
  variant: string;
  levels: string[];
  status: string;
  nextJourneyId: string | null;
};

export type NextJourneySource = "pointer" | "derived";

function firstLevel(journey: Pick<ChainJourney, "levels">): string {
  return (journey.levels[0] ?? "").trim().toLowerCase();
}

export function nextLevel(level: string): string | null {
  const index = LEVEL_LADDER.indexOf(level.trim().toLowerCase() as (typeof LEVEL_LADDER)[number]);
  if (index < 0 || index === LEVEL_LADDER.length - 1) return null;
  return LEVEL_LADDER[index + 1];
}

/**
 * Siguiente journey de `from` dentro de `journeys`. Devuelve el destino aunque
 * no esté publicado: filtrar por estado es cosa de quien lo pinta o lo avisa.
 * Al derivar, sin embargo, se prefiere uno publicado si hay varios candidatos,
 * y los archivados nunca cuentan.
 */
export function resolveNextJourney<T extends ChainJourney>(
  from: T,
  journeys: readonly T[],
): { journey: T; source: NextJourneySource } | null {
  if (from.nextJourneyId) {
    const pointed = journeys.find((j) => j.id === from.nextJourneyId);
    if (pointed && pointed.status !== "archived") return { journey: pointed, source: "pointer" };
  }

  if (!from.typeSlug) return null;
  const wanted = nextLevel(firstLevel(from));
  if (!wanted) return null;

  const candidates = journeys
    .filter(
      (j) =>
        j.id !== from.id &&
        j.status !== "archived" &&
        j.typeSlug === from.typeSlug &&
        j.language.toLowerCase() === from.language.toLowerCase() &&
        j.variant === from.variant &&
        firstLevel(j) === wanted,
    )
    .sort((a, b) => Number(b.status === "active") - Number(a.status === "active") || a.id.localeCompare(b.id));

  return candidates[0] ? { journey: candidates[0], source: "derived" } : null;
}
