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
 * Alinea texto contra lo oido con la subsecuencia comun mas larga (LCS,
 * tolerante a ortografia via wordsMatch): la MISMA idea que
 * difflib.SequenceMatcher del barrido en Python, un algoritmo GLOBAL, no
 * un cursor que solo avanza ni una busqueda ciega a la posicion.
 *
 * DOS intentos anteriores fallaron, cada uno en una direccion (2026-09-14):
 *   1. Cursor que solo avanza, busca cada palabra en una ventana ADELANTE:
 *      si UNA palabra encontraba una coincidencia mas alla de lo que le
 *      tocaba, el cursor se adelantaba de mas y todo lo que venia despues,
 *      aunque estuviera, quedaba detras del cursor: marcaba media historia
 *      como hueco sobre un master que Python ya habia confirmado limpio.
 *   2. Sin cursor ni posicion ("aparece en cualquier punto"): arreglaba el
 *      fallo de arriba pero quedaba CIEGO al caso real: una frase que falta
 *      hecha de palabras corrientes (Justine, et, le, sa) tiene todas sus
 *      palabras sueltas en OTRO punto de la historia, y no contaba como
 *      ausente ahi.
 * La LCS no tiene ninguno de los dos modos de fallo: es el alineamiento
 * GLOBAL optimo (no local ni greedy), respeta el orden, y una palabra
 * corriente que aparece en otro sitio solo "tapa" el hueco si ese orden es
 * compatible con el resto del texto alrededor.
 */
export function findGaps(textWords: string[], heardWords: string[], minRun = 3): Gap[] {
  const n = textWords.length, m = heardWords.length;
  const dp: Int32Array[] = new Array(n + 1);
  for (let i = 0; i <= n; i++) dp[i] = new Int32Array(m + 1);
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] = wordsMatch(textWords[i - 1], heardWords[j - 1])
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const matched = new Array<boolean>(n).fill(false);
  let i = n, j = m;
  while (i > 0 && j > 0) {
    if (wordsMatch(textWords[i - 1], heardWords[j - 1]) && dp[i][j] === dp[i - 1][j - 1] + 1) {
      matched[i - 1] = true;
      i--; j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  const gaps: Gap[] = [];
  let run: string[] = [];
  let runStart = -1;
  for (let k = 0; k < n; k++) {
    if (matched[k]) {
      if (run.length >= minRun) gaps.push({ textWords: [...run], startIdx: runStart, endIdx: k, anchorBeforeIdx: null, anchorAfterIdx: null });
      run = [];
      runStart = -1;
    } else {
      if (runStart < 0) runStart = k;
      run.push(textWords[k]);
    }
  }
  if (run.length >= minRun) gaps.push({ textWords: [...run], startIdx: runStart, endIdx: n, anchorBeforeIdx: null, anchorAfterIdx: null });
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
