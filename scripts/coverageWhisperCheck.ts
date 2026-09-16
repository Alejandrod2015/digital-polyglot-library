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
import { checkCoverage, norm, type CoverageResult, type NumberLang } from "./coverageCheckLib";

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
// Ampliado el 2026-09-16 para italiano (Friends IT A0): sin masters reales
// todavia que probar en seco (0 historias narradas), a diferencia del aleman
// (probado contra 3 masters del Friends DE C1 ya publicado). "-l it" es el
// codigo whisper.cpp estandar; se revisa contra la primera muestra real.
const WHISPER_LANG: Record<string, string> = { german: "de", italian: "it" };
export function whisperLangFor(journeyLanguage?: string | null): string {
  return (journeyLanguage && WHISPER_LANG[journeyLanguage]) || "fr";
}
export function numberLangFor(journeyLanguage?: string | null): NumberLang {
  if (journeyLanguage === "german") return "de";
  if (journeyLanguage === "italian") return "it";
  return "fr";
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

export async function transcribeMaster(masterUrl: string, whisperLang = "fr"): Promise<RawWord[]> {
  const dir = mkdtempSync(path.join(tmpdir(), "covcheck-"));
  try {
    const mp3 = path.join(dir, "a.mp3");
    const buf = Buffer.from(await (await fetch(masterUrl)).arrayBuffer());
    writeFileSync(mp3, buf);
    const wav = path.join(dir, "a.wav");
    execFileSync("ffmpeg", ["-v", "error", "-i", mp3, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", wav, "-y"]);
    const durationMs = getAudioDurationMs(wav);
    let pass = 0;
    return await transcribeWithRetries(async (offsetMs) => {
      const out = path.join(dir, `a_${pass++}`);
      const args = ["-m", MODEL, "-l", whisperLang, "-np", "-ml", "1"];
      if (offsetMs > 0) args.push("-ot", String(Math.round(offsetMs)));
      args.push("-ojf", "-of", out, wav);
      execFileSync(WHISPER_CLI, args, { stdio: "pipe" });
      return parseWhisperJson(`${out}.json`);
    }, durationMs);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * `journeyLanguage` es el `Journey.language` ("german", "french", ...);
 * decide el `-l` de whisper y la tabla de numeros (ver whisperLangFor /
 * numberLangFor arriba). Sin argumento, frances: el comportamiento de
 * siempre para los journeys que ya llamaban esto sin idioma.
 */
export async function checkMasterCoverage(
  masterUrl: string,
  referenceText: string,
  journeyLanguage?: string | null
): Promise<CoverageResult> {
  const heard = await transcribeMaster(masterUrl, whisperLangFor(journeyLanguage));
  const textWords = referenceText.split(/\s+/).map(norm).filter(Boolean);
  const heardWords = heard.map((w) => norm(w.text)).filter(Boolean);
  return checkCoverage(textWords, heardWords, numberLangFor(journeyLanguage));
}
