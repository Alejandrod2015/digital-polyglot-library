/**
 * Narración single-voice (Moritz) para Traveler DE A0. Una sola voz para todas
 * las historias (decisión del usuario 2026-07-17). No pisa audio existente.
 * GATED (ElevenLabs). Uso:
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/_genFriendsDEStoryAudio.ts <slug>
 * Después: normalizeAudioPace --apply 2.4 <slug>
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { generateAndUploadMultiVoiceAudio } from "../src/lib/elevenlabs";
import { generateWordTimingsForStory } from "../src/lib/audioWordTimings";

const JOURNEY_ID = "cmt0a8vb1000m32p1x7r5ba28";
const NARRATOR = "Ww7Sq9tx9CCOiNOwWgsx"; // Moritz Morgenstern

async function run() {
  const slug = process.argv[2];
  if (!slug) { console.error("uso: _genFriendsDEStoryAudio.ts <slug>"); process.exit(1); }
  const prisma = new PrismaClient();
  const story = await prisma.journeyStory.findFirst({ where: { slug, journeyId: JOURNEY_ID }, include: { journey: true } });
  if (!story || !story.text || !story.title) { console.error("Story not found or missing text/title"); process.exit(1); }
  if (story.audioUrl) { console.error(`[${slug}] YA tiene audioUrl. Aborto para no pisar.`); process.exit(1); }
  await prisma.journeyStory.update({ where: { id: story.id }, data: { audioStatus: "generating" } });
  const result = await generateAndUploadMultiVoiceAudio({
    storyText: story.text, title: story.title, voiceMap: { narrator: NARRATOR },
    language: story.journey.language ?? "german", disableStitching: true,
  } as any);
  if (!result) throw new Error("multi-voice returned null");
  await prisma.journeyStory.update({
    where: { id: story.id },
    data: {
      audioUrl: result.url, audioSegments: result.audioSegments as any, audioFilename: result.filename,
      audioStatus: "ready", voiceId: NARRATOR,
      audioQaStatus: result.audioQa?.status ?? null, audioQaScore: result.audioQa?.score ?? null,
      audioQaNotes: result.audioQa?.notes?.join("\n") ?? null,
      ...(result.fragments?.length ? { audioFragments: result.fragments as object } : {}),
    },
  });
  console.log(`[${slug}] master (pre-pacing): ${result.url}`);
  try { await generateWordTimingsForStory(story.id); console.log(`[${slug}] alignment OK`); }
  catch (e: any) { console.warn(`[${slug}] alignment FAILED: ${e.message?.slice(0, 120)}`); }
  await prisma.$disconnect();
  console.log(`[${slug}] DONE. Next: NODE_OPTIONS=...react-server normalizeAudioPace --apply 2.4 ${slug}`);
}
run().catch((e) => { console.error("FATAL", e.message); process.exit(1); });
