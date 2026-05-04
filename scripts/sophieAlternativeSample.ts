/**
 * Test alternative ElevenLabs female DE voices for Sophie (the baker in
 * beim-baecker-am-hackeschen-markt). ENNIAH at stability=0.9 + the punctuation
 * softener still over-emotes on warm greetings; we want a voice with a more
 * neutral baseline so the warmth comes from the words, not the synthesis.
 *
 * Generates 1 sample per candidate voice using Sophie's three exclamation-heavy
 * lines, normalized to -16 LUFS. URLs printed at the end.
 */

import { config } from "dotenv";
import { execSync } from "child_process";
import { writeFileSync, readFileSync } from "fs";
import { uploadPublicObject } from "../src/lib/objectStorage";
import { DEFAULT_VOICE_SETTINGS, softenPunctuationForTts } from "../src/lib/elevenlabs";

config({ path: ".env.local" });
config({ path: ".env" });

const SOPHIE_LINES = [
  "Guten Morgen, Frau Weber! Schön, Sie heute wieder zu sehen. Was darf es sein?",
  "Das macht zusammen vier Euro fünfzig. Möchten Sie noch etwas?",
  "Ja, wir haben noch sechs. Und der Käsekuchen ist auch sehr gut heute!",
].join(" ");

// Native-DE female candidates from the shared library, picked for "neutral
// host" baseline rather than expressive narrator.
const CANDIDATES: { id: string; label: string }[] = [
  { id: "cllvQaMvj0ZKxH88HGEn", label: "gesa_tess" },     // F middle, trustworthy host
  { id: "9iYBWBbTzTDIt6imiMxp", label: "daien" },         // F young, neutral
  { id: "8SdTD5IMgFKT1jp7JbPC", label: "eleonore_narrator" }, // F middle, narrator (already in catalog)
];

async function tts(voiceId: string, apiKey: string): Promise<Buffer | null> {
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      text: softenPunctuationForTts(SOPHIE_LINES),
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

async function run() {
  const apiKey = process.env.ELEVENLABS_API_KEY!;
  for (const c of CANDIDATES) {
    const raw = await tts(c.id, apiKey);
    if (!raw) continue;
    writeFileSync(`/tmp/sophie_${c.label}.mp3`, raw);
    execSync(
      `ffmpeg -y -loglevel error -i /tmp/sophie_${c.label}.mp3 -af "dynaudnorm=g=5:f=250:p=0.9:m=10,loudnorm=I=-16:LRA=11:TP=-1.5" -codec:a libmp3lame -b:a 128k /tmp/sophie_${c.label}_norm.mp3`
    );
    const out = readFileSync(`/tmp/sophie_${c.label}_norm.mp3`);
    const filename = `samples/sophie_alt_${c.label}_${Date.now()}.mp3`;
    const u = await uploadPublicObject({ key: `media/generated/audio/${filename}`, body: out, contentType: "audio/mpeg" });
    console.log(`${c.label.padEnd(20)} → ${u?.url}`);
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
