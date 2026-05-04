import { config } from "dotenv";
import { execSync } from "child_process";
import { writeFileSync, readFileSync } from "fs";
import { uploadPublicObject } from "../src/lib/objectStorage";
import { DEFAULT_VOICE_SETTINGS, GERMAN_DIALOGUE_VOICES, softenPunctuationForTts } from "../src/lib/elevenlabs";

config({ path: ".env.local" });
config({ path: ".env" });

const SOPHIE_LINES = [
  "Guten Morgen, Frau Weber! Schön, Sie heute wieder zu sehen. Was darf es sein?",
  "Das macht zusammen vier Euro fünfzig. Möchten Sie noch etwas?",
  "Ja, wir haben noch sechs. Und der Käsekuchen ist auch sehr gut heute!",
].join(" ");

async function run() {
  const apiKey = process.env.ELEVENLABS_API_KEY!;
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${GERMAN_DIALOGUE_VOICES.enniah}`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      text: softenPunctuationForTts(SOPHIE_LINES),
      model_id: "eleven_multilingual_v2",
      voice_settings: { ...DEFAULT_VOICE_SETTINGS, stability: 0.9 },
    }),
  });
  if (!r.ok) { console.error(`tts failed ${r.status}`); process.exit(1); }
  const buf = Buffer.from(await r.arrayBuffer());

  writeFileSync("/tmp/sophie_raw.mp3", buf);
  execSync(
    'ffmpeg -y -loglevel error -i /tmp/sophie_raw.mp3 -af "dynaudnorm=g=5:f=250:p=0.9:m=10,loudnorm=I=-16:LRA=11:TP=-1.5" -codec:a libmp3lame -b:a 128k /tmp/sophie_norm.mp3'
  );
  const out = readFileSync("/tmp/sophie_norm.mp3");
  const filename = `samples/sophie_stability09_softened_${Date.now()}.mp3`;
  const u = await uploadPublicObject({ key: `media/generated/audio/${filename}`, body: out, contentType: "audio/mpeg" });
  console.log("Sample URL:", u?.url);
}

run().catch((e) => { console.error(e); process.exit(1); });
