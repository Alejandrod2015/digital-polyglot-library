/**
 * Setting geográfico (StorySetting) por slug de historia. Sirve a la
 * Capa 2 de reglas voz-región: cuando el casting UI necesita saber
 * "qué accent debería sonar en esta historia", consulta este mapa.
 *
 * Cuando la migration `dialect/heritage metadata` (commit 786a571)
 * se despliegue, este archivo se reemplaza por una lectura de
 * `JourneyStory.culturalTags` y se borra. Mientras tanto, registro
 * manual por slug.
 *
 * Reglas para agregar entries:
 *  - El slug es el `JourneyStory.slug` exacto en DB.
 *  - El setting refleja DÓNDE pasa la historia, no el origen del
 *    narrador. "Carnitas en Coyoacán" ambienta en CDMX → "mexico".
 *  - Si la historia es genérica/sin setting fijo, NO la agregues —
 *    `inferStorySetting` cae al fallback por (language, variant).
 */

import type { StorySetting } from "./voiceAccentCompat";

export const STORY_SETTING_BY_SLUG: Record<string, StorySetting> = {
  // Spanish dialogue stories activas en producción.
  "carnitas-en-coyoacan": "mexico",
  "tinto-en-la-candelaria": "colombia",

  // German dialogue stories activas en producción.
  "cafe-in-kreuzberg": "germany",
  "beim-baecker": "germany",
  "tomaten": "germany",
  "eiscafe-am-sommerabend": "germany",

  // Italian dialogue stories activas en producción.
  "oltrarno-bistecca-fiorentina-9": "italy-florence",
};

/**
 * Devuelve el StorySetting que el casting debería usar para una
 * historia. Prefiere el override por slug; si no, infiere por
 * (language, variant) del journey. Devuelve null si ni siquiera la
 * inferencia funciona — el caller debería tratarlo como "unknown" y
 * no aplicar restricciones de compat.
 */
export function inferStorySetting(args: {
  slug?: string | null;
  language: string;
  variant: string | null;
}): StorySetting | null {
  if (args.slug) {
    const explicit = STORY_SETTING_BY_SLUG[args.slug];
    if (explicit) return explicit;
  }

  const lang = args.language.trim().toLowerCase();
  const variant = (args.variant ?? "").trim().toLowerCase();

  if (lang === "spanish") {
    if (variant === "spain") return "spain";
    if (variant === "latam") return "latam-generic";
    return null;
  }
  if (lang === "portuguese") {
    if (variant === "brazil") return "brazil-paulista";
    if (variant === "portugal") return "portugal";
    return null;
  }
  if (lang === "italian") return "italy-generic";
  if (lang === "german") {
    if (variant === "austria") return "austria";
    return "germany";
  }
  if (lang === "english") {
    if (variant === "uk") return "uk-generic";
    return "us-generic";
  }
  return null;
}
