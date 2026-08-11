/**
 * Un solo sitio donde se decide cómo se llama un idioma.
 *
 * Sin dependencias a propósito: los scripts de comprobación tienen que poder
 * importarlo, y cualquier módulo que toque prisma va sellado con `server-only`.
 *
 * WHY: la primera versión de esto sólo entendía códigos ISO (`es`, `de`, `pt`)
 * mientras que la base guarda los nombres en inglés (`spanish`, `german`,
 * `portuguese`). Italiano, francés e inglés funcionaban de chiripa, porque su
 * nombre empieza por las mismas dos letras que su código, así que el fallo se
 * leía como "sólo tenemos contenido en italiano" en vez de como un bug: de 101
 * historias sólo 8 resolvían idioma. Por eso esto es una tabla explícita y no
 * una cadena de `startsWith`.
 */

const CANONICAL: Record<string, string> = {
  es: "Spanish", spa: "Spanish", spanish: "Spanish", castellano: "Spanish",
  español: "Spanish", espanol: "Spanish",

  it: "Italian", ita: "Italian", italian: "Italian", italiano: "Italian",

  de: "German", ger: "German", deu: "German", german: "German",
  deutsch: "German", alemán: "German", aleman: "German",

  fr: "French", fra: "French", french: "French",
  français: "French", francais: "French", francés: "French", frances: "French",

  pt: "Portuguese", por: "Portuguese", portuguese: "Portuguese",
  português: "Portuguese", portugues: "Portuguese",

  en: "English", eng: "English", english: "English",
  inglés: "English", ingles: "English",
};

/** "german" | "de" | "Deutsch" -> "German". Null si no lo reconocemos. */
export function canonicalLanguageName(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (!v) return null;
  return CANONICAL[v] ?? CANONICAL[v.slice(0, 2)] ?? null;
}
