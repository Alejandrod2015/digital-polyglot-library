/**
 * Insert the new German A1 dialogue story "Eiscafé am Sommerabend" into the
 * active German journey, then generate multi-voice audio with the assigned
 * cast (Moritz / Gesa Tess / ENNIAH / Sebastian) + ambient + loudness norm.
 *
 * Reads pre-generated content from data/dialogue-stories/<slug>.json
 * (sub-agent wrote it with spread-aware vocab and validated definitions).
 *
 * Cast: narrator = Moritz, Eva = Gesa Tess, Lara = ENNIAH, Marc = Sebastian.
 * Ambient: cafeteria_de.mp3 (interior shop, fits an Eiscafé).
 */

import { config } from "dotenv";
import { readFileSync } from "fs";
import path from "path";
import { PrismaClient } from "../src/generated/prisma";
import {
  GERMAN_DIALOGUE_VOICES,
  generateAndUploadMultiVoiceAudio,
  parseDialogueSegments,
} from "../src/lib/elevenlabs";

config({ path: ".env.local" });
config({ path: ".env" });

const SLUG = "eiscafe-am-sommerabend";
const TARGET_LANGUAGE = "german";
const TARGET_LEVEL = "a1";
const TARGET_TOPIC = "food-everyday-life";

const V = GERMAN_DIALOGUE_VOICES;
const VOICE_MAP: Record<string, string> = {
  narrator: V.moritz,
  Eva: V.gesaTess,
  Lara: V.enniah,
  Marc: V.sebastian,
};

const AMBIENT_PATH = path.resolve(
  __dirname, "..", "scripts", "tts", "ambience", "cafeteria_de.mp3"
);

function wordCount(s: string) {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

async function run() {
  const apply = process.argv.includes("--apply");
  const dryRun = process.argv.includes("--dry-run");
  if (!apply && !dryRun) {
    console.error("Pass --apply or --dry-run.");
    process.exit(1);
  }

  const dataPath = path.resolve(
    __dirname, "..", "data", "dialogue-stories", `${SLUG}.json`
  );
  const data = JSON.parse(readFileSync(dataPath, "utf8")) as {
    title: string;
    synopsis: string;
    text: string;
    vocab: { word: string; surface?: string; type?: string; definition: string; third?: string }[];
  };
  console.log(`Loaded ${SLUG}: ${data.vocab.length} vocab, ${wordCount(data.text)} words`);

  const segments = parseDialogueSegments(data.text);
  const speakers = Array.from(new Set(segments.map((s) => s.speaker)));
  console.log(`Speakers: ${speakers.join(", ")}`);
  const lowerMap = new Set(Object.keys(VOICE_MAP).map((k) => k.toLowerCase()));
  const missing = speakers.filter((s) => !lowerMap.has(s.toLowerCase()));
  if (missing.length > 0) console.warn(`Speakers without explicit voice: ${missing.join(", ")}`);

  const prisma = new PrismaClient();
  const journey = await prisma.journey.findFirst({
    where: { language: TARGET_LANGUAGE },
    orderBy: { createdAt: "desc" },
  });
  if (!journey) throw new Error("No German journey found");
  console.log(`Active German journey: ${journey.id}`);

  // Determine free slotIndex for this topic.
  const existing = await prisma.journeyStory.findMany({
    where: { journeyId: journey.id, level: TARGET_LEVEL, topic: TARGET_TOPIC },
    select: { slotIndex: true, slug: true },
    orderBy: { slotIndex: "asc" },
  });
  console.log(`Existing food-everyday-life A1 stories: ${existing.map((s) => `slot${s.slotIndex} ${s.slug}`).join(", ")}`);
  const usedSlots = new Set(existing.map((s) => s.slotIndex));
  let slotIndex = 0;
  while (usedSlots.has(slotIndex)) slotIndex += 1;
  console.log(`Will use slotIndex=${slotIndex}`);

  if (!apply) {
    console.log("[dry-run] complete; no DB insert, no audio");
    await prisma.$disconnect();
    return;
  }

  // Strip the `third` field before storing (DB schema doesn't include it).
  const dbVocab = data.vocab.map(({ third, ...rest }) => rest);

  const created = await prisma.journeyStory.create({
    data: {
      journeyId: journey.id,
      level: TARGET_LEVEL,
      topic: TARGET_TOPIC,
      slotIndex,
      status: "draft",
      title: data.title,
      slug: SLUG,
      text: data.text,
      synopsis: data.synopsis,
      vocab: dbVocab as any,
      wordCount: wordCount(data.text),
      vocabCount: dbVocab.length,
      ambientTag: "cafeteria",
    },
  });
  console.log(`Inserted draft id=${created.id}`);

  console.log("Generating multi-voice audio...");
  const result = await generateAndUploadMultiVoiceAudio({
    storyText: data.text,
    title: data.title,
    voiceMap: VOICE_MAP,
    ambientPath: AMBIENT_PATH,
  });
  if (!result) {
    console.warn("Audio generation failed; story stays as draft");
    await prisma.journeyStory.update({ where: { id: created.id }, data: { audioStatus: "failed" } });
    await prisma.$disconnect();
    return;
  }
  console.log(`Audio uploaded: ${result.url}`);

  await prisma.journeyStory.update({
    where: { id: created.id },
    data: {
      audioUrl: result.url,
      audioFilename: result.filename,
      audioSegments: result.audioSegments as any,
      audioStatus: "ready",
      audioQaStatus: result.audioQa?.status ?? null,
      audioQaScore: result.audioQa?.score ?? null,
      audioQaNotes: result.audioQa?.notes?.join("\n") ?? null,
      status: "published",
    },
  });
  console.log("Published.");

  await prisma.$disconnect();
}

run().catch((err) => { console.error(err); process.exit(1); });
