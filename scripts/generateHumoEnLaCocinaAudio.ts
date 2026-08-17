/**
 * Render multi-voice audio for "Humo en la cocina" (slug: humo-en-la-cocina),
 * story #2 of the Spanish-LATAM Traveler journey. Mismo cast que la #1
 * (la-promesa-del-mole), disableStitching, tempo 0.94, sin ambient.
 * Reusa los segmentos ya cacheados del sample (título toma 3, "fuego lento",
 * toma nueva de Mateo, etc.) y genera el resto.
 *
 * Usage: tsx scripts/generateHumoEnLaCocinaAudio.ts --apply
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { PrismaClient } from "../src/generated/prisma";
import {
  generateAndUploadMultiVoiceAudio,
  parseDialogueSegments,
  DEFAULT_NARRATION_TEMPO,
} from "../src/lib/elevenlabs";
import { applyNarrationPostProcess } from "../src/lib/narrationPostProcess";

const SLUG = "humo-en-la-cocina";
const JOURNEY_ID = "cmovi4cvi000032q37a4823h3";

const voiceMap: Record<string, string> = {
  narrator: "JW8DGEuLp9WxIS5IdxMM", // andreti
  "Sofía": "ewn5JTa3lNPY8QVuZJi6", // ana_sofia
  Renata: "m7yTemJqdIqrcNleANfX", // ana_maria
  Mateo: "p1Q3ihQuPjyyENa1RGtl", // tom
};

async function run() {
  if (!process.argv.includes("--apply")) {
    console.error("Pass --apply.");
    process.exit(1);
  }
  const prisma = new PrismaClient();
  const story = await prisma.journeyStory.findFirst({ where: { slug: SLUG, journeyId: JOURNEY_ID } });
  if (!story || !story.text || !story.title) {
    console.error("Story not found or missing text/title");
    process.exit(1);
  }
  const segments = parseDialogueSegments(story.text);
  const speakers = Array.from(new Set(segments.map((s) => s.speaker)));
  console.log(`${SLUG}: ${segments.length} segments | speakers=${speakers.join(", ")}`);

  console.log("Step 1: multi-voice (disableStitching, no ambient)...");
  const result = await generateAndUploadMultiVoiceAudio({
    storyText: story.text,
    title: story.title,
    voiceMap,
    ambientPath: null,
    language: "spanish",
    disableStitching: true,
  });
  if (!result) { console.error("Step 1 null"); process.exit(1); }
  console.log(`  dry: ${result.url}`);

  await prisma.journeyStory.update({
    where: { id: story.id },
    data: {
      audioUrl: result.url,
      audioFilename: result.filename,
      audioSegments: result.audioSegments as any,
      audioStatus: "ready",
      voiceId: voiceMap.narrator,
    },
  });

  console.log(`Step 2: applyNarrationPostProcess (atempo ${DEFAULT_NARRATION_TEMPO}, no ambient)...`);
  const post = await applyNarrationPostProcess({
    storyId: story.id,
    tempo: DEFAULT_NARRATION_TEMPO,
    sourceUrl: result.url,
    ambientTag: null,
  });
  console.log(`  final audioUrl: ${post.audioUrl}`);
  await prisma.$disconnect();
  console.log("Done.");
}

run().catch((err) => { console.error(err); process.exit(1); });
