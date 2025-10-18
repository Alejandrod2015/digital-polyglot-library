// /src/data/shopifybundles.ts
/**
 * 🛑 MODO SANDBOX / PAUSADO
 * 
 * Este archivo está vacío intencionalmente mientras no haya libros activos en Sanity.
 * 
 * Si un usuario realiza una compra en Shopify durante este modo,
 * el webhook no encontrará ningún bundle asociado y no enviará ningún correo.
 * 
 * Cuando se publiquen libros reales en la plataforma,
 * restaura aquí los bundles correspondientes en el formato:
 * 
 *   "bundle-handle": ["book-slug-1", "book-slug-2", ...],
 */

export const shopifybundles: Record<string, string[]> = {

"colombian-spanish-essentials": [
   "colombian-spanish-phrasebook",
   "short-stories-in-colombian-spanish",
 ],


};

export default shopifybundles;
