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
//   - DUPLICADO: un tramo de 5+ palabras OIDAS que suena MAS veces de las
//     que aparece en el texto (la misma sintesis sonando dos veces en el
//     master). Si el texto tambien lo repite (un titulo que vuelve en el
//     cuerpo), no es duplicado.
//
// Antes de comparar, los numeros se llevan a cifra en los dos lados
// (canonNumbers): whisper escribe "21h" donde el texto dice "vingt et une
// heures", y eso no es un hueco.

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
  // Dos cifras solo son la misma si son iguales: 20 y 21 estan a distancia 1.
  if (/^\d+$/.test(a) || /^\d+$/.test(b)) return false;
  const dist = levenshtein(a, b);
  return dist <= Math.max(1, Math.floor(Math.min(a.length, b.length) * 0.34));
}

// --- Numeros: letra y cifra son equivalentes -------------------------------
// Una tabla de morfemas por idioma (el idioma se lo pasa el llamador; hoy
// frances o aleman, whisper transcribe en ese idioma con -l). Las palabras
// llegan ya normalizadas (sin guiones ni tildes ni ß, ver norm()), asi que
// "dix-sept" es "dixsept" y "dreißig" es "dreiig": cada token se descompone
// en morfemas.
export type NumberLang = "fr" | "de" | "it";

const UNITS_FR: Record<string, number> = {
  zero: 0, un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9,
  dix: 10, onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16,
};
const TENS_FR: Record<string, number> = { vingt: 20, vingts: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60 };
const MORPHEMES_FR = [...Object.keys(UNITS_FR), ...Object.keys(TENS_FR), "cent", "cents", "mille", "et"]
  .sort((x, y) => y.length - x.length);

// Aleman: "eins" es el numero suelto (cuenta, "eins zwei drei"); "ein" solo
// cuenta como numero dentro de un compuesto ("einundzwanzig"), nunca solo
// (es el articulo indefinido en casi todo texto real, "ein Hund"). Los
// numeros del 13 al 19 son morfemas propios (dreizehn...), no compuestos de
// "und". "ß" ya se elimina en norm(), asi que "dreißig" llega como "dreiig".
const UNITS_DE: Record<string, number> = {
  null: 0, eins: 1, ein: 1, zwei: 2, drei: 3, vier: 4, funf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9,
  zehn: 10, elf: 11, zwolf: 12, dreizehn: 13, vierzehn: 14, funfzehn: 15, sechzehn: 16, siebzehn: 17,
  achtzehn: 18, neunzehn: 19,
};
const TENS_DE: Record<string, number> = {
  zwanzig: 20, dreiig: 30, vierzig: 40, funfzig: 50, sechzig: 60, siebzig: 70, achtzig: 80, neunzig: 90,
};
const MORPHEMES_DE = [...Object.keys(UNITS_DE), ...Object.keys(TENS_DE), "hundert", "tausend", "und"]
  .sort((x, y) => y.length - x.length);

function tablesFor(lang: NumberLang) {
  return lang === "de"
    ? { UNITS: UNITS_DE, TENS: TENS_DE, MORPHEMES: MORPHEMES_DE }
    : { UNITS: UNITS_FR, TENS: TENS_FR, MORPHEMES: MORPHEMES_FR };
}

