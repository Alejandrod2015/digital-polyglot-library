/**
 * _qaEar.ts: coverage FONÉTICO para QA de clips TTS (capa 1 del "auto-ear").
 *
 * Problema que resuelve (2026-07-22): el check ortográfico de _genPracticeClips
 * falso-rechazaba audio BUENO porque los STT normalizan dialecto y nombres:
 *   "weveo"→"hueveo" (chileno), "Strüßjer"→"Strüssjer" (kölsch),
 *   "Ronny"→"Ronnie" (ed2, fuera de la tolerancia ed1), y Scribe llegó a
 *   alucinar inglés sobre berlinés ("Wat willze, schon gehen?" →
 *   "What will say, Shong Khan?").
 * El texto FUENTE es la verdad (el dialecto es a propósito); lo que hay que
 * verificar es que el audio contiene los SONIDOS del texto, no su grafía.
 *
 * Método (calibrado contra fixture real, scripts/_qa_fixture_transcripts.json):
 *  - espeak-ng (-x Kirshenbaum) fonemiza texto esperado y transcripciones con
 *    LA MISMA voz → las idiosincrasias del G2P se cancelan.
 *  - Los fonemas colapsan a clases gruesas (voz/sordez fusionada: g≈k, b≈p;
 *    vocales a su calidad base) porque los STT confunden exactamente esos
 *    pares sobre dialecto.
 *  - MISS (palabra dropeada/garbled): distancia infija ponderada de los
 *    fonemas de cada palabra esperada contra la transcripción; se toma el
 *    MÍNIMO entre Scribe y whisper local (si un motor oyó los sonidos, están).
 *  - EXTRA (palabra alucinada por el TTS): NO por palabra; Scribe traduce
 *    dialecto a palabras inglesas que parecen "extras". Un extra real
 *    ("gracias" pegado al final) es una racha CONTIGUA de fonemas insertados
 *    en el alineamiento global; una re-interpretación dialectal son
 *    sustituciones. Racha ≥ RUN_THRESHOLD en AMBOS motores = extra real.
 *
 * Calibración 2026-07-22 (ver _qaEarTest.ts): 14/14 takes buenos rechazados
 * por el gate viejo PASAN; 8/8 defectos sintéticos (drop/trunc/halluc/swap)
 * se RECHAZAN. Márgenes: misses buenos ≤0.20 vs malos ≥0.42 (umbral 0.34);
 * rachas buenas ≤1 vs malas ≥6 (umbral 4).
 */
import { execFileSync } from "child_process";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { spawn } from "child_process";

// Voz espeak por idioma del pipeline. Ambos lados se fonemizan con la misma
// voz, así que la elección exacta (es vs es-419) no sesga la comparación.
const PHON_VOICE: Record<string, string> = { es: "es-419", de: "de" };

export const MISS_THRESHOLD = 0.34; // dist infija relativa por palabra
export const RUN_THRESHOLD = 4;     // fonemas insertados contiguos = extra real
// v1.1 (2026-07-22, tras el test ciego de 10 clips): huecos internos y
// velocidad, calibrados sobre los 14 takes buenos del fixture.
export const GAP_MAX_SEC = 0.7;  // silencio interno tolerado (buenos: máx <0.6)
export const RATE_MIN = 6.5;     // fonemas/seg hablado (buenos: 8.0-13.7,
export const RATE_MAX = 16;      // mediana 11.9; 1.35x de un clip normal ≈ 17)

