/**
 * Vocabulario vulgar: que palabras tienen que ir marcadas `register: "vulgar"`.
 *
 * WHY (2026-09-10): un tester del Friends latam C1 escribio "just noting that
 * 'culero' should also be marked as vulgar". Tenia razon y no era una palabra:
 * en ese journey NINGUNA plaza llevaba register "vulgar". Ocho avisaban dentro
 * de la definicion ("vulgar but widely used") y culero ni eso. Nada lo
 * impedia: el validador solo usaba `register` para eximir del juez de
 * frecuencia, nunca lo exigia.
 *
 * Dos disparadores, y basta uno:
 *   1. La forma esta en el LEXICO de su idioma (abajo). Es conservador a
 *      proposito: solo entra lo que es vulgar en toda la lengua o, si depende
 *      de la variante, con la variante excluida (`pendejo` en Argentina es un
 *      chaval; `pinche` en Espana es el ayudante de cocina).
 *   2. La definicion lo dice ("vulgar", "crude", "coarse"). Si el autor ya lo
 *      sabia, el campo tiene que decir lo mismo que el texto.
 *
 * Lo usan el validador (check `vocab-vulgar-register`) y el lint de base
 * (`npm run lint:vulgar-register`), para que no se desincronicen.
 */

type Entrada = { forma: RegExp; salvoVariantes?: string[] };

/** Borde de palabra con letras Unicode (\b no sabe de acentos ni de la ene). */
const w = (cuerpo: string) => new RegExp(`(?<![\\p{L}])(?:${cuerpo})(?![\\p{L}])`, "u");

const LEXICO: Record<string, Entrada[]> = {
  ES: [
    { forma: w("culer\\p{L}*") },
    { forma: w("culia(?:o|os|do|dos|da|das)?") },
    { forma: w("(?:en)?cabron\\p{L}*") },
    { forma: w("ching(?!ana)\\p{L}*") },
    { forma: w("pendej\\p{L}*"), salvoVariantes: ["argentina", "uruguay"] },
    { forma: w("pinches?"), salvoVariantes: ["spain"] },
    { forma: w("cag(?:a|o|ue)\\p{L}*") },
    // "la joda" en Argentina y Uruguay es la fiesta o la broma, no un insulto;
    // "no jodas" si lo es en todas partes, y por eso va aparte.
    { forma: w("jod(?!as?(?![\\p{L}]))\\p{L}*") },
    { forma: w("jodas?"), salvoVariantes: ["argentina", "uruguay"] },
    { forma: w("no jod\\p{L}*") },
    { forma: w("put(?:a|as|o|os|ear|eo|eas|eando|eada|azo|iza|ada)") },
    { forma: w("hij[oa]e?put\\p{L}*|hijueput\\p{L}*") },
    { forma: w("mierd\\p{L}*") },
    { forma: w("verga(?:s|zo|zos)?") },
    { forma: w("coños?") },
    { forma: w("cojon\\p{L}*") },
    { forma: w("gilipoll\\p{L}*") },
    { forma: w("follar|follando|follado|follada") },
    { forma: w("mamadas?|no mam(?:es|en|ar)") },
    { forma: w("madriz(?:a|as)|madrazos?") },
    { forma: w("chimbas?") },
    { forma: w("juemadre") },
    { forma: w("que pedo|al pedo|ni en pedo") },
    { forma: w("(?:valer|vale|valen|valio|valia) madres?|ni madres|hasta la madre") },
    { forma: w("menta\\p{L}* (?:la )?madres?") },
    { forma: w("ten\\p{L}* (?:guevos|huevos)") },
  ],
  DE: [
    { forma: w("schei(?:ß|ss)\\p{L}*|beschiss\\p{L}*") },
    { forma: w("arsch\\p{L}*") },
    { forma: w("fresse") },
    { forma: w("fick\\p{L}*") },
    { forma: w("verpiss\\p{L}*|angepisst") },
    { forma: w("wichser|fotze") },
  ],
  IT: [
    { forma: w("(?:in)?cazz\\p{L}*") },
    { forma: w("stronz\\p{L}*") },
    { forma: w("(?:vaf)?fancul\\p{L}*") },
    { forma: w("minchi\\p{L}*") },
    { forma: w("coglion\\p{L}*") },
    { forma: w("puttan\\p{L}*") },
    { forma: w("fott\\p{L}*") },
  ],
  PT: [
    { forma: w("porras?") },
    { forma: w("caralh\\p{L}*") },
    { forma: w("merdas?") },
    { forma: w("fod(?:a|as|er|ido|ida|idos|idas|eu|e)") },
    { forma: w("bucet\\p{L}*") },
    { forma: w("putas?") },
  ],
  FR: [
    { forma: w("merdes?") },
    { forma: w("putain") },
    { forma: w("connard\\p{L}*|connasse|connerie\\p{L}*") },
    { forma: w("encul\\p{L}*") },
    { forma: w("chier|foutre") },
  ],
};

