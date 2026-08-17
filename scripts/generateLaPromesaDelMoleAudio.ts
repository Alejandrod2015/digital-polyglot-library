/**
 * Render multi-voice audio for "La promesa del mole" (slug: la-promesa-del-mole),
 * story #1 of the Spanish-LATAM Traveler journey (CDMX, departamento de Sofía).
 *
 * Cast (locked 2026-06-10/11):
 *   narrator → andreti     (JW8DGEuLp9WxIS5IdxMM)
 *   Sofía    → ana_sofia   (ewn5JTa3lNPY8QVuZJi6)
 *   Renata   → ana_maria   (m7yTemJqdIqrcNleANfX)
 *   Mateo    → tom          (p1Q3ihQuPjyyENa1RGtl)
 *
 * disableStitching: true → apaga previous_text (inhalación de costura) y fija
 * next_text=" " (suprime exhalación de cola). Esto elimina el "aire" reportado
 * el 2026-06-11. Reusa los 7 segmentos ya cacheados bajo trim-v7-noprev.
 *
 * tempo 0.94, sin ambient (no hay ambient de cocina-hogar; las hermanas también
 * van sin bed). Mirrors generateAlguienPreguntaAudio.ts.
 *
 * Usage: tsx scripts/generateLaPromesaDelMoleAudio.ts --dry-run | --apply
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

const SLUG = "la-promesa-del-mole";
const JOURNEY_ID = "cmovi4cvi000032q37a4823h3"; // Traveler (spanish/latam, active)

const voiceMap: Record<string, string> = {
  narrator: "JW8DGEuLp9WxIS5IdxMM", // andreti
  "Sofía": "ewn5JTa3lNPY8QVuZJi6", // ana_sofia
  Renata: "m7yTemJqdIqrcNleANfX", // ana_maria
  Mateo: "p1Q3ihQuPjyyENa1RGtl", // tom
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

  if (!apply) {
    console.log("\n[dry-run] skipping TTS + upload. Segment preview:");
    segments.forEach((s, i) => console.log(`  ${String(i + 1).padStart(2)} [${s.speaker.padEnd(8)}] ${s.text.slice(0, 64)}`));
    await prisma.$disconnect();
    return;
  }

  console.log("\nStep 1: generating multi-voice audio (disableStitching, no ambient)...");
  const result = await generateAndUploadMultiVoiceAudio({
    storyText: story.text,
    title: story.title,
    voiceMap,
    ambientPath: null,
    language: "spanish",
    disableStitching: true,
  });
  if (!result) {
    console.error("Step 1 failed (null result)");
    process.exit(1);
  }
  console.log(`  uploaded dry multivoice: ${result.url}`);

  await prisma.journeyStory.update({
    where: { id: story.id },
    data: {
      audioUrl: result.url,
      audioFilename: result.filename,
      audioSegments: result.audioSegments as any,
      audioStatus: "ready",
      voiceId: voiceMap.narrator,
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
    ambientTag: null,
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