// Igual que strip() del pipeline pero CONSERVA ñ/ü/ß: para fonemizar, esas
// marcas cambian el sonido (año≠ano); para comparar ortografía daba igual.
// v1.2: quita también [[ ]] (markup de vocab en audioText de Piper); en la
// auditoría 2026-07-22, 39/43 "misses" confirmados eran espeak fonemizando
// "[[guiña" con corchetes, no defectos de audio.
const stripPhon = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, (m) => (m === "̃" || m === "̈" ? m : ""))
    .normalize("NFC").replace(/[“”„«»".,!?;:()¿¡'`\[\]]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

const phonCache = new Map<string, string>();
function phonemize(text: string, voice: string): string {
  const k = voice + "|" + text;
  const hit = phonCache.get(k);
  if (hit !== undefined) return hit;
  const out = execFileSync("espeak-ng", ["-q", "-x", "-v", voice, text], { encoding: "utf8" }).trim();
  phonCache.set(k, out);
  return out;
}

// Kirshenbaum → clases gruesas. Los STT confunden voz/sordez y calidad vocal
// sobre dialecto; fusionarlas deja que la ESTRUCTURA (qué sonidos, en qué
// orden) sea lo que se compara.
// v1.2 (auditoría del catálogo): B (β) va con b/p, no con w: espeak elige el
// alófono por CONTEXTO ("bien" solo = b, "hace bien" = B) y partía la misma
// palabra en dos clases. m se fusiona con n (coarticulación: "bien fresco" →
// "bjem"). J (ʝ de "y") se fusiona con j (ʎ de "ll"): yeísmo LATAM, pulla=puya.
// * es la vibrante simple ɾ (Kirshenbaum) → r; el modificador 2 se filtra.
const CLASSMAP: Record<string, string> = {
  p: "P", b: "P", B: "P", t: "T", d: "T", k: "K", g: "K", q: "K",
  f: "w", v: "w", w: "w",
  S: "C", Z: "C", s: "s", z: "s", T: "s", D: "s",
  m: "n", n: "n", N: "n", l: "l", L: "j", r: "r", R: "r", "*": "r",
  x: "h", X: "h", C: "h", h: "h", j: "j", J: "j",
  a: "a", A: "a", "&": "a",
  e: "e", E: "e", "@": "e", "3": "e", V: "e",
  i: "i", I: "i", y: "i", Y: "i",
  o: "o", O: "o", "0": "o",
  u: "u", U: "u", "8": "u", "}": "u",
};
const VOWELS = new Set(["a", "e", "i", "o", "u"]);
const toClasses = (phon: string): string[] =>
  [...phon].filter((c) => !"':,%;#_|~^2 \n\t-".includes(c)).map((c) => CLASSMAP[c] ?? c);

// Sustitución vocal↔vocal barata (0.5): la calidad vocal es lo primero que
// cambia entre dialecto y estándar. Indel de 'h' casi gratis (aspiración).
const cost = (a: string, b: string) => (a === b ? 0 : VOWELS.has(a) && VOWELS.has(b) ? 0.5 : 1);
const indel = (a: string) => (a === "h" ? 0.3 : VOWELS.has(a) ? 0.6 : 1);

// Mejor distancia de A contra cualquier substring de B (inicio/fin libres).
function infixDist(A: string[], B: string[]): number {
  const m = B.length;
  let prev: number[] = new Array(m + 1).fill(0);
  let cur: number[] = new Array(m + 1);
  for (let i = 1; i <= A.length; i++) {
    cur[0] = prev[0] + indel(A[i - 1]);
    for (let j = 1; j <= m; j++)
      cur[j] = Math.min(prev[j - 1] + cost(A[i - 1], B[j - 1]), prev[j] + indel(A[i - 1]), cur[j - 1] + indel(B[j - 1]));
    [prev, cur] = [cur, prev];
  }
  return Math.min(...prev);
}

// Alineamiento global con backtrace → racha máxima de fonemas del heard que
// no emparejan con nada del want (inserciones contiguas). Distingue "el TTS
// dijo una palabra de más" (racha larga) de "el STT re-escribió el dialecto"
// (sustituciones, racha ~0-1).
function maxInsertRun(want: string[], heard: string[]): number {
  const n = want.length, m = heard.length;
  const D: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let j = 1; j <= m; j++) D[0][j] = D[0][j - 1] + indel(heard[j - 1]);
  for (let i = 1; i <= n; i++) {
    D[i][0] = D[i - 1][0] + indel(want[i - 1]);
    for (let j = 1; j <= m; j++)
      D[i][j] = Math.min(
        D[i - 1][j - 1] + cost(want[i - 1], heard[j - 1]),
        D[i - 1][j] + indel(want[i - 1]),
        D[i][j - 1] + indel(heard[j - 1]),
      );
  }
  let i = n, j = m, run = 0, best = 0;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && D[i][j] === D[i - 1][j - 1] + cost(want[i - 1], heard[j - 1])) { i--; j--; run = 0; }
    else if (j > 0 && D[i][j] === D[i][j - 1] + indel(heard[j - 1])) { run++; best = Math.max(best, run); j--; }
    else { i--; run = 0; }
  }
  return best;
}

