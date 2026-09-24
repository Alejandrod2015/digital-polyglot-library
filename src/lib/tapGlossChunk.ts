/**
 * El trozo de contexto de una glosa (`TapGloss.c`) y los de sus otras
 * apariciones (`TapGloss.cs`), y cuál de ellos describe la ocurrencia que el
 * lector ha tocado.
 *
 * La capa de contexto nació con UN trozo por palabra e historia, escrito para
 * una sola de sus apariciones. En "los-aguanto-de-dos-en-dos" `dejó` sale dos
 * veces y el trozo es "él dejó caer una frase mansa": al tocar "dejó el doble
 * de propina" la tarjeta enseñaba la frase de la otra (Ty, 2026-09-15; Andre,
 * 2026-09-20). Medido el 2026-09-20: 18 836 de 95 010 trozos tenían otra
 * aparición en una frase que no los contiene.
 *
 * Desde entonces una entrada lleva `c` (la primera aparición, que las apps ya
 * publicadas leen) y `cs` (las demás). La tarjeta no elige por índice: elige
 * el trozo que CUBRE la posición tocada dentro del bloque, así que los tres
 * lados (autoría, web, móvil) no tienen que ponerse de acuerdo en cómo se
 * cuentan las palabras, y un trozo que ya no casa con el texto simplemente
 * no sale (y lo canta `scripts/checkGlossOccurrences.ts`).
 */

export type GlossChunk = { es: string; en: string };

export const foldGlossText = (s: string) =>
  s.normalize("NFC").toLowerCase().replace(/[’‘]/g, "'").replace(/[“”«»]/g, '"');

/** Si `chunkEs` cubre la posición `at` (de `length` caracteres) dentro de
 *  `context`. Sin posición, basta con que esté en el contexto. */
export function chunkCoversTap(
  chunkEs: string,
  context: string | undefined,
  at?: number,
  length?: number
): boolean {
  if (!context) return false;
  // Un verbo separable se anota con puntos suspensivos entre sus dos mitades
  // ("holt … ab"): las partes tienen que aparecer en orden, no pegadas.
  const parts = foldGlossText(chunkEs).split(/…|\.\.\./).map((t) => t.trim()).filter(Boolean);
  const ctx = foldGlossText(context);
  if (!parts.length) return false;
  const conPosicion = at !== undefined && length !== undefined && ctx.length === context.length;
  let from = 0;
  for (;;) {
    const start = ctx.indexOf(parts[0], from);
    if (start < 0) return false;
    let end = start + parts[0].length;
    for (const part of parts.slice(1)) {
      const j = ctx.indexOf(part, end);
      if (j < 0) return false;
      end = j + part.length;
    }
    if (!conPosicion) return true;
    if (start <= at && end >= at + length) return true;
    from = start + 1;
  }
}

/** Todos los trozos de una entrada, la primera aparición delante. */
export function glossChunks(entry: { c?: GlossChunk; cs?: GlossChunk[] } | null | undefined): GlossChunk[] {
  if (!entry) return [];
  // Una entrada vieja puede traer `c` a medias; un trozo sin `es` no cubre nada.
  return [...(entry.c ? [entry.c] : []), ...(entry.cs ?? [])].filter((t) => typeof t?.es === "string");
}

/** El trozo que describe la ocurrencia tocada, o ninguno. */
export function chunkForTap(
  entry: { c?: GlossChunk; cs?: GlossChunk[] } | null | undefined,
  context: string | undefined,
  at?: number,
  length?: number
): GlossChunk | undefined {
  return glossChunks(entry).find((t) => chunkCoversTap(t.es, context, at, length));
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Cada aparición de `palabra` (clave de glosa) en `texto`: posición y largo. */
export function glossOccurrences(palabra: string, texto: string): Array<{ at: number; length: number }> {
  const key = foldGlossText(palabra).trim();
  if (!key) return [];
  const ctx = foldGlossText(texto);
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(key)}(?![\\p{L}\\p{N}])`, "gu");
  const out: Array<{ at: number; length: number }> = [];
  for (const m of ctx.matchAll(re)) out.push({ at: m.index ?? 0, length: key.length });
  return out;
}

/** Las apariciones de `palabra` que ningún trozo de la entrada cubre. */
export function uncoveredOccurrences(
  palabra: string,
  texto: string,
  entry: { c?: GlossChunk; cs?: GlossChunk[] } | null | undefined
): Array<{ at: number; length: number }> {
  const trozos = glossChunks(entry);
  return glossOccurrences(palabra, texto).filter(
    (o) => !trozos.some((t) => chunkCoversTap(t.es, texto, o.at, o.length))
  );
}

/**
 * Si la aparición en `at` cae en un TURNO de una sola palabra tocable.
 *
 * En un journey de formato diálogo, media conversación son turnos de una
 * palabra: "Sí.", "Gracias.", "¿Casi?", "Apagada.". Ahí no hay trozo de
 * contexto que escribir, porque el trozo sería la palabra repitiendo su
 * propia definición, que es justo lo que `checkGlossContextReal` prohíbe. No
 * es un hueco de la capa: es la forma del texto.
 *
 * La condición es del TURNO, no de la palabra: "Sí." queda fuera del gate,
 * pero "Sí, ya voy." no, porque ahí sí hay una frase que traducir.
 *
 * Turno = la línea, quitada la etiqueta del hablante ("Mariana: "). En prosa
 * narrada no hay etiqueta y la línea entera es el turno, así que un párrafo
 * normal nunca da 1 y el 95% del catálogo no se entera de esta rama.
 */
export function turnoDeUnaPalabra(texto: string, at: number): boolean {
  const ini = texto.lastIndexOf("\n", at) + 1;
  const finNl = texto.indexOf("\n", at);
  const linea = texto.slice(ini, finNl >= 0 ? finNl : texto.length);
  const sinEtiqueta = linea.replace(/^\s*[\p{Lu}][\p{L}]*\s*:\s*/u, "");
  const tocables = sinEtiqueta.match(/\p{L}+(?:-\p{L}+)*/gu) ?? [];
  return tocables.length === 1;
}
