/**
 * Genera el audio de práctica (Piper/Modal) de los ejercicios del journey
 * Friends ES C1 Colombia y persiste StoryPracticeExercise.audioUrl.
 * Mismo pipeline que el botón "regenerar audio" del PracticeSetEditor:
 * preparePracticeSentenceForTts -> generateExerciseAudio -> update audioUrl.
 *
 * Usage:
 *   tsx scripts/_genCOPracticeClips.ts --only=<slug>   # una historia
 *   tsx scripts/_genCOPracticeClips.ts                 # las 21
 *   tsx scripts/_genCOPracticeClips.ts --force         # re-render (ignora cache)
 */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { preparePracticeSentenceForTts } from "../src/lib/sanitizePracticeSentence";
import { generateExerciseAudio } from "../src/lib/storyPracticeAudio";

const CO = "cmrpm0tra000032vgxcs33wrb";
const LANGUAGE = "spanish";
const only = process.argv.find(a => a.startsWith("--only="))?.split("=")[1];
const force = process.argv.includes("--force");

async function withRetry<T>(fn: () => Promise<T>, tries = 6): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) { last = e; await new Promise(r => setTimeout(r, 400 * (i + 1))); }
  }
  throw last;
}

async function run() {
  const prisma = new PrismaClient();
  const stories = await prisma.journeyStory.findMany({
    where: { journeyId: CO, ...(only ? { slug: only } : {}) },
    select: {
      slug: true, practiceVoiceId: true,
      practiceSet: { select: { exercises: { select: { id: true, type: true, word: true, sentence: true, audioUrl: true }, orderBy: { orderIndex: "asc" } } } },
    },
    orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
  });
  console.log(`stories: ${stories.length}${only ? ` (--only=${only})` : ""}${force ? " [FORCE]" : ""}`);
  let gOk = 0, gSkip = 0, gFail = 0, gHad = 0;
  for (const story of stories) {
    const exercises = story.practiceSet?.exercises ?? [];
    let ok = 0, skip = 0, fail = 0, had = 0;
    for (const ex of exercises) {
      if (ex.audioUrl && !force) { had++; continue; }
      const raw = (ex.sentence ?? "").trim();
      if (!raw) { skip++; continue; }
      const ttsSentence = preparePracticeSentenceForTts(raw, ex.word ?? "");
      if (!ttsSentence.trim()) { skip++; continue; }
      try {
        const url = await generateExerciseAudio({ sentence: ttsSentence, language: LANGUAGE, voiceId: story.practiceVoiceId, force });
        if (!url) { fail++; console.log(`  ✗ null: ${ex.type} "${ttsSentence.slice(0, 45)}"`); continue; }
        // select:{id} → RETURNING solo id, evita columnas que el schema declara
        // pero que faltan en esta DB (cefr/audioVoiceId/audioText/distractorSource).
        await withRetry(() => prisma.storyPracticeExercise.update({ where: { id: ex.id }, data: { audioUrl: url }, select: { id: true } }));
        ok++;
      } catch (e) {
        fail++; console.log(`  ✗ ${ex.word}: ${e instanceof Error ? e.message : e}`);
      }
    }
    console.log(`  ${story.slug}: ok=${ok} had=${had} skip=${skip} fail=${fail} (${exercises.length} ej)`);
    gOk += ok; gSkip += skip; gFail += fail; gHad += had;
  }
  console.log(`\nTOTAL: nuevos=${gOk} yaTenian=${gHad} skip=${gSkip} fail=${gFail}`);
  await prisma.$disconnect();
}
run().catch((err) => { console.error(err); process.exit(1); });
