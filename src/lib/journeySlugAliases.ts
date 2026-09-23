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
  // 2026-09-19: split de la variante "latam" en "latam"/"latam-multi"/pais
  // (TAXONOMIA_variantes_latam). Estos 6 journeys cambian Journey.variant de
  // "latam" a "latam-multi", lo que cambia su slug publico
  // (es-traveler-latam-a0 -> es-traveler-latam-multi-a0). Sin estos alias,
  // cualquier enlace compartido o indexado con el slug viejo queda huerfano.
  "es-traveler-latam-a0": "cmqrtaj1p000032qtda86z6um",
  "es-traveler-latam-a1": "cmt5vxwgd0007324oesy195k8",
  "es-traveler-latam-a2": "cmtgelq560007j84n3ujx9bpd",
  "es-traveler-latam-b1": "cmtmylg7k0007321h6t7njesx",
  "es-traveler-latam-b2": "cmtpls1l20007j8epwgcs6e1h",
  "es-friends-latam-c1": "cmrdqk484000032r4rt2vw4ej",
};

export function journeyIdForLegacySlug(slug: string | null | undefined): string | null {
  if (!slug) return null;
  return LEGACY_JOURNEY_SLUGS[slug.trim().toLowerCase()] ?? null;
}
