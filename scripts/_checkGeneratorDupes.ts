/**
 * Read-only: re-corre el generador de sets EN MEMORIA sobre las historias
 * live+draft y cuenta cuántos ejercicios reproducirían un audio ya oído
 * dentro de la misma respuesta del API (featured y pool se sirven por
 * separado, así que se mide por bucket). No escribe nada.
 *
 *   npx tsx scripts/_checkGeneratorDupes.ts
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { buildPracticeItemsFromStory, rankItemsForFeatured } from "../src/lib/storyPracticeItems";
import { buildMixedPracticeSession, getExerciseAudioSentence, type PracticeExercise, type PracticeMode } from "../src/lib/practiceExercises";

const prisma = new PrismaClient();

// Mismos planes/tamaños que src/lib/storyPracticeSets.ts.
const FEATURED_PLAN: PracticeMode[] = ["context", "meaning", "listening", "context", "meaning", "listening", "match", "context", "meaning", "context"];
const POOL_EXTENSION_PLAN: PracticeMode[] = ["context", "meaning", "listening", "match", "context", "meaning", "listening", "match", "context", "meaning"];
const FEATURED_SIZE = 10;
const POOL_TARGET_SIZE = 30;

const dupesIn = (exs: PracticeExercise[]) => {
  const seen = new Map<string, number>();
  for (const ex of exs) {
    const k = getExerciseAudioSentence(ex);
    if (k) seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  return [...seen.values()].reduce((n, v) => n + Math.max(0, v - 1), 0);
};

(async () => {
  const stories = await prisma.journeyStory.findMany({
    where: { journey: { status: { not: "archived" } }, text: { not: null }, title: { not: null }, slug: { not: null } },
    select: { id: true, slug: true, title: true, text: true, vocab: true, journey: { select: { language: true, name: true, status: true } } },
  });
  let built = 0, featDupes = 0, poolDupes = 0, shortFeatured = 0;
  const offenders: string[] = [];
  for (const story of stories) {
    const items = buildPracticeItemsFromStory({
      title: story.title!, slug: story.slug!, text: story.text!,
      language: story.journey.language, sourcePath: `journey/${story.id}`,
      vocab: (story.vocab as object[]) as never,
    });
    if (items.length < 3) continue;
    const featured = buildMixedPracticeSession(rankItemsForFeatured(items, story.text!), FEATURED_PLAN, FEATURED_SIZE);
    if (featured.length === 0) continue;
    built++;
    if (featured.length < FEATURED_SIZE) shortFeatured++;
    const budget = Math.max(0, POOL_TARGET_SIZE - featured.length);
    const raw = budget > 0 ? buildMixedPracticeSession(items, POOL_EXTENSION_PLAN, budget) : [];
    const featuredAudio = new Set(featured.map(getExerciseAudioSentence).filter(Boolean));
    const poolExtra = [
      ...raw.filter((e) => !featuredAudio.has(getExerciseAudioSentence(e))),
      ...raw.filter((e) => featuredAudio.has(getExerciseAudioSentence(e))),
    ];
    const all = [...featured, ...poolExtra];
    const f = dupesIn(all.slice(0, FEATURED_SIZE));
    const p = dupesIn(all.slice(FEATURED_SIZE));
    featDupes += f; poolDupes += p;
    if (f + p > 0) offenders.push(`${story.slug} [${story.journey.language}] featured=${f} pool=${p}`);
  }
  console.log(`sets construidos: ${built}`);
  console.log(`repeticion de audio dentro de los 10 featured: ${featDupes}`);
  console.log(`repeticion de audio dentro del pool:           ${poolDupes}`);
  console.log(`sets con menos de ${FEATURED_SIZE} featured:              ${shortFeatured}`);
  if (offenders.length) console.log(`\nquedan:\n  ` + offenders.join("\n  "));
  await prisma.$disconnect();
})();
