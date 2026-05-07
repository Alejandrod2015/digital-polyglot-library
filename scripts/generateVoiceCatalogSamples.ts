/**
 * Generate one short German sample per voice in the German dialogue cast and
 * write the resulting MP3 to public/voice-samples/<safeVoiceId>.mp3 so it
 * appears in the Studio "Probar voces" gallery (StudioAudioClient.tsx).
 *
 * Uses the production DEFAULT_VOICE_SETTINGS (stability=0.7, speed=0.9, etc.)
 * so the gallery preview reflects exactly how a regenerated story will sound.
 */

import { config } from "dotenv";
import { writeFileSync } from "fs";
import path from "path";
import { DEFAULT_VOICE_SETTINGS, GERMAN_DIALOGUE_VOICES } from "../src/lib/elevenlabs";

config({ path: ".env.local" });
config({ path: ".env" });

const TEST_PHRASE =
  "Guten Morgen! Heute ist ein wunderschöner Tag in Berlin, am Hackeschen Markt. " +
  "Ich nehme einen Kaffee und ein frisches Brötchen, bitte.";

const PUBLIC_DIR = path.resolve(__dirname, "..", "public", "voice-samples");

function safeVoiceId(voiceId: string): string {
  return voiceId.replace(/[^a-zA-Z0-9_-]/g, "_");
}

async function tts(voiceId: string, apiKey: string): Promise<Buffer | null> {
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      text: TEST_PHRASE,
      model_id: "eleven_multilingual_v2",
      voice_settings: DEFAULT_VOICE_SETTINGS,
    }),
  });
  if (!r.ok) {
    console.error(`tts ${voiceId} failed ${r.status}`);
    return null;
  }
  return Buffer.from(await r.arrayBuffer());
}

async function normalizeLoudness(buffer: Buffer): Promise<Buffer> {
  try {
    const { writeFile, mkdtemp, rm, readFile } = await import("fs/promises");
    const { tmpdir } = await import("os");
    const p = await import("path");
    const { spawn } = await import("child_process");
    const dir = await mkdtemp(p.join(tmpdir(), "samp-"));
    try {
      const inPath = p.join(dir, "in.mp3");
      const outPath = p.join(dir, "out.mp3");
      await writeFile(inPath, buffer);
      await new Promise<void>((resolve, reject) => {
        const proc = spawn("ffmpeg", [
          "-y", "-loglevel", "error", "-i", inPath,
          "-af", "dynaudnorm=g=5:f=250:p=0.9:m=10,loudnorm=I=-16:LRA=11:TP=-1.5",
          "-codec:a", "libmp3lame", "-b:a", "128k", outPath,
        ]);
        let stderr = "";
        proc.stderr.on("data", (c) => { stderr += c.toString(); });
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

async function run() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) { console.error("Missing ELEVENLABS_API_KEY"); process.exit(1); }

  const voices: { name: string; id: string }[] = [
    { name: "Moritz Morgenstern",  id: GERMAN_DIALOGUE_VOICES.moritz },
    { name: "ENNIAH",              id: GERMAN_DIALOGUE_VOICES.enniah },
    { name: "Luca",                id: GERMAN_DIALOGUE_VOICES.luca },
    { name: "Eleonore",            id: GERMAN_DIALOGUE_VOICES.eleonore },
  ];

  for (const v of voices) {
    console.log(`\n${v.name} (${v.id})`);
    const raw = await tts(v.id, apiKey);
    if (!raw) continue;
    const normalized = await normalizeLoudness(raw);
    const catalogId = `elevenlabs/${v.id}`;
    const fname = `${safeVoiceId(catalogId)}.mp3`;
    const out = path.join(PUBLIC_DIR, fname);
    writeFileSync(out, normalized);
    console.log(`  → public/voice-samples/${fname} (${normalized.length} bytes)`);
  }
}

run().catch((err) => { console.error(err); process.exit(1); });
