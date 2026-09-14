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
import { checkCoverage, norm, type CoverageResult } from "./coverageCheckLib";

const WHISPER_CLI = "/opt/homebrew/bin/whisper-cli";
const MODEL = path.join(
  __dirname, "..", "scripts", "tts", "whisper-models", "ggml-small.bin"
);

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

export async function transcribeMaster(masterUrl: string): Promise<RawWord[]> {
  const dir = mkdtempSync(path.join(tmpdir(), "covcheck-"));
  try {
    const mp3 = path.join(dir, "a.mp3");
    const buf = Buffer.from(await (await fetch(masterUrl)).arrayBuffer());
    writeFileSync(mp3, buf);
    const wav = path.join(dir, "a.wav");
    execFileSync("ffmpeg", ["-v", "error", "-i", mp3, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", wav, "-y"]);
    const out = path.join(dir, "a");
    execFileSync(WHISPER_CLI, ["-m", MODEL, "-l", "fr", "-np", "-ml", "1", "-ojf", "-of", out, wav], { stdio: "pipe" });
    return parseWhisperJson(`${out}.json`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export async function checkMasterCoverage(masterUrl: string, referenceText: string): Promise<CoverageResult> {
  const heard = await transcribeMaster(masterUrl);
  const textWords = referenceText.split(/\s+/).map(norm).filter(Boolean);
  const heardWords = heard.map((w) => norm(w.text)).filter(Boolean);
  return checkCoverage(textWords, heardWords);
}
