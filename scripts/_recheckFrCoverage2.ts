// Igual que _recheckFrCoverage.ts pero instrumentado: cuenta los pases -ot
// que hizo falta y la cobertura de duracion real, para el informe al chat de
// planificacion. Solo lectura.
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { execFileSync } from "child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { PrismaClient } from "../src/generated/prisma";
import { checkCoverage, norm } from "./coverageCheckLib";
import { transcribeWithRetries } from "./coverageWhisperCheck";

const WHISPER_CLI = "/opt/homebrew/bin/whisper-cli";
const MODEL = path.join(__dirname, "tts", "whisper-models", "ggml-small.bin");

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

function getAudioDurationMs(wav: string): number {
  const out = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", wav]);
  return Math.round(parseFloat(out.toString().trim()) * 1000);
}

async function transcribeInstrumented(masterUrl: string): Promise<{ words: RawWord[]; passes: number; durationMs: number; lastEndMs: number }> {
  const dir = mkdtempSync(path.join(tmpdir(), "covcheck2-"));
  try {
    const mp3 = path.join(dir, "a.mp3");
    const buf = Buffer.from(await (await fetch(masterUrl)).arrayBuffer());
    writeFileSync(mp3, buf);
    const wav = path.join(dir, "a.wav");
    execFileSync("ffmpeg", ["-v", "error", "-i", mp3, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", wav, "-y"]);
    const durationMs = getAudioDurationMs(wav);
    let pass = 0;
    const words = await transcribeWithRetries(async (offsetMs) => {
      pass++;
      const out = path.join(dir, `a_${pass}`);
      const args = ["-m", MODEL, "-l", "fr", "-np", "-ml", "1"];
      if (offsetMs > 0) args.push("-ot", String(Math.round(offsetMs)));
      args.push("-ojf", "-of", out, wav);
      execFileSync(WHISPER_CLI, args, { stdio: "pipe" });
      return parseWhisperJson(`${out}.json`);
    }, durationMs);
    const lastEndMs = words.length ? Math.round(words[words.length - 1].end * 1000) : 0;
    return { words, passes: pass, durationMs, lastEndMs };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const p = new PrismaClient();
const JOURNEYS = [
  { label: "FR A2", id: "cmu04ereh000732z7px7naqa2" },
  { label: "FR B1", id: "cmu0doigc0007j8e292tycths" },
];

async function main() {
  for (const j of JOURNEYS) {
    const stories = await p.journeyStory.findMany({
      where: { journeyId: j.id },
      orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
      select: { title: true, slug: true, text: true, audioUrl: true, topic: true, slotIndex: true },
    });
    console.log(`\n=== ${j.label}, ${stories.length} historias ===`);
    for (const s of stories) {
      if (!s.audioUrl || !s.text) { console.log(`SKIP ${s.title ?? s.slug}`); continue; }
      const t0 = Date.now();
      try {
        const { words, passes, durationMs, lastEndMs } = await transcribeInstrumented(s.audioUrl);
        const textWords = s.text.split(/\s+/).map(norm).filter(Boolean);
        const heardWords = words.map((w) => norm(w.text)).filter(Boolean);
        const result = checkCoverage(textWords, heardWords);
        const secs = ((Date.now() - t0) / 1000).toFixed(1);
        const cover = durationMs - lastEndMs <= 1500 ? "si" : "no";
        console.log(`--- ${j.label} | ${s.title ?? s.slug} | dur=${(durationMs / 1000).toFixed(1)}s lastEnd=${(lastEndMs / 1000).toFixed(1)}s cobertura=${cover} pases=${passes} (${secs}s) ---`);
        console.log(`ok=${result.ok} gaps=${result.gaps.length} dups=${result.duplicates.length}`);
        for (const g of result.gaps) console.log(`  GAP: "${g.textWords.join(" ")}"`);
        for (const d of result.duplicates) console.log(`  DUP: "${d.words.join(" ")}" heardCount=${d.heardCount} textCount=${d.textCount}`);
      } catch (e) {
        console.log(`ERROR ${s.title ?? s.slug}: ${e instanceof Error ? e.message : e}`);
      }
    }
  }
  await p.$disconnect();
}
main().catch(async (e) => { console.error(e); await p.$disconnect(); process.exit(1); });
