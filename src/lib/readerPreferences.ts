/**
 * Preferencias de lectura que viajan en la metadata del usuario, compartidas
 * entre el cliente móvil y la ruta que las persiste, para que ambos lados
 * interpreten el campo igual.
 */

/**
 * Resaltado palabra a palabra durante el audio.
 *
 * Ausente o cualquier cosa que no sea `false` = ACTIVADO. Es deliberado: el
 * campo aparece hoy, y todas las cuentas que ya existen lo tienen ausente. Si
 * el defecto fuera "apagado", estrenar la preferencia le quitaría el karaoke a
 * todo el mundo sin que nadie lo haya pedido. Solo un `false` explícito, es
 * decir alguien que fue a ajustes y lo apagó, desactiva.
 */
export function normalizeKaraokeEnabled(value: unknown): boolean {
  return value === false ? false : true;
}
