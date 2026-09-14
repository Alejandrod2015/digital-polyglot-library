// Candado de cobertura: verifica que un master TRANSCRITO (whisper, palabra
// por palabra) diga lo mismo que el TEXTO de la historia, ni de mas ni de
// menos. Nacio el 2026-09-14 tras un empalme que dejo une-liste-dans-la-tete
// con frases duplicadas y una frase entera perdida, sin que ningun chequeo
// existente (offset-desfase, F0, gate de contenido por fragmento) lo notara:
// todos miran UN fragmento aislado contra su propio texto; ninguno vuelve a
// mirar el MASTER COMPLETO despues del empalme.
//
// Dos fallos distintos:
//   - HUECO: un tramo de 3+ palabras del texto que no aparece (ni parecido)
//     en lo oido. Tolera diferencias de ortografia del transcriptor
//     (whisper-small confunde "goutte"/"goute", "vous la"/"voula"): usa
//     distancia de edicion por palabra, no comparacion exacta.
//   - DUPLICADO: un tramo de 5+ palabras OIDAS que se repite identico dos
//     veces (la misma sintesis sonando dos veces en el master).

export type HeardWord = { text: string; start: number; end: number };

export const norm = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[n];
}

/** Dos palabras normalizadas "son la misma" si son iguales o su distancia de
 *  edicion es baja relativa a su longitud (tolera errores de ortografia del
 *  transcriptor, no confunde palabras distintas). */
function wordsMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const dist = levenshtein(a, b);
  return dist <= Math.max(1, Math.floor(Math.min(a.length, b.length) * 0.34));
}

export type Gap = { textWords: string[]; startIdx: number; endIdx: number; anchorBeforeIdx: number | null; anchorAfterIdx: number | null };

/**
 * Busca huecos SIN depender de posicion (a proposito, ver abajo): para cada
 * palabra del texto, mira si aparece PARECIDA en cualquier punto de lo
 * oido (no solo "adelante de un cursor"). Un tramo de `minRun`+ palabras
 * SEGUIDAS del texto sin ninguna parecida en todo lo oido es un hueco real.
 *
 * ADVERTENCIA que costo un falso positivo (2026-09-14): la primera version
 * usaba un cursor que solo avanza (como anclarFragmentos), buscando cada
 * palabra en una ventana ADELANTE del cursor. Si UNA palabra encontraba una
 * coincidencia mas adelante de lo que le tocaba (una repeticion del mismo
 * lema en otro punto de la historia, o una palabra corta y comun), el
 * cursor saltaba de mas y TODAS las palabras siguientes, que si estaban,
 * quedaban detras del cursor y jamas se encontraban: el resto de la
 * historia entera salia marcada como "hueco", sobre un master que la
 * barrida en Python (SequenceMatcher, sin este problema) ya habia
 * confirmado limpio. La busqueda sin cursor no tiene ese modo de fallo: no
 * hay "de mas" que arrastrar, cada palabra se busca en TODO lo oido.
 */
export function findGaps(textWords: string[], heardWords: string[], minRun = 3): Gap[] {
  const gaps: Gap[] = [];
  const presente = textWords.map((w) => heardWords.some((h) => wordsMatch(w, h)));
  let run: string[] = [];
  let runStart = -1;
  for (let i = 0; i < textWords.length; i++) {
    if (presente[i]) {
      if (run.length >= minRun) {
        gaps.push({ textWords: [...run], startIdx: runStart, endIdx: i, anchorBeforeIdx: null, anchorAfterIdx: null });
      }
      run = [];
      runStart = -1;
    } else {
      if (runStart < 0) runStart = i;
      run.push(textWords[i]);
    }
  }
  if (run.length >= minRun) {
    gaps.push({ textWords: [...run], startIdx: runStart, endIdx: textWords.length, anchorBeforeIdx: null, anchorAfterIdx: null });
  }
  return gaps;
}

export type Duplicate = { words: string[]; firstIdx: number; secondIdx: number };

/** Tramo de `window`+ palabras OIDAS que se repite identico (exacto, no
 *  tolerante: una repeticion real viene de la MISMA sintesis, misma
 *  ortografia). */
export function findDuplicates(heardWords: string[], window = 5): Duplicate[] {
  const dups: Duplicate[] = [];
  const seen = new Map<string, number>();
  let i = 0;
  while (i + window <= heardWords.length) {
    const key = heardWords.slice(i, i + window).join(" ");
    const prev = seen.get(key);
    if (prev !== undefined) {
      dups.push({ words: heardWords.slice(i, i + window), firstIdx: prev, secondIdx: i });
      i += window;
    } else {
      seen.set(key, i);
      i += 1;
    }
  }
  return dups;
}

export type CoverageResult = { gaps: Gap[]; duplicates: Duplicate[]; ok: boolean };

export function checkCoverage(textWords: string[], heardWords: string[]): CoverageResult {
  const gaps = findGaps(textWords, heardWords);
  const duplicates = findDuplicates(heardWords);
  return { gaps, duplicates, ok: gaps.length === 0 && duplicates.length === 0 };
}
