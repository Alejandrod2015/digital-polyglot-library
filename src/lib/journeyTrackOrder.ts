import { JOURNEY_LEVEL_IDS, normalizeJourneyPlacementLevel } from "@/lib/journeyUnlock";

/**
 * Lo mínimo que hace falta de un track para ordenarlo. Deliberadamente
 * estructural y no `JourneyVariantTrack`, para que el test pueda construir
 * casos a mano sin fabricar 21 historias.
 */
export type OrderableTrack = {
  label: string;
  variant: string | null;
  levels: ReadonlyArray<{ id: string }>;
};

/**
 * El nivel con el que se decide DÓNDE aterriza el alumno.
 *
 * `journeyPlacementLevel` solo lo guarda el onboarding móvil. Quien hizo el
 * onboarding en web se queda sin él para siempre, y sin placement el orden por
 * defecto lo manda al A0 aunque se declarara Intermediate: Mike (beta PT,
 * 2026-09-09) leyó el Traveler brasileño A0 con un A1 publicado encima y
 * escribió que le quedaba "a little bit above my level" (sic).
 *
 * De reserva se usa `preferredLevel`, que sí existe en esas cuentas. Beginner
 * NO mueve nada: ese cubo junta "Brand new" (A0) y "A few words" (A1), y
 * subirlo al A1 le quitaría el suelo a quien empieza de cero.
 */
export function placementForLanding(
  journeyPlacementLevel: unknown,
  preferredLevel: unknown
): string | null {
  const placement = normalizeJourneyPlacementLevel(journeyPlacementLevel);
  if (placement) return placement;
  const coarse = typeof preferredLevel === "string" ? preferredLevel.trim().toLowerCase() : "";
  // Un peldano por debajo de lo que dice el cubo (usuario, 2026-09-20): las
  // historias narradas piden mas que el nivel que uno se atribuye, y el de
  // arriba esta a un toque. Intermediate aterriza en A2 y Advanced en B2.
  if (coarse === "intermediate") return "a2";
  if (coarse === "advanced") return "b2";
  return null;
}

/**
 * Ordena los tracks que se le sirven a un alumno poniendo PRIMERO el que le
 * toca por nivel.
 *
 * Existe porque el cliente móvil (todo build <= 314) no mira el nivel de nadie:
 * coge el primer track cuya variante casa y, si no tiene variante guardada, el
 * primero de la lista a secas. El orden que manda el servidor ES la decisión de
 * nivel para todas las apps ya instaladas, así que se decide aquí, que es el
 * único sitio que conoce el placement.
 *
 * Criterios, en orden:
 *  1. Distancia al placement.
 *  2. A igual distancia, su variante EXACTA. El pool de LATAM mete "latam",
 *     "mexico" y "colombia" en la misma bolsa a propósito, y eso vale para
 *     decidir qué se le OFRECE, no en cuál aterriza.
 *  3. A igual distancia, el nivel de ABAJO. Una historia un punto por debajo se
 *     lee entera; una por encima se abandona.
 *  4. El label, para que el orden sea estable.
 *
 * Sin placement no se toca nada: se devuelve el mismo array, que ya viene
 * ascendente por nivel de `buildJourneyVariants`.
 */
export function orderTracksByPlacement<T extends OrderableTrack>(
  tracks: ReadonlyArray<T>,
  placementLevel: string | null | undefined,
  learnerVariant: string | null | undefined
): T[] {
  const placementRank = (JOURNEY_LEVEL_IDS as readonly string[]).indexOf(
    normalizeJourneyPlacementLevel(placementLevel) ?? ""
  );
  if (placementRank < 0) return [...tracks];

  const wantedVariant = (learnerVariant ?? "").trim().toLowerCase();
  const exactVariantRank = (track: T) =>
    wantedVariant && (track.variant ?? "").trim().toLowerCase() === wantedVariant ? 0 : 1;

  const distanceToPlacement = (track: T) => {
    let best = { distance: Number.MAX_SAFE_INTEGER, above: 1 };
    for (const level of track.levels) {
      const rank = (JOURNEY_LEVEL_IDS as readonly string[]).indexOf(level.id.trim().toLowerCase());
      if (rank < 0) continue;
      const candidate = {
        distance: Math.abs(rank - placementRank),
        above: rank > placementRank ? 1 : 0,
      };
      if (
        candidate.distance < best.distance ||
        (candidate.distance === best.distance && candidate.above < best.above)
      ) {
        best = candidate;
      }
    }
    return best;
  };

  return [...tracks].sort((a, b) => {
    const da = distanceToPlacement(a);
    const db = distanceToPlacement(b);
    return (
      da.distance - db.distance ||
      exactVariantRank(a) - exactVariantRank(b) ||
      da.above - db.above ||
      a.label.localeCompare(b.label)
    );
  });
}
