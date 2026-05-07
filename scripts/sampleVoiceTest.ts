/**
 * Generate one short sample per character across the 3 dialogue stories with
 * the current DEFAULT_VOICE_SETTINGS (stability=0.7, speed=0.9, style=0,
 * use_speaker_boost=true). Lets the user audition the new settings without
 * paying to regenerate full stories.
 *
 * Output: each sample uploaded to R2 with a descriptive name; URLs printed.
 * Loudness is normalized via the same pipeline used for full stories so the
 * sample matches the final delivery.
 */

import { config } from "dotenv";
import { PrismaClient } from "../src/generated/prisma";
import {
  DEFAULT_VOICE_SETTINGS,
  GERMAN_DIALOGUE_VOICES,
  parseDialogueSegments,
} from "../src/lib/elevenlabs";
import { uploadPublicObject } from "../src/lib/objectStorage";

config({ path: ".env.local" });
config({ path: ".env" });

const V = GERMAN_DIALOGUE_VOICES;

// Reuse the voice assignments from the regen script.
const VOICE_ASSIGNMENTS: Record<string, Record<string, string>> = {
  "cafe-in-kreuzberg": {
    narrator: V.moritz,
    Anna: V.enniah,
    Tom: V.luca,
  },
  "beim-baecker-am-hackeschen-markt": {
    narrator: V.moritz,
    Sophie: V.enniah,
    "Frau Weber": V.eleonore,
    Lukas: V.luca,
  },
  "tomaten-vom-wochenmarkt": {
    narrator: V.moritz,
    Mira: V.enniah,
    "Herr Klein": V.luca,
    "Frau Tan": V.eleonore,
  },
};

async function ttsSampleBuffer(text: string, voiceId: string, apiKey: string): Promise<Buffer | null> {
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: DEFAULT_VOICE_SETTINGS,
    }),
  });
  if (!r.ok) {
    console.error(`tts failed ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return null;
  }
  return Buffer.from(await r.arrayBuffer());
}

async function normalizeLoudness(buffer: Buffer): Promise<Buffer> {
  try {
    const { writeFile, mkdtemp, rm, readFile } = await import("fs/promises");
    const { tmpdir } = await import("os");
    const path = await import("path");
    const { spawn } = await import("child_process");
    const dir = await mkdtemp(path.join(tmpdir(), "sample-"));
    try {
      const inPath = path.join(dir, "in.mp3");
      const outPath = path.join(dir, "out.mp3");
      await writeFile(inPath, buffer);
      await new Promise<void>((resolve, reject) => {
        const proc = spawn("ffmpeg", [
          "-y", "-loglevel", "error",
          "-i", inPath,
          "-af", "dynaudnorm=g=5:f=250:p=0.9:m=10,loudnorm=I=-16:LRA=11:TP=-1.5",
          "-codec:a", "libmp3lame", "-b:a", "128k",
          outPath,
        ]);
        let stderr = "";
        proc.stderr.on("data", (c) => { stderr += c.toString(); });
        proc.on("error", reject);
        proc.on("close", (code) => code === 0 ? resolve() : reject(new Error(stderr.slice(0, 300))));
      });
      return await readFile(outPath);
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  } catch (err) {
    console.warn("normalize skipped:", err instanceof Error ? err.message : err);
    return buffer;
  }
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[äöü]/g, (c) => ({ ä: "a", ö: "o", ü: "u" })[c]!).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function pickSampleLineForSpeaker(storyText: string, speaker: string): string | null {
  const segs = parseDialogueSegments(storyText);
  for (const s of segs) {
    if (s.speaker.toLowerCase() === speaker.toLowerCase()) {
      // Pick the first sentence of the first segment for this speaker so the
      // sample stays under ~10 seconds.
      const firstSentence = s.text.split(/(?<=[.!?])\s+/, 1)[0] ?? s.text;
      return firstSentence;
    }
  }
  return null;
}

async function run() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) { console.error("Missing ELEVENLABS_API_KEY"); process.exit(1); }

  const prisma = new PrismaClient();
  const results: { story: string; speaker: string; voiceId: string; url: string }[] = [];

  for (const [slug, voiceMap] of Object.entries(VOICE_ASSIGNMENTS)) {
    const story = await prisma.journeyStory.findFirst({ where: { slug } });
    if (!story?.text) { console.warn(`${slug} not found`); continue; }
    console.log(`\n=== ${slug} ===`);

    for (const [speaker, voiceId] of Object.entries(voiceMap)) {
      const line = pickSampleLineForSpeaker(story.text, speaker);
      if (!line) { console.warn(`  no line found for speaker '${speaker}'`); continue; }
      console.log(`  ${speaker.padEnd(12)} (${voiceId.slice(0, 8)}...): "${line.slice(0, 60)}..."`);

      const raw = await ttsSampleBuffer(line, voiceId, apiKey);
      if (!raw) continue;
      const normalized = await normalizeLoudness(raw);

      const filename = `samples/${slug}_${slugify(speaker)}_${Date.now()}.mp3`;
      const uploaded = await uploadPublicObject({
        key: `media/generated/audio/${filename}`,
        body: normalized,
        contentType: "audio/mpeg",
      });
      if (!uploaded?.url) { console.warn("  upload failed"); continue; }
      console.log(`    → ${uploaded.url}`);
      results.push({ story: slug, speaker, voiceId, url: uploaded.url });
    }
  }

  console.log("\n=== Sample URLs ===");
  for (const r of results) console.log(`${r.story} / ${r.speaker.padEnd(12)} → ${r.url}`);

  await prisma.$disconnect();
}

run().catch((err) => { console.error(err); process.exit(1); });
