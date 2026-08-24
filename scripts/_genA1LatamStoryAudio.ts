/**
 * Renderiza la narracion de UNA historia del Traveler ES/latam A1, replicando
 * `scripts/generateJourneyStoryAudio.ts` exactamente: mismo voiceMap desde
 * dialogueSpec, mismo `disableStitching: true`, mismo guardado y la misma
 * alineacion con aeneas. Solo cambia el JOURNEY_ID.
 *
 * Journey de narrador unico POR HISTORIA, con cuatro narradores repartidos por
 * pais (Terry en Peru, Andreti en Mexico, Hernando en Colombia, Lionel en
 * Argentina). El `dialogueSpec` lleva un solo segmento con `speaker: "narrator"`,
 * igual que el A0 latam del que viene el alumno; el habla citada la lee ese
 * mismo narrador.
 *
 * El anti-uptalk vive en `src/lib/elevenlabs.ts`, que es por donde pasa este
 * render; no se sintetiza nada aqui directamente.
 *
 * GATED: solo corre cuando el ultimo mensaje del usuario pide generar audio, y
 * con el opt-in consciente porque el entregable ES el audio completo:
 *   DPL_AUDIO_FULL_OK=1 NODE_OPTIONS="--conditions=react-server" \
 *     npx tsx scripts/_genA1LatamStoryAudio.ts <slug>
 *
 * PACING: el A1 hermano de Espana se normaliza a 2,45 pal/s. Aqui NO se aplica
 * por defecto: el usuario aprobo a Terry a su ritmo seco el 2026-08-24. Medir
 * antes de tocar nada.
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

import { PrismaClient } from "../src/generated/prisma";
import { generateAndUploadMultiVoiceAudio } from "../src/lib/elevenlabs";
import { generateWordTimingsForStory } from "../src/lib/audioWordTimings";
import { multiVoiceGuardError } from "../src/lib/multiVoiceGuard";
import { assertVoiceApproved } from "../src/lib/approvedVoices";

const JOURNEY_ID = "cmt5vxwgd0007324oesy195k8";

async function run() {
  const slug = process.argv[2];
  if (!slug) { console.error("uso: _genA1LatamStoryAudio.ts <slug>"); process.exit(1); }
  const prisma = new PrismaClient();
  const story = await prisma.journeyStory.findFirst({ where: { slug, journeyId: JOURNEY_ID }, include: { journey: true } });
  if (!story || !story.text || !story.title) { console.error("Story not found or missing text/title"); process.exit(1); }
  if (story.audioUrl) { console.error(`[${slug}] YA tiene audioUrl. Aborto para no pisar. (${story.audioUrl})`); process.exit(1); }

  const guardError = multiVoiceGuardError({ storyText: story.text, dialogueSpec: story.dialogueSpec });
  if (guardError) { console.error("multiVoiceGuard:", guardError); process.exit(1); }

  type Seg = { speaker: string; voice: string };
  const spec = story.dialogueSpec as Seg[] | null;
  if (!Array.isArray(spec) || spec.length === 0) { console.error("no dialogueSpec"); process.exit(1); }
  const voiceMap: Record<string, string> = {};
  for (const seg of spec) if (seg.speaker && seg.voice) voiceMap[seg.speaker.toLowerCase()] = seg.voice;
  for (const v of Object.values(voiceMap)) assertVoiceApproved(v, `a1-latam:${slug}`);
  console.log(`[${slug}] speakers->voice:`, voiceMap);

  await prisma.journeyStory.update({ where: { id: story.id }, data: { audioStatus: "generating" } });

  const result = await generateAndUploadMultiVoiceAudio({
    storyText: story.text,
    title: story.title,
    voiceMap,
    language: story.journey.language ?? undefined,
    disableStitching: true,
  });
  if (!result) throw new Error("multi-voice returned null");

  await prisma.journeyStory.update({
    where: { id: story.id },
    data: {
      audioUrl: result.url,
      audioSegments: result.audioSegments as never,
      audioFilename: result.filename,
      audioStatus: "ready",
      voiceId: result.speakerVoiceMap?.narrator ?? voiceMap.narrator ?? null,
      audioQaStatus: result.audioQa?.status ?? null,
      audioQaScore: result.audioQa?.score ?? null,
      audioQaNotes: result.audioQa?.notes?.join("\n") ?? null,
      ...(result.fragments?.length ? { audioFragments: result.fragments as object } : {}),
    },
  });
  console.log(`[${slug}] master seco: ${result.url}`);
  console.log(`[${slug}] QA: ${result.audioQa?.status ?? "-"} ${result.audioQa?.score ?? ""}`);

  try { await generateWordTimingsForStory(story.id); console.log(`[${slug}] alineación OK`); }
  catch (e) { console.warn(`[${slug}] alineación FALLÓ: ${(e as Error).message?.slice(0, 120)}`); }

  await prisma.$disconnect();
  console.log(`[${slug}] LISTO (antes de pacing). Siguiente: normalizeAudioPace --apply 2.45 ${slug}`);
}
run().catch((e) => { console.error("FATAL", e.message); process.exit(1); });
