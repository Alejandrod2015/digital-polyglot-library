// /src/data/shopifybundles.ts
/**
 * Mapa SKU de Shopify → slug(s) de libro en el catálogo del reader.
 *
 * El webhook (src/app/api/shopify/webhook/route.ts) toma el SKU de cada line
 * item; si está aquí, lo expande a los slugs mapeados; si no, usa el SKU crudo
 * como slug. Un guard posterior (getCatalogBookMeta) solo concede acceso si el
 * slug EXISTE en el catálogo, así que un SKU que no resuelve se ignora en
 * silencio (el comprador no recibe nada).
 *
 * Por eso hay que mapear aquí todo SKU cuyo valor NO coincida exactamente con
 * el slug del catálogo. Formato:
 *   "shopify-variant-sku": ["catalog-book-slug", ...],
 */

export const shopifybundles: Record<string, string[]> = {
  // Mexican Wonders "Paperback + Audiobook": el SKU no coincide con el slug del
  // catálogo (spanish-short-stories-on-20-mexican-wonders), así que sin este
  // mapa el guard lo saltaba y el comprador del +€5 audio no recibía acceso.
  "short-stories-mx-wonders-paperback-audio": [
    "spanish-short-stories-on-20-mexican-wonders",
  ],

  // Colombian "Paperback + Audiobook": el SKU YA coincide con el slug del
  // catálogo (funcionaba por coincidencia). Se mapea explícito para dejarlo
  // documentado y a prueba de futuros cambios de slug.
  "short-stories-in-colombian-spanish": ["short-stories-in-colombian-spanish"],
};

export default shopifybundles;
