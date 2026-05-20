/**
 * Generate 5 candidate "perfect score" jingles via ElevenLabs Sound
 * Generation, upload each to R2, print direct mp3 URLs the user can
 * open in any browser and play with one click. The chosen file ends
 * up in apps/mobile/assets/sounds/practice-perfect.mp3.
 */
import { uploadPublicObject } from "../src/lib/objectStorage";

const PROMPTS: { tag: string; text: string; duration: number }[] = [
  { tag: "glock-cascade",      text: "Cheerful glockenspiel ascending arpeggio in C major spanning two octaves, sparkling bell tones with shimmering decay tail, celebratory achievement jingle, no voice, no music backing", duration: 3.5 },
  { tag: "celesta-bloom",      text: "Bright celesta ascending cascade in C major, multi-note flourish followed by a sustained high bell chord, magical sparkle, joyful and impactful, no voice, no music backing", duration: 3.5 },
  { tag: "music-box-flourish", text: "Music box arpeggio rising in C major, twinkling melody with shimmer tail, nostalgic and triumphant, no voice, no music backing, single jingle", duration: 4 },
  { tag: "tubular-bells",      text: "Tubular bells ascending arpeggio with rich resonance, layered chime hits in C major, satisfying sustained ring, achievement unlocked feel, no voice, no music backing", duration: 4 },
  { tag: "layered-glock",      text: "Layered glockenspiel and high celesta, ascending arpeggio in C major with low bell anchor and high sparkles on top, rich and celebratory, no voice, no music backing", duration: 3.5 },
];

async function generate(text: string, duration: number): Promise<Buffer> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("ELEVENLABS_API_KEY missing");
  const res = await fetch("https://api.elevenlabs.io/v1/sound-generation", {
    method: "POST",
    headers: {
      "xi-api-key": key,
      "Content-Type": "application/json",
      "Accept": "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      duration_seconds: duration,
      prompt_influence: 0.5,
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`ElevenLabs ${res.status}: ${detail.slice(0, 200)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  const ts = Date.now();
  console.log("Generating 5 candidates via ElevenLabs Sound Generation…\n");
  for (const { tag, text, duration } of PROMPTS) {
    try {
      console.log(`→ ${tag}: "${text.slice(0, 60)}…"`);
      const buf = await generate(text, duration);
      const key = `media/preview/perfect-${tag}-${ts}.mp3`;
      const uploaded = await uploadPublicObject({
        key,
        body: buf,
        contentType: "audio/mpeg",
      });
      console.log(`   ${uploaded?.url ?? "upload failed"}`);
      console.log("");
    } catch (err) {
      console.error(`   FAIL: ${err instanceof Error ? err.message : err}\n`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
