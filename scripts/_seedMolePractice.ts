/**
 * AUTHORITATIVE curated practice set for la-promesa-del-mole (A2 LATAM).
 * Source of truth; re-seeding from here overwrites prod. Only the 4 real
 * exercise types. A2-calibrated: English scaffold, Spanish only for the target.
 *
 * RULE (applies to all stories): the target word in a meaning_in_context
 * sentence is ALWAYS pre-marked with [[surface-form]] using the EXACT form as
 * it appears in the sentence (the conjugated/inflected form, not the lemma).
 * The renderer underlines what's inside [[ ]] verbatim and skips the runtime
 * matcher, which can't bridge radical-changing verbs (cuelga≠colgar). fill_blank
 * uses the `_____` blank, match has no sentence; neither needs markers.
 *   Usage: tsx scripts/_seedMolePractice.ts --apply
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
const SLUG = "la-promesa-del-mole";

type Ex = { type: string; word: string; sentence: string; payload: any };
const EXS: Ex[] = [
  { type: "meaning_in_context", word: "colgar",
    sentence: "Sofía [[cuelga]] el teléfono con una sonrisa.",
    payload: { answer: "to hang up (a call)", prompt: "Choose the meaning in context.", options: ["to hang up (a call)", "to pick up", "to dial", "to answer"], audioClip: null } },
  { type: "meaning_in_context", word: "sospecha",
    sentence: "Renata la mira con [[sospecha]].",
    payload: { answer: "suspicion", prompt: "Choose the meaning in context.", options: ["suspicion", "surprise", "patience", "excuse"], audioClip: null } },
  // Context (fill_blank) RULE: solvable by MEANING alone, not story recall. The
  // sentence must carry a semantic cue that only the target word satisfies, so a
  // learner who never read the story still picks it. Do NOT lift the story line
  // when it depends on a plot event/joke ("quemar el agua"). Here "left the pot
  // on the fire too long" → only "quemaste" fits; distractors are plausible
  // cooking verbs ruled out by that cue.
  { type: "fill_blank", word: "quemaste",
    sentence: "Dejaste la olla en el fuego demasiado tiempo y _____ la sopa.",
    payload: { answer: "quemaste", prompt: "Complete the sentence.", options: ["quemaste", "enfriaste", "serviste", "probaste"], audioClip: null } },
  { type: "meaning_in_context", word: "fácil",
    sentence: "Vi un video y se ve muy [[fácil]].",
    payload: { answer: "easy", prompt: "Choose the meaning in context.", options: ["easy", "cheap", "famous", "strange"], audioClip: null } },
  { type: "meaning_in_context", word: "avisar",
    sentence: "Les [[aviso]] que solo sé hacer quesadillas.",
    payload: { answer: "to warn / let know", prompt: "Choose the meaning in context.", options: ["to warn / let know", "to thank", "to forget", "to pay"], audioClip: null } },
  { type: "meaning_in_context", word: "suerte",
    sentence: "Vamos a necesitar mucha [[suerte]] con ese mole.",
    payload: { answer: "luck", prompt: "Choose the meaning in context.", options: ["luck", "fear", "hunger", "noise"], audioClip: null } },
  { type: "match_meaning", word: "mercado,cenar,caja,sillón", sentence: "",
    payload: { prompt: "Match the words to their meanings.", pairs: [
      { word: "mercado", answer: "market", options: ["market", "to have dinner", "box", "armchair"] },
      { word: "cenar", answer: "to have dinner", options: ["market", "to have dinner", "box", "armchair"] },
      { word: "caja", answer: "box", options: ["market", "to have dinner", "box", "armchair"] },
      { word: "sillón", answer: "armchair", options: ["market", "to have dinner", "box", "armchair"] },
    ] } },
];

// Raw-SQL writes so the seed works even though the generated Prisma client
// expects the Fase-1 columns (cefr/audioText/...) that aren't migrated to prod
// yet. id/updatedAt have no DB default; Prisma sets them app-side; so we
// supply both. No prod schema change required.
function genId(prefix: string, i: number): string {
  return `${prefix}${Date.now().toString(36)}${i.toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

(async () => {
  const apply = process.argv.includes("--apply");
  const story = await prisma.journeyStory.findFirst({ where: { slug: SLUG }, select: { id: true, status: true } });
  if (!story) { console.log("story not found"); process.exit(1); }
  console.log(`story ${SLUG} status=${story.status}`);
  if (!apply) { console.log(`[dry] ${EXS.length} ejercicios`); EXS.forEach((e, i) => console.log(`  [${i}] ${e.type} ${e.word} :: ${e.sentence}`)); process.exit(0); }

  const setIds = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM dp_story_practice_sets_v1 WHERE "storyId" = $1`, story.id);
  for (const s of setIds) {
    await prisma.$executeRawUnsafe(`DELETE FROM dp_story_practice_exercises_v1 WHERE "setId" = $1`, s.id);
  }
  await prisma.$executeRawUnsafe(`DELETE FROM dp_story_practice_sets_v1 WHERE "storyId" = $1`, story.id);

  const setId = genId("sps_", 0);
  await prisma.$executeRawUnsafe(
    `INSERT INTO dp_story_practice_sets_v1 (id, "storyId", locked, "createdAt", "updatedAt") VALUES ($1, $2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    setId, story.id);

  for (let i = 0; i < EXS.length; i++) {
    const e = EXS[i];
    await prisma.$executeRawUnsafe(
      `INSERT INTO dp_story_practice_exercises_v1 (id, "setId", "orderIndex", type, word, sentence, payload, "audioUrl", featured, language, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NULL, true, 'spanish', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      genId("spe_", i), setId, i, e.type, e.word, e.sentence, JSON.stringify(e.payload));
  }
  console.log(`✓ re-seeded ${EXS.length} exercises for ${SLUG} (set ${setId}, locked, [[ ]] markers)`);
  await prisma.$disconnect();
})().catch(e => { console.log("FATAL", e.message); process.exit(1); });
