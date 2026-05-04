/**
 * Regenerate audio for multi-character dialogue stories using distinct voices
 * per speaker. Replaces existing audio URLs in DB. Targets:
 *   - cafe-in-kreuzberg (Anna + Tom)
 *   - beim-baecker-am-hackeschen-markt (Sophie + Frau Weber + Lukas)
 *   - tomaten-vom-wochenmarkt (Mira + Herr Klein + Frau Tan)
 *
 * The voice map per story is defined below, drawn from the ElevenLabs IDs in
 * src/lib/elevenlabs.ts (GERMAN_DIALOGUE_VOICES).
 */

import { config } from "dotenv";
import { PrismaClient } from "../src/generated/prisma";
import { GERMAN_DIALOGUE_VOICES, generateAndUploadMultiVoiceAudio, parseDialogueSegments } from "../src/lib/elevenlabs";

config({ path: ".env.local" });
config({ path: ".env" });

const V = GERMAN_DIALOGUE_VOICES;

type VoiceAssignment = {
  slug: string;
  voiceMap: Record<string, string>; // speaker name → voice id
  ambientFile?: string;
};

import path from "path";
const AMBIENT_DIR = path.resolve(__dirname, "..", "scripts", "tts", "ambience");

const VOICE_ASSIGNMENTS: VoiceAssignment[] = [
  {
    slug: "cafe-in-kreuzberg",
    voiceMap: {
      narrator: V.moritz,
      Anna: V.gesaTess, // ENNIAH leaned too cheerful on Anna's warm greetings; Gesa Tess has a calmer baseline
      Tom: V.sebastian,
    },
    ambientFile: path.join(AMBIENT_DIR, "cafeteria_de.mp3"),
  },
  {
    slug: "beim-baecker-am-hackeschen-markt",
    voiceMap: {
      narrator: V.moritz,
      Sophie: V.enniah,
      "Frau Weber": V.eleonore,
      Lukas: V.sebastian,
    },
    ambientFile: path.join(AMBIENT_DIR, "cafeteria_de.mp3"),
  },
  {
    slug: "tomaten-vom-wochenmarkt",
    voiceMap: {
      narrator: V.moritz,
      Mira: V.enniah,
      "Herr Klein": V.sebastian,
      "Frau Tan": V.eleonore,
    },
    ambientFile: path.join(AMBIENT_DIR, "mercado_de.mp3"),
  },
];

async function run() {
  const apply = process.argv.includes("--apply");
  const dryRun = process.argv.includes("--dry-run");
  if (!apply && !dryRun) {
    console.error("Pass --apply or --dry-run.");
    process.exit(1);
  }

  const slugArg = process.argv.find((a) => a.startsWith("--slug="));
  const onlySlug = slugArg ? slugArg.split("=")[1] : null;

  const prisma = new PrismaClient();

  for (const assignment of VOICE_ASSIGNMENTS) {
    if (onlySlug && assignment.slug !== onlySlug) continue;
    const story = await prisma.journeyStory.findFirst({ where: { slug: assignment.slug } });
    if (!story) {
      console.warn(`Story ${assignment.slug} not found`);
      continue;
    }
    if (!story.text || !story.title) {
      console.warn(`${assignment.slug}: missing text or title`);
      continue;
    }

    const segments = parseDialogueSegments(story.text);
    const speakers = Array.from(new Set(segments.map((s) => s.speaker)));
    console.log(`\n${assignment.slug}: ${segments.length} segments, speakers=${speakers.join(", ")}`);

    // Verify the assigned voiceMap covers every speaker in the parsed text.
    const lowerMap = new Set(Object.keys(assignment.voiceMap).map((k) => k.toLowerCase()));
    const missing = speakers.filter((s) => !lowerMap.has(s.toLowerCase()));
    if (missing.length > 0) {
      console.warn(`  ⚠ speakers without explicit voice (will use narrator): ${missing.join(", ")}`);
    }

    if (!apply) {
      console.log(`  voice map:`);
      for (const [k, v] of Object.entries(assignment.voiceMap)) console.log(`    ${k.padEnd(15)} → ${v}`);
      console.log(`  [dry-run] skipping TTS + upload`);
      continue;
    }

    console.log(`  generating multi-voice audio...`);
    const result = await generateAndUploadMultiVoiceAudio({
      storyText: story.text,
      title: story.title,
      voiceMap: assignment.voiceMap,
      ambientPath: assignment.ambientFile ?? null,
    });
    if (!result) {
      console.warn(`  failed; skipping DB update`);
      continue;
    }
    console.log(`  uploaded: ${result.url}`);

    await prisma.journeyStory.update({
      where: { id: story.id },
      data: {
        audioUrl: result.url,
        audioFilename: result.filename,
        audioSegments: result.audioSegments as any,
        audioStatus: "ready",
        audioQaStatus: result.audioQa?.status ?? null,
        audioQaScore: result.audioQa?.score ?? null,
        audioQaNotes: result.audioQa?.notes?.join("\n") ?? null,
      },
    });
    console.log(`  DB updated`);
  }

  await prisma.$disconnect();
  console.log("\nDone.");
}

run().catch((err) => { console.error(err); process.exit(1); });