const ISO: Record<string, string> = {
  es: "ES", spanish: "ES", espanol: "ES",
  de: "DE", german: "DE", deutsch: "DE",
  it: "IT", italian: "IT", italiano: "IT",
  pt: "PT", portuguese: "PT", portugues: "PT",
  fr: "FR", french: "FR", francais: "FR",
};

/** "spanish" | "ES" | "es" -> "ES"; lo que no conoce, null. */
export function isoDeIdioma(lang?: string | null): string | null {
  if (!lang) return null;
  return ISO[lang.trim().toLowerCase()] ?? null;
}

/**
 * Minusculas, sin tildes ni dieresis (culero = culéro), pero CON la ene y la
 * tilde nasal: sin ellas `coño` se volveria `cono`. Fuera la puntuacion de
 * exclamacion y el articulo aleman, que el vocab guarda como "die Fresse".
 */
export function normalizaForma(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-̂̄-ͯ]/g, "")
    .normalize("NFC")
    .toLowerCase()
    .replace(/[¡!¿?.,;:"“”]/g, " ")
    .replace(/^\s*(?:der|die|das|den|dem|des)\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** true si la forma (lema o superficie) esta en el lexico vulgar de su idioma. */
export function esVulgarPorLexico(forma: string, lang?: string | null, variant?: string | null): boolean {
  const iso = isoDeIdioma(lang);
  if (!iso || !forma) return false;
  const v = (variant ?? "").trim().toLowerCase();
  const n = normalizaForma(forma);
  return (LEXICO[iso] ?? []).some((e) => e.forma.test(n) && !(v && e.salvoVariantes?.includes(v)));
}

/**
 * Palabras que NOMBRAN la vulgaridad sin serlo: su definicion dice "a vulgar
 * word" y la palabra se puede decir delante de cualquiera.
 */
const HABLAN_DE_VULGARIDAD = new Set([
  "groseria", "la groseria", "las groserias", "palabrota", "la palabrota", "malas palabras",
  "schimpfwort", "das schimpfwort", "parolaccia", "la parolaccia", "palavrao", "o palavrao", "gros mot", "le gros mot",
]);

/**
 * true si la definicion del vocab ya dice que es vulgar (y no lo niega).
 * "coarse" no cuenta: en una definicion suele ser la textura (grueso = thick,
 * coarse). "crude" si, salvo "crude oil".
 */
export function definicionDiceVulgar(definicion?: string | null, word?: string | null): boolean {
  if (!definicion) return false;
  if (word && HABLAN_DE_VULGARIDAD.has(normalizaForma(word))) return false;
  return /(?<!\bnot |n't |\bnon-)\b(?:vulgar|crude)\b(?! oil)/i.test(definicion);
}

/**
 * La glosa de tap-any-word es una traduccion de dos o tres palabras, no una
 * definicion: "derb" se glosa "crude, coarse" y no es vulgar. Por eso aqui
 * solo cuenta la palabra "vulgar" dicha tal cual.
 */
export function glosaDiceVulgar(glosa?: string | null): boolean {
  if (!glosa) return false;
  return /(?<!\bnot |n't |\bnon-)\bvulgar\b/i.test(glosa);
}

export type VulgarSinMarcar = { word: string; register: string | null; motivo: "lexico" | "definicion" };

/** Plazas de vocab que son vulgares y no llevan `register: "vulgar"`. */
export function vulgarSinMarcar(
  vocab: Array<{ word?: string | null; surface?: string | null; definition?: string | null; register?: string | null }>,
  lang?: string | null,
  variant?: string | null
): VulgarSinMarcar[] {
  const out: VulgarSinMarcar[] = [];
  for (const v of vocab ?? []) {
    const reg = (v.register ?? "").trim().toLowerCase() || null;
    if (reg === "vulgar") continue;
    const word = String(v.word ?? "").trim();
    if (!word) continue;
    if (esVulgarPorLexico(word, lang, variant) || (v.surface && esVulgarPorLexico(v.surface, lang, variant))) {
      out.push({ word, register: reg, motivo: "lexico" });
    } else if (definicionDiceVulgar(v.definition, word)) {
      out.push({ word, register: reg, motivo: "definicion" });
    }
  }
  return out;
}