// Italiano: NO cabe en el esquema de morfemas de arriba porque los compuestos
// llevan elision de vocal ("venti" + "uno" -> "ventuno", pierde la "i"; "otto"
// tambien elide: "ventotto"), asi que "venti" no es prefijo literal de
// "ventuno" y numberMorphemes() no lo encontraria. Cada numero de 0 a 99 se
// construye una vez en una tabla directa (palabra completa -> valor); no hay
// deteccion de "cento"/"mille" compuestos (fuera de alcance: las 21 historias
// A0 no narran cifras de tres cifras). El acento de las decenas+tre
// ("ventitré") desaparece con norm() (NFD + strip de marcas), asi que la
// forma sin tilde que se construye aqui ya coincide con lo que normalize()
// deja de la transcripcion de whisper.
const UNITS_WORDS_IT = ["", "uno", "due", "tre", "quattro", "cinque", "sei", "sette", "otto", "nove"];
const TEENS_IT: Record<string, number> = {
  zero: 0, uno: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9,
  dieci: 10, undici: 11, dodici: 12, tredici: 13, quattordici: 14, quindici: 15, sedici: 16,
  diciassette: 17, diciotto: 18, diciannove: 19,
};
const TENS_WORDS_IT: Record<number, string> = {
  20: "venti", 30: "trenta", 40: "quaranta", 50: "cinquanta",
  60: "sessanta", 70: "settanta", 80: "ottanta", 90: "novanta",
};
function buildNumbersIt(): Record<string, number> {
  const out: Record<string, number> = { ...TEENS_IT, cento: 100 };
  for (const [tenStr, tenWord] of Object.entries(TENS_WORDS_IT)) {
    const ten = Number(tenStr);
    out[tenWord] = ten;
    for (let u = 1; u <= 9; u++) {
      const unit = UNITS_WORDS_IT[u];
      // Elision: "venti"+"uno"/"otto" pierde la vocal final de la decena.
      const word = (u === 1 || u === 8) ? tenWord.slice(0, -1) + unit : tenWord + unit;
      out[word] = ten + u;
    }
  }
  return out;
}
const NUMBERS_IT = buildNumbersIt();

/** Descompone un token en morfemas numericos, o null si no es un numero. */
function numberMorphemes(token: string, morphemes: string[]): string[] | null {
  const out: string[] = [];
  let rest = token;
  while (rest) {
    const m = morphemes.find((x) => rest.startsWith(x));
    if (!m) return null;
    out.push(m);
    rest = rest.slice(m.length);
  }
  return out;
}

/** Valor de una secuencia de morfemas ("vingt et une" / "ein und zwanzig"). */
function numberValue(ms: string[], lang: NumberLang): number | null {
  const { UNITS, TENS } = tablesFor(lang);
  let total = 0, current = 0;
  for (let k = 0; k < ms.length; k++) {
    const m = ms[k];
    if (m === "et" || m === "und") continue;
    if (m in UNITS) current += UNITS[m];
    else if (lang === "fr" && (m === "vingt" || m === "vingts")) current = current === 4 ? 80 : current + 20;
    else if (m in TENS) current += TENS[m];
    else if (m === "cent" || m === "cents" || m === "hundert") current = (current || 1) * 100;
    else if (m === "mille" || m === "tausend") { total += (current || 1) * 1000; current = 0; }
    else return null;
  }
  return total + current;
}

/**
 * Lleva a cifra los numeros de una lista de palabras normalizadas:
 * "vingt et une heures" -> "21 heures", "21h" -> "21 heures", "10" -> "10".
 * Un articulo/numeral suelto ("un"/"une" en frances, "ein" en aleman) se
 * queda como esta: casi siempre es articulo; solo cuenta dentro de un
 * compuesto ("vingt et une", "einundzwanzig"). `lang` por defecto "fr", que
 * es el comportamiento historico de este candado.
 */
