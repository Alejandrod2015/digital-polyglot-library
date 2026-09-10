/**
 * Banda de palabras del cuerpo por nivel, copiada de docs/story-quality-spec.md
 * ("Criterios por nivel", 2026-08-19). Si el spec cambia, cambia aqui: el gate
 * `body-word-count` de validateGeneratedStory la lee de este fichero.
 *
 * Todas son un minuto de audio. Maia narra el B1 de Espana a 137 palabras por
 * minuto y los narradores del B1 latam a 157; 190 palabras dan 72-81 s.
 */
export const BANDA_PALABRAS_SPEC: Record<string, [number, number]> = {
  A0: [128, 155],
  A1: [128, 155],
  A2: [128, 155],
  B1: [140, 166],
  B2: [140, 166],
  C1: [150, 177],
  C2: [150, 177],
};