export type EarVerdict = {
  ok: boolean;
  misses: { word: string; dist: number }[]; // palabras esperadas sin sonidos en NINGÚN motor
  insertRun: number;                        // racha de inserciones min entre motores
  detail: string;                           // razón legible para logs
};

/**
 * Veredicto fonético: ¿la transcripción (Scribe, y opcionalmente whisper como
 * segunda opinión) contiene los sonidos de la oración esperada, sin sonido
 * inventado de sobra? txWhisper=null → un solo motor (más estricto en miss,
 * y la racha de Scribe decide sola el extra).
 */
export function phoneticCoverage(sentence: string, txScribe: string, txWhisper: string | null, lang: string): EarVerdict {
  const voice = PHON_VOICE[lang];
  if (!voice) throw new Error(`_qaEar: idioma sin voz espeak: ${lang}`);
  const wantWords = stripPhon(sentence).split(" ").filter((w) => w.length >= 3);
  const wantJ = toClasses(phonemize(stripPhon(sentence), voice));
  const sJ = toClasses(phonemize(stripPhon(txScribe), voice));
  const wJ = txWhisper ? toClasses(phonemize(stripPhon(txWhisper), voice)) : null;

  const misses: { word: string; dist: number }[] = [];
  for (const w of wantWords) {
    const wp = toClasses(phonemize(w, voice));
    if (!wp.length) continue;
    const d = Math.min(infixDist(wp, sJ), wJ ? infixDist(wp, wJ) : Infinity) / wp.length;
    if (d > MISS_THRESHOLD) misses.push({ word: w, dist: +d.toFixed(2) });
  }
  const runS = maxInsertRun(wantJ, sJ);
  // v1.1: whisper solo EXCULPA un extra si de verdad cubrió el audio. En el
  // test ciego, un empalme al final no apareció en whisper (se calló antes) y
  // su racha corta perdonaba el pegote que Scribe SÍ transcribió; si la
  // transcripción de whisper es mucho más corta que la de Scribe (<70% de
  // fonemas), su silencio no cuenta como "no hay extra".
  const wCovers = wJ !== null && wJ.length >= 0.7 * sJ.length;
  const insertRun = wJ && wCovers ? Math.min(runS, maxInsertRun(wantJ, wJ)) : runS;
  const ok = misses.length === 0 && insertRun < RUN_THRESHOLD;
  const detail = ok
    ? "phonetic ok"
    : [
        misses.length ? `miss fonético: ${misses.map((m) => `${m.word}(${m.dist})`).join(",")}` : "",
        insertRun >= RUN_THRESHOLD ? `inserción de ${insertRun} fonemas (extra real)` : "",
      ].filter(Boolean).join(" · ");
  return { ok, misses, insertRun, detail };
}

// Segunda opinión local: whisper.cpp (mismo binario/modelo que el tail gate).
// Devuelve null si whisper-cli o el modelo no están (el caller decide operar
// con un solo motor).
const WHISPER_MODEL = join(process.env.HOME || "", ".cache", "whisper", "ggml-base.bin");
function spawnCapture(cmd: string, args: string[]): Promise<{ code: number; out: string }> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args);
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.on("error", reject);
    p.on("close", (code) => resolve({ code: code ?? 1, out }));
  });
}
export async function whisperTranscribe(mp3: Buffer | string, whisperLang: string): Promise<string | null> {
  return (await whisperAnalyze(mp3, whisperLang))?.text ?? null;
}

