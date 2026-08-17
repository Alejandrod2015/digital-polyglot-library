/**
 * Genera el audio (Piper/Modal) de todos los ejercicios del practice set de
 * las historias 1 y 2 del journey español. Replica lo que hace el botón
 * "regenerar audio" del PracticeSetEditor: preparePracticeSentenceForTts →
 * generateExerciseAudio → persistir audioUrl.
 *
 * Usage: tsx scripts/generateExerciseAudioBatch.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { PrismaClient } from "../src/generated/prisma";
import { preparePracticeSentenceForTts } from "../src/lib/sanitizePracticeSentence";
import { generateExerciseAudio } from "../src/lib/storyPracticeAudio";

const SLUGS = ["la-promesa-del-mole", "humo-en-la-cocina"];
const LANGUAGE = "spanish";

async function run() {
  const prisma = new PrismaClient();
  for (const slug of SLUGS) {
    const story = await prisma.journeyStory.findFirst({
      where: { slug },
      select: {
        id: true,
        practiceVoiceId: true,
        practiceSet: { select: { exercises: { select: { id: true, type: true, word: true, sentence: true, audioUrl: true }, orderBy: { orderIndex: "asc" } } } },
      },
    });
    const exercises = story?.practiceSet?.exercises ?? [];
    console.log(`\n=== ${slug}: ${exercises.length} ejercicios ===`);
    let ok = 0, skip = 0, fail = 0;
    for (const ex of exercises) {
      const raw = (ex.sentence ?? "").trim();
      if (!raw) { skip++; continue; }
      const ttsSentence = preparePracticeSentenceForTts(raw, ex.word ?? "");
      if (!ttsSentence.trim()) { skip++; continue; }
      try {
        const url = await generateExerciseAudio({ sentence: ttsSentence, language: LANGUAGE, voiceId: story?.practiceVoiceId });
        if (!url) { fail++; console.log(`  ✗ null: ${ex.type} "${ttsSentence.slice(0, 40)}"`); continue; }
        await prisma.storyPracticeExercise.update({ where: { id: ex.id }, data: { audioUrl: url } });
        ok++;
        if (ok % 5 === 0) console.log(`  ...${ok} listos`);
      } catch (e) {
        fail++;
        console.log(`  ✗ error: ${e instanceof Error ? e.message : e}`);
      }
    }
    console.log(`  ${slug}: ok=${ok} skip=${skip} fail=${fail}`);
  }
  await prisma.$disconnect();
  console.log("\nDone.");
}

run().catch((err) => { console.error(err); process.exit(1); });
