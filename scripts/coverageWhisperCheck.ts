// Transcribe un master ENTERO con whisper.cpp local (gratis, sin ElevenLabs)
// y lo compara contra el texto de la historia con coverageCheckLib. Es el
// candado que faltaba: todos los chequeos existentes (F0, contenido,
// offset-desfase) miran UN fragmento aislado; este vuelve a mirar el MASTER
// COMPLETO despues de cualquier empalme, que es donde un boundary corrupto
// deja huecos o duplicados que ninguno de los otros ve.
import { execFileSync } from "child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { canonNumbers, checkCoverage, findGaps, norm, type CoverageResult, type Gap, type NumberLang } from "./coverageCheckLib";

const WHISPER_CLI = "/opt/homebrew/bin/whisper-cli";
const MODEL = path.join(
  __dirname, "..", "scripts", "tts", "whisper-models", "ggml-small.bin"
);

// Idioma del journey -> codigo de whisper -l y tabla de numeros de
// coverageCheckLib. Probado en seco (2026-09-15) contra 3 masters reales del
// Friends DE C1 publicado: "-l fr" (el default historico) da huecos falsos en
// aleman (numeros y ortografia mal leidos, 2 de 3); "-l de" sale limpio salvo
// una linea real en dialecto (no un fallo del candado). Sin entrada = frances,
// que es el comportamiento de siempre para los journeys que ya usaban esto.
//
// El espanol se anadio el 2026-09-17, antes de narrar el Friends ES A2: con
// "-l fr" whisper transcribe el espanol como si fuera frances y el candado
// reporta la historia entera como hueco, que es peor que no tenerlo.
const WHISPER_LANG: Record<string, string> = { german: "de", spanish: "es" };
export function whisperLangFor(journeyLanguage?: string | null): string {
  return (journeyLanguage && WHISPER_LANG[journeyLanguage]) || "fr";
}
const NUMBER_LANG: Record<string, NumberLang> = { german: "de", spanish: "es" };
export function numberLangFor(journeyLanguage?: string | null): NumberLang {
  return (journeyLanguage && NUMBER_LANG[journeyLanguage]) || "fr";
}

type RawWord = { text: string; start: number; end: number };

function parseWhisperJson(jsonPath: string): RawWord[] {
  const data = JSON.parse(readFileSync(jsonPath, "utf8")) as {
    transcription: { text: string; offsets: { from: number; to: number } }[];
  };
  const words: RawWord[] = [];
  for (const seg of data.transcription) {
    const raw = seg.text;
    if (!raw.trim()) continue;
    const start = seg.offsets.from / 1000;
    const end = seg.offsets.to / 1000;
    if (raw.startsWith(" ") || words.length === 0) {
      words.push({ text: raw.trim(), start, end });
    } else {
      const last = words[words.length - 1];
      last.text += raw.trim();
      last.end = end;
    }
  }
  return words.filter((w) => norm(w.text));
}

const MAX_WHISPER_PASSES = 5;
const GAP_THRESHOLD_MS = 1500;

function getAudioDurationMs(wav: string): number {
  const out = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", wav]);
  return Math.round(parseFloat(out.toString().trim()) * 1000);
}

// whisper.cpp puede dejar de iterar ventanas de 30s antes de llegar al final
// del audio (visto en produccion: para en seco a mitad de un master de 68s,
// exit 0, sin ningun aviso). Esto pasa da igual el -ml, -sow, -np o el umbral
// de entropia/no-speech que se use; el motor SI puede leer ese tramo (un
// -ot al punto del corte lo transcribe perfecto), simplemente no llega solo.
// Por eso: si la transcripcion se queda corta contra la duracion real
// (ffprobe), se relanza con -ot desde el ultimo punto oido y se concatena,
// en vez de reportar un hueco falso.
export async function transcribeWithRetries(
  runPass: (offsetMs: number) => Promise<RawWord[]>,
  durationMs: number,
  opts: { maxPasses?: number; gapThresholdMs?: number } = {},
): Promise<RawWord[]> {
  const maxPasses = opts.maxPasses ?? MAX_WHISPER_PASSES;
  const gapThresholdMs = opts.gapThresholdMs ?? GAP_THRESHOLD_MS;
  const words: RawWord[] = [];
  let offsetMs = 0;
  for (let pass = 0; pass < maxPasses; pass++) {
    const passWords = (await runPass(offsetMs)).filter((w) => w.end * 1000 > offsetMs);
    words.push(...passWords);
    const lastEnd = passWords.length ? passWords[passWords.length - 1].end * 1000 : offsetMs;
    if (durationMs - lastEnd <= gapThresholdMs) return words;
    if (lastEnd <= offsetMs) {
      console.warn(
        `coverageWhisperCheck: whisper se detuvo en ${(lastEnd / 1000).toFixed(1)}s de ${(durationMs / 1000).toFixed(1)}s sin avanzar en el reintento; se reporta la transcripcion tal cual`,
      );
      return words;
    }
    offsetMs = lastEnd;
  }
  const finalEnd = words.length ? words[words.length - 1].end * 1000 : 0;
  console.warn(
    `coverageWhisperCheck: la transcripcion termina ${((durationMs - finalEnd) / 1000).toFixed(1)}s antes del audio real (${(durationMs / 1000).toFixed(1)}s) tras ${maxPasses} intentos`,
  );
  return words;
}