// v1.1: una sola corrida de whisper (-ojf) da transcripción + tramo hablado
// (primer/último token), que alimenta fonética, huecos internos, velocidad y
// cola sin repetir STT.
export type WhisperInfo = { text: string; speechStartSec: number; speechEndSec: number };
export async function whisperAnalyze(mp3: Buffer | string, whisperLang: string): Promise<WhisperInfo | null> {
  const dir = mkdtempSync(join(tmpdir(), "ear-"));
  try {
    const src = typeof mp3 === "string" ? mp3 : join(dir, "in.mp3");
    if (typeof mp3 !== "string") writeFileSync(src, mp3);
    const wav = join(dir, "a.wav");
    await new Promise<void>((res, rej) => {
      const p = spawn("ffmpeg", ["-y", "-loglevel", "error", "-i", src, "-ar", "16000", "-ac", "1", wav]);
      p.on("error", rej);
      p.on("close", (c) => (c === 0 ? res() : rej(new Error(`ffmpeg ${c}`))));
    });
    const r = await spawnCapture("whisper-cli", ["-m", WHISPER_MODEL, "-l", whisperLang, "-np", "-ojf", "-of", join(dir, "a"), wav]);
    if (r.code !== 0) return null;
    const json = JSON.parse(readFileSync(join(dir, "a.json"), "utf8"));
    const segs: any[] = json.transcription || [];
    const toks = segs.flatMap((s: any) => s.tokens || []).filter((t: any) => (t.text || "").trim() && !t.text.startsWith("[_"));
    if (!toks.length) return null;
    const text = segs.map((s: any) => s.text || "").join(" ").replace(/\s+/g, " ").trim();
    return { text, speechStartSec: toks[0].offsets.from / 1000, speechEndSec: toks[toks.length - 1].offsets.to / 1000 };
  } catch {
    return null;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// Huecos internos: silencios ≥ GAP_MAX_SEC estrictamente DENTRO del tramo
// hablado (los buenos no pasan de ~0.5s ni en pausas de coma; un hueco de
// 1.5s partió "bedankt sich" en el test ciego y ningún gate lo vio).
export async function internalGaps(mp3Path: string, speechStartSec: number, speechEndSec: number): Promise<{ start: number; dur: number }[]> {
  const r = await spawnCaptureErr("ffmpeg", ["-i", mp3Path, "-af", `silencedetect=noise=-35dB:d=${GAP_MAX_SEC}`, "-f", "null", "-"]);
  const gaps: { start: number; dur: number }[] = [];
  const re = /silence_start:\s*([\d.]+)[\s\S]*?silence_duration:\s*([\d.]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(r)) !== null) {
    const start = parseFloat(m[1]), dur = parseFloat(m[2]);
    if (start > speechStartSec + 0.15 && start + dur < speechEndSec - 0.15) gaps.push({ start, dur });
  }
  return gaps;
}
function spawnCaptureErr(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args);
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("error", reject);
    p.on("close", () => resolve(err));
  });
}

// Velocidad: fonemas de la oración esperada / segundos hablados. Banda
// calibrada sobre los 14 takes buenos (8.0-13.7); 1.35x cae fuera.
export function phonemeCount(sentence: string, lang: string): number {
  const voice = PHON_VOICE[lang];
  if (!voice) throw new Error(`_qaEar: idioma sin voz espeak: ${lang}`);
  return toClasses(phonemize(stripPhon(sentence), voice)).length;
}
export function rateCheck(sentence: string, lang: string, spokenSec: number): { ok: boolean; rate: number } {
  const rate = +(phonemeCount(sentence, lang) / Math.max(0.1, spokenSec)).toFixed(1);
  return { ok: rate >= RATE_MIN && rate <= RATE_MAX, rate };
}
