/**
 * Re-sintetiza SOLO el título (fragmento 0) de una historia Friends CO con una
 * llamada DIRECTA a ElevenLabs que PRESERVA la puntuación y usa fin-de-enunciado
 * (sin next_text) para que el título CIERRE y no suene a pregunta. Narrador CO
 * Hernando. El título mostrado queda limpio. GATED. Uso:
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/_reTitleCOAudio.ts <slug> [punct="."] [stability=0.8] [speed=0.9] [style=0] [cont]
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { replaceSectionAndRebuild } from "../src/lib/audioEditorSections";
import { generateWordTimingsForStory } from "../src/lib/audioWordTimings";

const NARRATOR = "yHD4CsKkghm19ToGLJEC"; // Narrator CO - Hernando
const MODEL = "eleven_multilingual_v2";
const JOURNEY_ID = "cmrpm0tra000032vgxcs33wrb";

async function ttsRaw(text: string, stability: number, speed: number, style: number, endStop: boolean): Promise<Buffer> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("no ELEVENLABS_API_KEY");
  const body: Record<string, unknown> = {
    text, model_id: MODEL,
    voice_settings: { stability, similarity_boost: 0.8, style, speed, use_speaker_boost: true },
    apply_text_normalization: "on",
  };
  if (!endStop) body.next_text = " ";
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${NARRATOR}`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json", accept: "audio/mpeg" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`TTS ${res.status}: ${(await res.text()).slice(0, 160)}`);
  return Buffer.from(await res.arrayBuffer());
}

async function run() {
  const slug = process.argv[2];
  const punct = process.argv[3] ?? ".";
  const stability = process.argv[4] ? Number(process.argv[4]) : 0.8;
  const speed = process.argv[5] ? Number(process.argv[5]) : 0.9;
  const style = process.argv[6] ? Number(process.argv[6]) : 0;
  const endStop = process.argv[7] !== "cont";
  if (!slug) { console.error("uso: _reTitleCOAudio.ts <slug> [punct] [stability] [speed] [style] [cont]"); process.exit(1); }
  const prisma = new PrismaClient();
  const s = await prisma.journeyStory.findFirst({ where: { slug, journeyId: JOURNEY_ID }, select: { id: true, title: true, audioUrl: true } });
  if (!s?.title || !s.audioUrl) { console.error("sin título o sin audio"); process.exit(1); }
  const cleanTitle = s.title.trim().replace(/[.!…]+$/, "");
  const ttsText = cleanTitle + punct;
  const fragText = cleanTitle + ".";
  console.log(`[${slug}] TTS="${ttsText}" stab=${stability} speed=${speed} style=${style} endStop=${endStop}`);
  const buf = await ttsRaw(ttsText, stability, speed, style, endStop);
  const res = await replaceSectionAndRebuild({ storyId: s.id, fragmentIndex: 0, newSectionBuffer: buf, newText: fragText, normalizeSection: true });
  console.log(`[${slug}] new master: ${res.audioUrl}`);
  try { await generateWordTimingsForStory(s.id); console.log(`[${slug}] re-align OK`); }
  catch (e: any) { console.warn(`[${slug}] align: ${e.message?.slice(0, 80)}`); }
  await prisma.$disconnect();
}
run().catch((e) => { console.error("FATAL", e.message); process.exit(1); });
