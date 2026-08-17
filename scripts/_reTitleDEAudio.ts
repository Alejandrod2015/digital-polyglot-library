/**
 * Re-sintetiza SOLO el título (fragmento 0) de una historia Friends DE con una
 * llamada DIRECTA a ElevenLabs que PRESERVA la puntuación de énfasis (el
 * pipeline normal la borra: softenPunctuationForTts convierte "!"->"."), y con
 * estabilidad más alta para una lectura firme de encabezado. El título que se
 * guarda/muestra queda LIMPIO. GATED. Uso:
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/_reTitleDEAudio.ts <slug> [punct] [stability]
 *   punct por defecto "!" ; stability por defecto 0.6
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { replaceSectionAndRebuild } from "../src/lib/audioEditorSections";
import { generateWordTimingsForStory } from "../src/lib/audioWordTimings";

const MORITZ = "Ww7Sq9tx9CCOiNOwWgsx";
const MODEL = "eleven_multilingual_v2";

async function ttsRaw(text: string, stability: number, speed: number, style: number, endStop: boolean): Promise<Buffer> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("no ELEVENLABS_API_KEY");
  const body: Record<string, unknown> = {
    text,                                     // RAW: conserva la puntuación tal cual
    model_id: MODEL,
    voice_settings: { stability, similarity_boost: 0.8, style, speed, use_speaker_boost: true },
    apply_text_normalization: "on",
  };
  if (!endStop) body.next_text = " ";        // endStop -> fin de enunciado (cierra)
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
  const punct = process.argv[3] ?? ".";
  const stability = process.argv[4] ? Number(process.argv[4]) : 0.7;
  const speed = process.argv[5] ? Number(process.argv[5]) : 0.8;
  const style = process.argv[6] ? Number(process.argv[6]) : 0;
  const endStop = process.argv[7] !== "cont";   // recipe: fin de enunciado por defecto
  if (!slug) { console.error("uso: _reTitleDEAudio.ts <slug> [punct] [stability] [speed] [style] [cont]"); process.exit(1); }
  const prisma = new PrismaClient();
  const s = await prisma.journeyStory.findFirst({ where: { slug, journeyId: "cmroo4w4v0000324ow1o9qlcp" }, select: { id: true, title: true, audioUrl: true } });
  if (!s?.title || !s.audioUrl) { console.error("sin título o sin audio"); process.exit(1); }
  const cleanTitle = s.title.trim().replace(/[.!…]+$/, "");
  const ttsText = cleanTitle + punct;   // ElevenLabs (crudo, con énfasis)
  const fragText = cleanTitle + ".";    // DB/align (limpio)
  console.log(`[${slug}] TTS="${ttsText}" stab=${stability} speed=${speed} style=${style} endStop=${endStop}  frag="${fragText}"`);
  const buf = await ttsRaw(ttsText, stability, speed, style, endStop);
  const res = await replaceSectionAndRebuild({ storyId: s.id, fragmentIndex: 0, newSectionBuffer: buf, newText: fragText, normalizeSection: true });
  console.log(`[${slug}] new master: ${res.audioUrl}`);
  try { await generateWordTimingsForStory(s.id); console.log(`[${slug}] re-align OK`); }
  catch (e: any) { console.warn(`[${slug}] align: ${e.message?.slice(0, 80)}`); }
  await prisma.$disconnect();
}
run().catch((e) => { console.error("FATAL", e.message); process.exit(1); });
