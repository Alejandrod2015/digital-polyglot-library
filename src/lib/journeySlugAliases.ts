/**
 * Slugs de journey que dejaron de existir, apuntando al journey que los tenía.
 *
 * El slug lleva el nivel (`es-friends-spain-a0`), así que al subir un nivel un
 * journey cambia de slug y los enlaces que ya se compartieron dejaban de
 * resolver: la página caía al journey por preferencias sin redirigir, y la
 * previsualización mostraba la metadata genérica.
 *
 * El 2026-09-10 se subieron de nivel los journeys cuyo contenido medía por
 * encima de su etiqueta (el A0 de España, México e Italia era un A1). Estos son
 * los tres que estaban publicados; los draft no tenían enlaces públicos.
 */
export const LEGACY_JOURNEY_SLUGS: Readonly<Record<string, string>> = {
  "es-friends-spain-a0": "cmrr5hnbl000032k1esry5n8g",
  "es-traveler-mexico-a0": "cmrrqjd2n000032nvnp2tryzg",
  "it-traveler-italy-a0": "cmss0fkc40007j8dub1zpa1kc",
};

export function journeyIdForLegacySlug(slug: string | null | undefined): string | null {
  if (!slug) return null;
  return LEGACY_JOURNEY_SLUGS[slug.trim().toLowerCase()] ?? null;
}