export function canonNumbers(words: string[], lang: NumberLang = "fr"): string[] {
  // Italiano: sustitucion directa palabra a palabra (ver NUMBERS_IT arriba),
  // sin la logica de tiradas/morfemas de frances y aleman, que no aplica por
  // la elision de vocal en los compuestos.
  if (lang === "it") {
    return words.map((w) => {
      if (/^\d+$/.test(w)) return String(Number(w));
      return w in NUMBERS_IT ? String(NUMBERS_IT[w]) : w;
    });
  }
  const { MORPHEMES } = tablesFor(lang);
  const hourWord = lang === "de" ? "uhr" : "heures";
  const standaloneArticles = lang === "de" ? ["ein"] : ["un", "une"];
  const connector = lang === "de" ? "und" : "et";
  const out: string[] = [];
  let k = 0;
  while (k < words.length) {
    const w = words[k];
    const hour = /^(\d+)h(\d*)$/.exec(w);
    if (hour && lang === "fr") {
      out.push(String(Number(hour[1])), hourWord);
      if (hour[2]) out.push(String(Number(hour[2])));
      k++;
      continue;
    }
    if (/^\d+$/.test(w)) { out.push(String(Number(w))); k++; continue; }

    // Junta la tirada mas larga de tokens numericos que forme un numero valido.
    const run: string[] = [];
    let end = k;
    while (end < words.length) {
      const ms = numberMorphemes(words[end], MORPHEMES);
      if (!ms) break;
      run.push(...ms);
      end++;
    }
    let taken = 0, value: number | null = null;
    for (let e = end; e > k; e--) {
      const ms = words.slice(k, e).flatMap((x) => numberMorphemes(x, MORPHEMES)!);
      const standaloneArticle = ms.length === 1 && standaloneArticles.includes(ms[0]);
      const dangling = ms[0] === connector || ms[ms.length - 1] === connector;
      if (standaloneArticle || dangling) continue;
      const v = numberValue(ms, lang);
      if (v !== null) { taken = e - k; value = v; break; }
    }
    if (taken > 0 && value !== null) {
      out.push(String(value));
      k += taken;
    } else {
      out.push(w);
      k++;
    }
  }
  return out;
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

export type Duplicate = { words: string[]; firstIdx: number; secondIdx: number; heardCount: number; textCount: number };

/** Veces que `gram` aparece en `words`, tolerando ortografia palabra a palabra. */
function countOccurrences(words: string[], gram: string[]): number {
  let c = 0;
  for (let i = 0; i + gram.length <= words.length; i++) {
    let ok = true;
    for (let j = 0; j < gram.length && ok; j++) ok = wordsMatch(words[i + j], gram[j]);
    if (ok) { c++; i += gram.length - 1; }
  }
  return c;
}

/** Tramo de `window`+ palabras OIDAS que suena mas veces de las que aparece
 *  en el texto. En lo oido se busca exacto (una repeticion real viene de la
 *  MISMA sintesis, misma ortografia); en el texto, tolerante, para que un
 *  error de transcripcion no convierta en duplicado un titulo que el texto
 *  ya repite. */
export function findDuplicates(heardWords: string[], textWords: string[], window = 5): Duplicate[] {
  const positions = new Map<string, number[]>();
  for (let i = 0; i + window <= heardWords.length; i++) {
    const key = heardWords.slice(i, i + window).join(" ");
    const arr = positions.get(key);
    if (arr) { if (i >= arr[arr.length - 1] + window) arr.push(i); }
    else positions.set(key, [i]);
  }
  const found: Duplicate[] = [];
  for (const [key, pos] of positions) {
    if (pos.length < 2) continue;
    const words = key.split(" ");
    const textCount = countOccurrences(textWords, words);
    if (pos.length <= textCount) continue;
    found.push({ words, firstIdx: pos[0], secondIdx: pos[Math.max(1, textCount)], heardCount: pos.length, textCount });
  }
  // Un tramo duplicado largo produce muchas ventanas solapadas: se informa una
  // por cada `window` palabras, como antes.
  found.sort((a, b) => a.secondIdx - b.secondIdx);
  const dups: Duplicate[] = [];
  for (const d of found) {
    const last = dups[dups.length - 1];
    if (last && d.secondIdx < last.secondIdx + window) continue;
    dups.push(d);
  }
  return dups;
}

export type CoverageResult = { gaps: Gap[]; duplicates: Duplicate[]; ok: boolean };

export function checkCoverage(textWords: string[], heardWords: string[], lang: NumberLang = "fr"): CoverageResult {
  const text = canonNumbers(textWords, lang);
  const heard = canonNumbers(heardWords, lang);
  const gaps = findGaps(text, heard);
  const duplicates = findDuplicates(heard, text);
  return { gaps, duplicates, ok: gaps.length === 0 && duplicates.length === 0 };
}
