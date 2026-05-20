/**
 * Quick diagnostic: for the Quartieri Spagnoli story, build the
 * practice items the way the app does, render each clip the way the
 * server endpoint does (Modal + 150 ms trailing silence), transcribe
 * each mp3 with whisper, and print a table.
 *
 *   "sentence sent"           | "transcript heard" | dur(s) | match?
 *
 * If "transcript heard" does not match "sentence sent" exactly, we
 * know whether the audio gets truncated, extended, or contaminated
 * with extra words.
 */
import { prisma } from "../src/lib/prisma";
import { buildPracticeItemsFromStory } from "../src/lib/storyPracticeItems";
import { buildPracticeSession } from "../src/lib/practiceExercises";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REPO = "/Users/alejandrodelcarpio/digital-polyglot-library";
const WHISPER_MODEL = `${REPO}/scripts/tts/whisper-models/ggml-small.bin`;
const VOICE_ID = "piper/it_IT-paola-medium";
const PAD_SEC = 0.15;

async function modalSynth(text: string, filename: string): Promise<string> {
  const url = process.env.STUDIO_AUDIO_URL!;
  const token = process.env.STUDIO_AUDIO_TOKEN!;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ _token: token, text, voiceId: VOICE_ID, filename }),
  });
  if (!res.ok) throw new Error(`Modal ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { url: string };
  return json.url;
}

function ffmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn("ffmpeg", args);
    let err = "";
    p.stderr.on("data", (c) => { err += c.toString(); });
    p.on("close", (code) => code === 0 ? resolve() : reject(new Error(err.slice(0, 200))));
  });
}

async function downloadAndPad(url: string): Promise<{ path: string; durSec: number }> {
  const work = mkdtempSync(join(tmpdir(), "diag-"));
  const raw = join(work, "raw.mp3");
  const padded = join(work, "padded.mp3");
  const r = await fetch(url);
  writeFileSync(raw, Buffer.from(await r.arrayBuffer()));
  await ffmpeg([
    "-y", "-loglevel", "error",
    "-i", raw,
    "-af", `apad=pad_dur=${PAD_SEC}`,
    "-codec:a", "libmp3lame", "-b:a", "128k",
    padded,
  ]);
  // Get duration via ffprobe
  const probe = await new Promise<string>((resolve, reject) => {
    const p = spawn("ffprobe", ["-v", "error", "-show_entries", "stream=duration", "-of", "default=noprint_wrappers=1:nokey=1", padded]);
    let out = ""; p.stdout.on("data", (c) => { out += c.toString(); });
    p.on("close", (code) => code === 0 ? resolve(out.trim()) : reject(new Error("ffprobe fail")));
  });
  return { path: padded, durSec: parseFloat(probe) };
}

async function transcribe(mp3Path: string): Promise<string> {
  // Convert mp3 → wav 16k mono (whisper.cpp expects wav)
  const wav = mp3Path.replace(/\.mp3$/, ".wav");
  await ffmpeg(["-y", "-loglevel", "error", "-i", mp3Path, "-ar", "16000", "-ac", "1", wav]);
  return new Promise((resolve, reject) => {
    const p = spawn("whisper-cli", [
      "-m", WHISPER_MODEL,
      "-l", "it",
      "-nt", // no timestamps
      "-otxt",
      wav,
    ]);
    let stdout = "", stderr = "";
    p.stdout.on("data", (c) => { stdout += c.toString(); });
    p.stderr.on("data", (c) => { stderr += c.toString(); });
    p.on("close", (code) => {
      if (code !== 0) return reject(new Error(`whisper exit ${code}: ${stderr.slice(-200)}`));
      // Output is in stdout; clean it
      const text = stdout
        .split("\n")
        .filter((line) => line.trim() && !line.startsWith("["))
        .join(" ")
        .trim();
      resolve(text);
    });
  });
}

async function main() {
  const story = await prisma.journeyStory.findFirst({
    where: { slug: "quartieri-spagnoli-un-caff" },
    include: { journey: true },
  });
  if (!story || !story.text || !story.vocab) {
    console.error("story not found / missing data");
    return;
  }

  const items = buildPracticeItemsFromStory({
    title: story.title!,
    slug: story.slug!,
    text: story.text,
    language: story.journey.language,
    sourcePath: `journey/${story.id}`,
    vocab: (story.vocab as object[]) as never,
  });

  // Replicate the mobile flow: backend returns items, mobile runs
  // buildPracticeSession to derive exercises. clip.sentence is what
  // travels to /api/practice/sentence-tts.
  const exercises = buildPracticeSession(items, "context");
  console.log(`Built ${exercises.length} context exercises (fill-the-blank).\n`);

  type Row = { word: string; sent: string; dur: number; heard: string };
  const rows: Row[] = [];

  for (let i = 0; i < exercises.length; i++) {
    const ex = exercises[i];
    if (ex.type !== "fill_blank" || !ex.audioClip?.sentence) continue;
    const sent = ex.audioClip.sentence;
    const word = ex.answer ?? "?";
    const filename = `diag_quartieri_${i}`;
    try {
      console.log(`[${i + 1}/${exercises.length}] "${word}" → "${sent.slice(0, 60)}"`);
      const url = await modalSynth(sent, filename);
      const { path, durSec } = await downloadAndPad(url);
      const heard = await transcribe(path);
      rows.push({ word, sent, dur: durSec, heard });
      rmSync(path.replace(/\/[^/]+$/, ""), { recursive: true, force: true });
    } catch (err) {
      console.error(`  FAIL: ${err instanceof Error ? err.message : err}`);
      rows.push({ word, sent, dur: 0, heard: `ERROR: ${err}` });
    }
  }

  // Full-text table (no truncation)
  console.log("\n\n=== FULL TABLE ===\n");
  for (const r of rows) {
    console.log(`▸ word: ${r.word}    dur=${r.dur.toFixed(2)}s`);
    console.log(`   SENT (${r.sent.length} chars): ${JSON.stringify(r.sent)}`);
    console.log(`   HEARD: ${JSON.stringify(r.heard)}`);
    console.log("");
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
