/**
 * Generate multi-voice audio for the Spanish-LATAM journey story
 * "Alguien pregunta por ti" (slug: alguien-pregunta-por-ti), the 2nd story
 * of the Traveler journey (food-everyday-life / Coyoacán fonda mini-cast).
 *
 * Mirrors exactly how its sibling "La fonda de Tío Beto" (story #1) was made:
 *   - narrator → Angela  (SPANISH_DIALOGUE_VOICES.angela)
 *   - Sofía    → ana_sofia
 *   - Mateo    → tom
 *   - tempo 0.94 via applyNarrationPostProcess, NO ambient (ambientTag null).
 *
 * Two-step pipeline:
 *   1. generateAndUploadMultiVoiceAudio (no ambient) → dry multivoice mp3
 *   2. applyNarrationPostProcess (atempo 0.94, no ambient) + aeneas re-align
 *
 * Usage: tsx scripts/generateAlguienPreguntaAudio.ts --dry-run | --apply
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { PrismaClient } from "../src/generated/prisma";
import {
  SPANISH_DIALOGUE_VOICES as V,
  generateAndUploadMultiVoiceAudio,
  parseDialogueSegments,
  DEFAULT_NARRATION_TEMPO,
} from "../src/lib/elevenlabs";
import { applyNarrationPostProcess } from "../src/lib/narrationPostProcess";

const SLUG = "alguien-pregunta-por-ti";
const JOURNEY_ID = "cmovi4cvi000032q37a4823h3"; // Traveler (spanish/latam, active)

const voiceMap: Record<string, string> = {
  narrator: V.angela,   // Po9nYFo9ScA7odSuQLIW; matches story #1 narrator
  "Sofía": V.ana_sofia, // ewn5JTa3lNPY8QVuZJi6
  Mateo: V.tom,         // p1Q3ihQuPjyyENa1RGtl
};

async function run() {
  const apply = process.argv.includes("--apply");
  const dryRun = process.argv.includes("--dry-run");
  if (!apply && !dryRun) {
    console.error("Pass --apply or --dry-run.");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const story = await prisma.journeyStory.findFirst({
    where: { slug: SLUG, journeyId: JOURNEY_ID },
  });
  if (!story || !story.text || !story.title) {
    console.error("Story not found or missing text/title");
    process.exit(1);
  }

  const segments = parseDialogueSegments(story.text);
  const speakers = Array.from(new Set(segments.map((s) => s.speaker)));
  console.log(`\n${SLUG}: ${segments.length} segments`);
  console.log(`speakers parsed: ${speakers.join(", ")}`);

  const lowerMap = new Set(Object.keys(voiceMap).map((k) => k.toLowerCase()));
  const missing = speakers.filter(
    (s) => s.toLowerCase() !== "narrator" && !lowerMap.has(s.toLowerCase())
  );
  if (missing.length > 0) {
    console.warn(`⚠ speakers WITHOUT explicit voice (would fall back to narrator): ${missing.join(", ")}`);
  } else {
    console.log("✓ every non-narrator speaker has an explicit voice");
  }
  console.log("voice map:");
  for (const [k, v] of Object.entries(voiceMap)) console.log(`  ${k.padEnd(10)} → ${v}`);

  if (!apply) {
    console.log("\n[dry-run] skipping TTS + upload. Segment preview:");
    for (const s of segments.slice(0, 8)) {
      console.log(`  [${s.speaker.padEnd(8)}] ${s.text.slice(0, 70)}`);
    }
    await prisma.$disconnect();
    return;
  }

  console.log("\nStep 1: generating multi-voice audio (no ambient)...");
  const result = await generateAndUploadMultiVoiceAudio({
    storyText: story.text,
    title: story.title,
    voiceMap,
    ambientPath: null,
    language: "spanish",
  });
  if (!result) {
    console.error("Step 1 failed (null result)");
    process.exit(1);
  }
  console.log(`  uploaded dry multivoice: ${result.url}`);

  // Persist step-1 result so applyNarrationPostProcess has a source.
  await prisma.journeyStory.update({
    where: { id: story.id },
    data: {
      audioUrl: result.url,
      audioFilename: result.filename,
      audioSegments: result.audioSegments as any,
      audioStatus: "ready",
      voiceId: voiceMap.narrator, // narrator voice, mirrors story #1
      audioQaStatus: result.audioQa?.status ?? null,
      audioQaScore: result.audioQa?.score ?? null,
      audioQaNotes: result.audioQa?.notes?.join("\n") ?? null,
    },
  });
  console.log(`  QA: ${result.audioQa?.status ?? "n/a"} (score ${result.audioQa?.score ?? "n/a"})`);

  console.log(`\nStep 2: applyNarrationPostProcess (atempo ${DEFAULT_NARRATION_TEMPO}, no ambient)...`);
  const post = await applyNarrationPostProcess({
    storyId: story.id,
    tempo: DEFAULT_NARRATION_TEMPO,
    sourceUrl: result.url,
    ambientTag: null, // match story #1 (no ambient bed)
  });
  console.log(`  final audioUrl: ${post.audioUrl}`);
  console.log(`  appliedTempo: ${post.appliedTempo} | ambient: ${post.appliedAmbientTag ?? "none"}`);

  await prisma.$disconnect();
  console.log("\nDone.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
