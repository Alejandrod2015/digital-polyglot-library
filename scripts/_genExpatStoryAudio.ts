/**
 * Render multi-voice narration for the Expat C1 journey stories, replicando
 * scripts/generateJourneyStoryAudio.ts pero para JOURNEY_ID del Expat.
 * dialogueSpec ya está seteado (scripts/_setExpatDialogueSpecs.ts) y pasa
 * multiVoiceGuard. Pacing se aplica DESPUÉS con normalizeAudioPace.
 *
 * GATED: solo se ejecuta cuando el último mensaje del usuario dice "genera
 * audio". Usage:
 *   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/_genExpatStoryAudio.ts <slug>
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { generateAndUploadMultiVoiceAudio } from "../src/lib/elevenlabs";
import { generateWordTimingsForStory } from "../src/lib/audioWordTimings";
import { multiVoiceGuardError } from "../src/lib/multiVoiceGuard";

const JOURNEY_ID = "cmr92f0qz000032ff1dfd4fgx";

async function run() {
  const slug = process.argv[2];
  if (!slug) { console.error("uso: _genExpatStoryAudio.ts <slug>"); process.exit(1); }
  const prisma = new PrismaClient();
  const story = await prisma.journeyStory.findFirst({ where: { slug, journeyId: JOURNEY_ID }, include: { journey: true } });
  if (!story || !story.text || !story.title) { console.error("Story not found or missing text/title"); process.exit(1); }
  if (story.audioUrl) { console.error(`[${slug}] YA tiene audioUrl. Aborto para no pisar.`); process.exit(1); }
  const guardError = multiVoiceGuardError({ storyText: story.text, dialogueSpec: story.dialogueSpec });
  if (guardError) { console.error("multiVoiceGuard:", guardError); process.exit(1); }
  type Seg = { speaker: string; voice: string; text: string };
  const spec = story.dialogueSpec as Seg[] | null;
  if (!Array.isArray(spec) || spec.length === 0) { console.error("no dialogueSpec"); process.exit(1); }
  const voiceMap: Record<string, string> = {};
  for (const seg of spec) if (seg.speaker && seg.voice) voiceMap[seg.speaker.toLowerCase()] = seg.voice;
  console.log(`[${slug}] speakers->voice:`, voiceMap);
  await prisma.journeyStory.update({ where: { id: story.id }, data: { audioStatus: "generating" } });
  const result = await generateAndUploadMultiVoiceAudio({
    storyText: story.text, title: story.title, voiceMap,
    language: story.journey.language ?? undefined, disableStitching: true,
  });
  if (!result) throw new Error("multi-voice returned null");
  await prisma.journeyStory.update({
    where: { id: story.id },
    data: {
      audioUrl: result.url, audioSegments: result.audioSegments as any, audioFilename: result.filename,
      audioStatus: "ready", voiceId: result.speakerVoiceMap?.narrator ?? voiceMap.narrator ?? null,
      audioQaStatus: result.audioQa?.status ?? null, audioQaScore: result.audioQa?.score ?? null,
      audioQaNotes: result.audioQa?.notes?.join("\n") ?? null,
      ...(result.fragments?.length ? { audioFragments: result.fragments as object } : {}),
    },
  });
  console.log(`[${slug}] dry master: ${result.url}`);
  try { await generateWordTimingsForStory(story.id); console.log(`[${slug}] alignment OK`); }
  catch (e: any) { console.warn(`[${slug}] alignment FAILED: ${e.message?.slice(0, 120)}`); }
  await prisma.$disconnect();
  console.log(`[${slug}] DONE (pre-pacing). Next: normalizeAudioPace --apply <val> ${slug}`);
}
run().catch((e) => { console.error("FATAL", e.message); process.exit(1); });
