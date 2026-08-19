/**
 * Renderiza la narración de UNA historia del Traveler PT-BR A1, replicando
 * `scripts/_genA1SpainStoryAudio.ts`: mismo `disableStitching: true`, mismo
 * guardado y la misma alineación con aeneas. Solo cambia el JOURNEY_ID y que
 * el voiceMap sale del `voiceId` de la historia, porque este journey no tiene
 * dialogueSpec: lo narra una sola voz (Fernanda, pt-BR), igual que el A0
 * brasileño del que viene el alumno.
 *
 * El anti-uptalk y el gate de contenido viven en `src/lib/elevenlabs.ts`, que
 * es por donde pasa este render; aquí no se sintetiza nada directamente.
 *
 * GATED: solo corre cuando el último mensaje del usuario pide generar audio, y
 * con el opt-in consciente porque el entregable ES el audio completo:
 *   DPL_AUDIO_FULL_OK=1 NODE_OPTIONS="--conditions=react-server" \
 *     npx tsx scripts/_genPtBrA1StoryAudio.ts <slug>
 *
 * El pacing se aplica DESPUÉS con normalizeAudioPace.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import { PrismaClient } from "../src/generated/prisma";
import { generateAndUploadMultiVoiceAudio } from "../src/lib/elevenlabs";
import { generateWordTimingsForStory } from "../src/lib/audioWordTimings";
import { assertVoiceApproved } from "../src/lib/approvedVoices";

const JOURNEY_ID = "cmsyrge55000732u9oiu8wue3";

async function run() {
  const slug = process.argv[2];
  if (!slug) { console.error("uso: _genPtBrA1StoryAudio.ts <slug>"); process.exit(1); }
  const prisma = new PrismaClient();
  const story = await prisma.journeyStory.findFirst({ where: { slug, journeyId: JOURNEY_ID }, include: { journey: true } });
  if (!story || !story.text || !story.title) { console.error("no existe la historia o le falta texto/título"); process.exit(1); }
  if (story.audioUrl) { console.error(`[${slug}] YA tiene audioUrl. Aborto para no pisar. (${story.audioUrl})`); process.exit(1); }
  if (!story.voiceId) { console.error(`[${slug}] sin voiceId`); process.exit(1); }

  assertVoiceApproved(story.voiceId, `ptbr-a1:${slug}`);
  const voiceMap: Record<string, string> = { narrator: story.voiceId };
  console.log(`[${slug}] narrador -> ${story.voiceId}`);

  await prisma.journeyStory.update({ where: { id: story.id }, data: { audioStatus: "generating" } });

  const result = await generateAndUploadMultiVoiceAudio({
    storyText: story.text,
    title: story.title,
    voiceMap,
    language: story.journey.language ?? undefined,
    disableStitching: true,
  });
  if (!result) throw new Error("multi-voice devolvió null");

  await prisma.journeyStory.update({
    where: { id: story.id },
    data: {
      audioUrl: result.url,
      audioSegments: result.audioSegments as never,
      audioFilename: result.filename,
      audioStatus: "ready",
      voiceId: result.speakerVoiceMap?.narrator ?? voiceMap.narrator,
      audioQaStatus: result.audioQa?.status ?? null,
      audioQaScore: result.audioQa?.score ?? null,
      audioQaNotes: result.audioQa?.notes?.join("\n") ?? null,
      ...(result.fragments?.length ? { audioFragments: result.fragments as object } : {}),
    },
  });
  console.log(`[${slug}] máster seco: ${result.url}`);
  console.log(`[${slug}] QA: ${result.audioQa?.status ?? "-"} ${result.audioQa?.score ?? ""}`);
  if (result.contentMisses?.length) console.log(`[${slug}] gate de contenido:`, result.contentMisses.length, "avisos");

  try { await generateWordTimingsForStory(story.id); console.log(`[${slug}] alineación OK`); }
  catch (e) { console.warn(`[${slug}] alineación FALLÓ: ${(e as Error).message?.slice(0, 120)}`); }

  await prisma.$disconnect();
  console.log(`[${slug}] LISTO (antes de pacing). Siguiente: normalizeAudioPace --apply 2.45 ${slug}`);
}
run().catch((e) => { console.error("FATAL", e.message); process.exit(1); });
