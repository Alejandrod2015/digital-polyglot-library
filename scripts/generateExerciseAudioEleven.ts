/**
 * Genera el audio de los ejercicios de práctica con ElevenLabs, voz del
 * NARRADOR de la historia (spanish-latam = andreti). Sobrescribe los clips
 * Piper previos. Settings sin-aire (next_text=" ", DEFAULT_VOICE_SETTINGS,
 * sin previous_text) + atempo 0.94 + loudnorm.
 *
 * Usage: tsx scripts/generateExerciseAudioEleven.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { spawn } from "child_process";
import os from "os";
import path from "path";
import fs from "fs";
import { PrismaClient } from "../src/generated/prisma";
import { preparePracticeSentenceForTts } from "../src/lib/sanitizePracticeSentence";
import { softenPunctuationForTts, DEFAULT_VOICE_SETTINGS, ELEVENLABS_MODEL_V2 } from "../src/lib/elevenlabs";
import { uploadPublicObject } from "../src/lib/objectStorage";

// Narrador por historia. spanish-latam journey → andreti.
const NARRATOR_BY_SLUG: Record<string, string> = {
  "la-promesa-del-mole": "JW8DGEuLp9WxIS5IdxMM",
  "humo-en-la-cocina": "JW8DGEuLp9WxIS5IdxMM",
};

function ff(args: string[]): Promise<void> {
  return new Promise((res, rej) => {
    const p = spawn("ffmpeg", args);
    let e = "";
    p.stderr.on("data", (c) => (e += c));
    p.on("close", (c) => (c === 0 ? res() : rej(new Error(e.slice(-200)))));
  });
}

async function synthOne(text: string, voiceId: string, apiKey: string, dir: string, id: string): Promise<Buffer | null> {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      text: softenPunctuationForTts(text),
      model_id: ELEVENLABS_MODEL_V2,
      voice_settings: DEFAULT_VOICE_SETTINGS,
      next_text: " ",
    }),
  });
  if (!res.ok) {
    console.log(`  ✗ EL ${res.status}: ${(await res.text()).slice(0, 120)}`);
    return null;
  }
  const raw = path.join(dir, `${id}_raw.mp3`);
  const out = path.join(dir, `${id}_out.mp3`);
  fs.writeFileSync(raw, Buffer.from(await res.arrayBuffer()));
  await ff(["-y", "-loglevel", "error", "-i", raw, "-af", "atempo=0.94,loudnorm=I=-16:LRA=11:TP=-1.5", "-c:a", "libmp3lame", "-b:a", "192k", out]);
  return fs.readFileSync(out);
}

async function run() {
  const apiKey = process.env.ELEVENLABS_API_KEY!;
  const prisma = new PrismaClient();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "exel-"));
  for (const slug of Object.keys(NARRATOR_BY_SLUG)) {
    const voiceId = NARRATOR_BY_SLUG[slug];
    const story = await prisma.journeyStory.findFirst({
      where: { slug },
      select: { id: true, practiceSet: { select: { exercises: { select: { id: true, word: true, sentence: true }, orderBy: { orderIndex: "asc" } } } } },
    });
    const ex = story?.practiceSet?.exercises ?? [];
    console.log(`\n=== ${slug}: ${ex.length} ejercicios (narrador ${voiceId}) ===`);
    let ok = 0, skip = 0, fail = 0;
    for (const e of ex) {
      const raw = (e.sentence ?? "").trim();
      if (!raw) { skip++; continue; }
      const tts = preparePracticeSentenceForTts(raw, e.word ?? "");
      if (!tts.trim()) { skip++; continue; }
      try {
        const buf = await synthOne(tts, voiceId, apiKey, dir, e.id);
        if (!buf) { fail++; continue; }
        const up = await uploadPublicObject({ key: `media/generated/audio/practice-el-${e.id}-${Date.now()}.mp3`, body: buf, contentType: "audio/mpeg" });
        if (!up) { fail++; continue; }
        await prisma.storyPracticeExercise.update({ where: { id: e.id }, data: { audioUrl: up.url } });
        ok++;
        if (ok % 5 === 0) console.log(`  ...${ok} listos`);
      } catch (err) { fail++; console.log(`  ✗ ${err instanceof Error ? err.message : err}`); }
    }
    console.log(`  ${slug}: ok=${ok} skip=${skip} fail=${fail}`);
  }
  await prisma.$disconnect();
  console.log("\nDone.");
}
run().catch((e) => { console.error(e); process.exit(1); });
