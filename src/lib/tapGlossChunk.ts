/**
 * Si el trozo de contexto de una glosa (`TapGloss.c.es`) cubre la ocurrencia
 * que el lector ha tocado.
 *
 * La capa de contexto guarda UN trozo por palabra e historia, escrito para una
 * sola de sus apariciones. En "los-aguanto-de-dos-en-dos" `dejó` sale dos veces
 * y el trozo es "él dejó caer una frase mansa": al tocar "dejó el doble de
 * propina" la tarjeta enseñaba la frase de la otra (Ty, 2026-09-15; Andre,
 * 2026-09-20). Medido el 2026-09-20: 18 836 de 95 010 trozos tienen otra
 * aparición en una frase que no los contiene.
 *
 * Hasta que la capa lleve un trozo por ocurrencia, la tarjeta comprueba aquí
 * que el trozo está en el texto tocado y, si se sabe DÓNDE se tocó, que lo
 * cubre. Si no, no lo enseña y vuelve a la glosa de la palabra suelta.
 */

const fold = (s: string) =>
  s.normalize("NFC").toLowerCase().replace(/[’‘]/g, "'").replace(/[“”«»]/g, '"');

export function chunkCoversTap(
  chunkEs: string,
  context: string | undefined,
  at?: number,
  length?: number
): boolean {
  if (!context) return false;
  const chunk = fold(chunkEs).trim();
  const ctx = fold(context);
  if (!chunk) return false;
  if (at === undefined || length === undefined || ctx.length !== context.length) {
    return ctx.includes(chunk);
  }
  let from = 0;
  for (;;) {
    const i = ctx.indexOf(chunk, from);
    if (i < 0) return false;
    if (i <= at && i + chunk.length >= at + length) return true;
    from = i + 1;
  }
}