/** Descarga el master y lo deja como wav 16kHz mono, listo para whisper-cli.
 *  Separado de `transcribeMaster` (2026-09-16) para que `checkMasterCoverage`
 *  pueda re-cortar y re-escuchar UNA ventana concreta despues de la pasada
 *  completa, sin descargar el master dos veces. Quien llama es responsable
 *  de borrar `dir`. */
function downloadAndConvert(mp3Buf: Buffer, dir: string): string {
  const mp3 = path.join(dir, "a.mp3");
  writeFileSync(mp3, mp3Buf);
  const wav = path.join(dir, "a.wav");
  execFileSync("ffmpeg", ["-v", "error", "-i", mp3, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", wav, "-y"]);
  return wav;
}

let _passCounter = 0;
function runWhisperPass(wav: string, dir: string, whisperLang: string, offsetMs = 0): RawWord[] {
  const out = path.join(dir, `p${_passCounter++}`);
  const args = ["-m", MODEL, "-l", whisperLang, "-np", "-ml", "1"];
  if (offsetMs > 0) args.push("-ot", String(Math.round(offsetMs)));
  args.push("-ojf", "-of", out, wav);
  execFileSync(WHISPER_CLI, args, { stdio: "pipe" });
  return parseWhisperJson(`${out}.json`);
}

export async function transcribeMaster(masterUrl: string, whisperLang = "fr"): Promise<RawWord[]> {
  const dir = mkdtempSync(path.join(tmpdir(), "covcheck-"));
  try {
    const buf = Buffer.from(await (await fetch(masterUrl)).arrayBuffer());
    const wav = downloadAndConvert(buf, dir);
    const durationMs = getAudioDurationMs(wav);
    return await transcribeWithRetries(
      async (offsetMs) => runWhisperPass(wav, dir, whisperLang, offsetMs),
      durationMs,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Re-escucha SOLO la ventana [startSec, endSec] (con margen ya incluido por
 * el llamador) para confirmar si un "hueco" del pase completo es real.
 *
 * WHY (2026-09-16, journey-planning): whisper-small, pasando un master de
 * 60-90s de una sola vez, perdio o garabateo tramos de 5-10 palabras que SI
 * estan en el audio (confirmado a mano, dos veces, en el Friends IT A0:
 * solo-per-una-foto y domenica-senza-terrazza; aislando y re-transcribiendo
 * ESE fragmento por separado salia completo y correcto las dos). No es que
 * el hueco no exista en el audio: es que whisper, con ventanas de 30s
 * encadenadas sobre un audio largo, pierde sincronia justo ahi. Una ventana
 * corta (unos segundos) con margen no tiene ese problema.
 */
function reheedWindow(wav: string, dir: string, whisperLang: string, startSec: number, endSec: number): string[] {
  const clip = path.join(dir, `w${_passCounter}.wav`);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", wav, "-ss", String(Math.max(0, startSec)), "-to", String(endSec), clip]);
  const words = runWhisperPass(clip, dir, whisperLang);
  return words.map((w) => norm(w.text)).filter(Boolean);
}

/**
 * Palabras de referencia en el ORDEN en que la sintesis las dice: el titulo
 * primero (fragmento [0] del master, siempre) y despues el cuerpo, con el
 * mismo separador de parrafo que usa `generateAndUploadMultiVoiceAudio`.
 * `title` es opcional para no romper una llamada vieja que ya concatenaba
 * el titulo dentro de `text` a mano.
 *
 * WHY (2026-09-16, journey-planning): sin el titulo, una historia que HACE
 * ECO de su propio titulo en el dialogo (recurso narrativo real, no un
 * error) sale con un "duplicado" falso: el candado oye el titulo UNA vez
 * (como titulo) y OTRA (como eco en el cuerpo) pero solo contaba la del
 * cuerpo contra el texto, asi que 2 oidas contra 1 esperada disparaba el
 * gate. Paso en el Friends IT A0 (un-segreto-tra-noi-due) y ya habia pasado
 * antes, sin arreglarse, en el FR A2 ("La sauce ne tient pas", "Il y a douze
 * ans"): las tres veces se descarto a mano en vez de corregir la libreria.
 */
export function referenceWordsFor(title: string | undefined, text: string): string[] {
  const full = title ? `${title}\n\n${text}` : text;
  return full.split(/\s+/).map(norm).filter(Boolean);
}

// Margen BASE a cada lado de la ventana re-escuchada (el segundo intento en
// checkMasterCoverage lo dobla; ver ese comentario). Probado en seco
// (2026-09-16) contra los dos huecos falsos confirmados a mano
// (domenica-senza-terrazza, solo-per-una-foto): 0.6s, 3s y 5s NO bastaron
// para el segundo, ni siquiera con dos intentos. Cuando whisper pierde
// sincronia en un tramo, no solo se COME palabras: las que si transcribe
// arrastran un DESFASE (de varios segundos, y crece cuanto mas tarde en el
// master pasa el problema), asi que anchorBeforeIdx/anchorAfterIdx (sacados
// del pase completo, que ES el que arrastra el desfase) ya vienen "tarde"
// respecto al audio real. Con 8s (y 16s en el segundo intento) el candado
// confirmo limpios, DOS veces seguidas, los dos huecos falsos conocidos, sin
// dejar de marcar el hueco real sintetico del test (que no depende de esta
// constante: usa palabras directamente, no un slice de audio).
const REHEAR_MARGIN_SEC = 8;

/**
 * Decide si un hueco del pase completo sigue en pie tras re-escuchar solo su
 * ventana. Extraida aparte (pura, sin red ni whisper-cli) para poder testear
 * las dos direcciones sin depender de la red: un hueco que SI aparece en la
 * ventana re-escuchada (falso positivo, se descarta) y uno que sigue faltando
 * ahi tambien (hueco real, se mantiene).
 */
export function isGapStillMissing(gap: Gap, rehardWordsInWindow: string[], numLang: NumberLang): boolean {
  // minRun=1: aqui solo interesa si las palabras del hueco APARECEN en la
  // ventana re-escuchada, no medir huecos nuevos dentro de un tramo tan
  // corto. `gap.textWords` ya viene canonicalizado (sale de checkCoverage).
  return findGaps(gap.textWords, canonNumbers(rehardWordsInWindow, numLang), 1).length > 0;
}

/**
 * `journeyLanguage` es el `Journey.language` ("german", "french", ...);
 * decide el `-l` de whisper y la tabla de numeros (ver whisperLangFor /
 * numberLangFor arriba). Sin argumento, frances: el comportamiento de
 * siempre para los journeys que ya llamaban esto sin idioma. `title`
 * opcional: ver `referenceWordsFor`.
 */
export async function checkMasterCoverage(
  masterUrl: string,
  referenceText: string,
  journeyLanguage?: string | null,
  title?: string
): Promise<CoverageResult> {
  const whisperLang = whisperLangFor(journeyLanguage);
  const numLang = numberLangFor(journeyLanguage);
  const dir = mkdtempSync(path.join(tmpdir(), "covcheck-"));
  try {
    const buf = Buffer.from(await (await fetch(masterUrl)).arrayBuffer());
    const wav = downloadAndConvert(buf, dir);
    const durationSec = getAudioDurationMs(wav) / 1000;
    const heard = await transcribeWithRetries(
      async (offsetMs) => runWhisperPass(wav, dir, whisperLang, offsetMs),
      durationSec * 1000,
    );
    const textWords = referenceWordsFor(title, referenceText);
    // heard[] ya viene sin palabras vacias (parseWhisperJson filtra), asi que
    // heardWords y heard quedan alineados indice a indice: heardWords[k] es
    // norm(heard[k].text). checkCoverage()/findGaps() se apoyan en ESA
    // alineacion para devolver, por hueco, el indice heard de la palabra
    // oida justo antes y justo despues (anchorBeforeIdx/anchorAfterIdx).
    const heardWords = heard.map((w) => norm(w.text));
    const first = checkCoverage(textWords, heardWords, numLang);

    // CANDADO DE FALSOS POSITIVOS (2026-09-16, journey-planning): antes de
    // reportar un hueco, re-escucha SOLO esa ventana de tiempo. Si las
    // palabras aparecen ahi, no era un hueco real: era whisper perdiendo
    // sincronia al procesar el master entero de un tiron (ver reheedWindow).
    //
    // El margen crece en cada intento (2 intentos: REHEAR_MARGIN_SEC y el
    // doble) porque el DESFASE que arrastra el pase completo no es fijo (mas
    // tarde en el master, mas desfase acumulado), y porque una sola pasada de
    // whisper sobre una ventana corta puede fallar por su cuenta (no
    // determinista al 100% en el borde de la ventana). Confirmar en dos
    // intentos, cada uno con mas margen, es mas fiable que fiarse de uno.
    const confirmedGaps = first.gaps.filter((gap) => {
      const startSec = gap.anchorBeforeIdx !== null ? heard[gap.anchorBeforeIdx].end : 0;
      const endSec = gap.anchorAfterIdx !== null ? heard[gap.anchorAfterIdx].start : durationSec;
      for (const margin of [REHEAR_MARGIN_SEC, REHEAR_MARGIN_SEC * 2]) {
        const rehardWords = reheedWindow(
          wav, dir, whisperLang,
          startSec - margin,
          Math.min(durationSec, endSec + margin),
        );
        if (!isGapStillMissing(gap, rehardWords, numLang)) return false; // apareció: falso positivo
      }
      return true; // sigue faltando en las dos ventanas: hueco real
    });

    return { gaps: confirmedGaps, duplicates: first.duplicates, ok: confirmedGaps.length === 0 && first.duplicates.length === 0 };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
