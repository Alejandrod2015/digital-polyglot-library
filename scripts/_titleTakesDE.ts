/**
 * Genera N TOMAS del título de una historia Friends DE (mismos settings, azar de
 * ElevenLabs) y las sube como clips sueltos para audicionar. NO empalma nada:
 * el usuario elige la mejor por número y luego se empalma con _spliceTitleTakeDE.
 * GATED. Uso:
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/_titleTakesDE.ts <slug> [n] [stability] [speed] [style]
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { uploadPublicObject } from "../src/lib/objectStorage";
import * as fs from "fs";

const MORITZ = "Ww7Sq9tx9CCOiNOwWgsx";
const MODEL = "eleven_multilingual_v2";

async function ttsRaw(text: string, stability: number, speed: number, style: number, endStop: boolean): Promise<Buffer> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("no ELEVENLABS_API_KEY");
  const body: Record<string, unknown> = {
    text, model_id: MODEL,
    voice_settings: { stability, similarity_boost: 0.8, style, speed, use_speaker_boost: true },
    apply_text_normalization: "on",
  };
  // endStop: NO next_text -> el modelo trata el título como FIN de enunciado
  // (entonación que cae y cierra). Sin endStop, next_text=" " (boundary de
  // continuación) deja la frase "en suspenso".
  if (!endStop) body.next_text = " ";
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${MORITZ}`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json", accept: "audio/mpeg" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`TTS ${res.status}: ${(await res.text()).slice(0, 160)}`);
  return Buffer.from(await res.arrayBuffer());
}

async function run() {
  const slug = process.argv[2];
  const n = process.argv[3] ? Number(process.argv[3]) : 4;
  const stability = process.argv[4] ? Number(process.argv[4]) : 0.7;
  const speed = process.argv[5] ? Number(process.argv[5]) : 0.8;
  const style = process.argv[6] ? Number(process.argv[6]) : 0;
  const endStop = process.argv[7] === "end";
  if (!slug) { console.error("uso: _titleTakesDE.ts <slug> [n] [stability] [speed] [style] [end]"); process.exit(1); }
  const prisma = new PrismaClient();
  const s = await prisma.journeyStory.findFirst({ where: { slug, journeyId: "cmroo4w4v0000324ow1o9qlcp" }, select: { title: true } });
  await prisma.$disconnect();
  if (!s?.title) { console.error("sin título"); process.exit(1); }
  const ttsText = s.title.trim().replace(/[.!…]+$/, "") + ".";
  const takes: string[] = [];
  for (let i = 1; i <= n; i++) {
    const buf = await ttsRaw(ttsText, stability, speed, style, endStop);
    const up = await uploadPublicObject({ key: `media/generated/audio/titletakes/${slug}_t${i}_${Date.now()}.mp3`, body: buf, contentType: "audio/mpeg" });
    if (up?.url) { takes.push(up.url); console.log(`take${i}: ${up.url}`); }
  }
  const outPath = `/tmp/titletakes_${slug}.json`;
  fs.writeFileSync(outPath, JSON.stringify({ slug, title: s.title, stability, speed, style, takes }, null, 1));
  console.log(`OK ${takes.length} takes -> ${outPath}`);
}
run().catch((e) => { console.error("FATAL", e.message); process.exit(1); });
