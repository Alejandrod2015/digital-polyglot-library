/**
 * De un token TOCABLE a la clave del bundle de glosas, resolviendo la elisión.
 *
 * Hay dos reglas en juego y durante meses no se hablaron. Una decide qué trozo
 * se subraya al tocar (`TAPPABLE`, que conserva apóstrofo y guion) y otra decide
 * qué se busca en el bundle. La segunda era `\p{L}+(?:-\p{L}+)*`, que CORTA en
 * el apóstrofo y se queda con el primer tramo: en el italiano publicado tocabas
 * `d'acqua` y salía "of, from", con `acqua` inalcanzable.
 *
 * El móvil ya resolvía la cola (`ReaderScreen.lookupGloss`); el web no, y el web
 * con audio es la superficie donde de verdad se lee. Esto unifica las dos y
 * añade el caso que a la del móvil le faltaba: la palabra que LLEVA apóstrofo
 * dentro y no es una elisión, como `aujourd'hui`, que no es `aujourd` + `hui`.
 *
 * El orden de las candidatas importa y no lleva heurística de longitud: gana la
 * primera que EXISTE en el bundle, así que una cola absurda (`don't` -> `t`)
 * simplemente no se encuentra y se cae a la siguiente.
 */

/** La unidad que el usuario puede tocar. Conserva apóstrofos y guiones. */
export const TAPPABLE = /[\p{L}\p{N}][\p{L}\p{N}'’\-]*/gu;

/**
 * Troceo de una cadena suelta (título, párrafo sin karaoke) en el que los
 * grupos impares son palabras tocables. Mismo criterio que `TAPPABLE`: el
 * apóstrofo UNE, no corta, para que el span sea la palabra entera.
 */
export const WORD_SPLIT = /(\p{L}+(?:['’\-]\p{L}+)*['’]?)/u;

const bare = (s: string) => {
  const m = s.toLowerCase().normalize("NFC").match(/\p{L}+(?:-\p{L}+)*/u);
  return m ? m[0] : "";
};

/**
 * Claves candidatas, en orden de preferencia:
 *   1. el token entero sin puntuación de borde (`aujourd'hui`, `po'` -> `po`)
 *   2. lo que va después del PRIMER apóstrofo (`l'aria` -> `aria`)
 *   3. lo que va antes, que es el comportamiento histórico (`schmeckt's`)
 */
export function glossKeyCandidates(text: string): string[] {
  const raw = text.toLowerCase().normalize("NFC").replace(/[’]/g, "'");
  const trimmed = raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}']+$/gu, "").replace(/'+$/g, "");
  const out: string[] = [];
  const push = (s: string) => {
    if (s && !out.includes(s)) out.push(s);
  };
  const apostrophe = raw.indexOf("'");
  if (apostrophe > -1) {
    push(trimmed);
    push(bare(raw.slice(apostrophe + 1)));
  }
  push(bare(raw));
  return out;
}

/** La clave con la que se buscaría hoy, sin mirar el bundle. Solo para logs. */
export function glossKey(text: string): string {
  return glossKeyCandidates(text)[0] ?? "";
}

/** Primera candidata que existe en el bundle. */
export function resolveGloss<T>(
  glosses: Record<string, T> | null | undefined,
  text: string
): { token: string; gloss: T } | null {
  if (!glosses) return null;
  for (const k of glossKeyCandidates(text)) {
    const hit = glosses[k];
    if (hit) return { token: k, gloss: hit };
  }
  return null;
}
