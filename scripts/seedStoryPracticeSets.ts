/**
 * Build and persist a 10-exercise practice set for every published
 * JourneyStory that has vocab. Reuses the existing in-code builder
 * (`buildMixedPracticeSession`) so the content is identical to what
 * the on-the-fly path produced — only it's now stored once and the
 * mobile end-of-story screen reads it back deterministically.
 *
 *   tsx scripts/seedStoryPracticeSets.ts                # only new
 *   tsx scripts/seedStoryPracticeSets.ts --force        # overwrite unlocked
 *   tsx scripts/seedStoryPracticeSets.ts --story <slug> # one story
 *   tsx scripts/seedStoryPracticeSets.ts --dry-run      # plan, do not write
 *
 * Locked sets (locked=true) are NEVER overwritten — Studio sets that
 * flag once an editor approves the content.
 */
import { prisma } from "../src/lib/prisma";
import { buildPracticeItemsFromStory } from "../src/lib/storyPracticeItems";
import { buildMixedPracticeSession, type PracticeExercise } from "../src/lib/practiceExercises";

const PLAN = ["context", "meaning", "listening", "context", "meaning", "listening", "natural", "context", "meaning", "context"] as const;
const TARGET_SIZE = 10;

function buildPayload(ex: PracticeExercise): { word: string; sentence: string; payload: Record<string, unknown> } {
  switch (ex.type) {
    case "fill_blank":
      return {
        word: ex.answer,
        sentence: ex.sentence,
        payload: { prompt: ex.prompt, options: ex.options, answer: ex.answer, audioClip: ex.audioClip ?? null },
      };
    case "meaning_in_context":
      return {
        word: ex.word,
        sentence: ex.sentence,
        payload: { prompt: ex.prompt, options: ex.options, answer: ex.answer, audioClip: ex.audioClip ?? null },
      };
    case "natural_expression":
      return {
        word: ex.answer,
        sentence: ex.sentence,
        payload: { prompt: ex.prompt, options: ex.options, answer: ex.answer, audioClip: ex.audioClip ?? null },
      };
    case "listen_choose":
      return {
        word: ex.answer,
        sentence: ex.speechText,
        payload: { prompt: ex.prompt, options: ex.options, answer: ex.answer, language: ex.language },
      };
    case "match_meaning":
      return {
        word: ex.pairs.map((p) => p.word).join(","),
        sentence: "",
        payload: { prompt: ex.prompt, pairs: ex.pairs },
      };
  }
}

async function seedOne(storyId: string, force: boolean, dryRun: boolean): Promise<{ status: "created" | "skipped" | "updated" | "locked" | "no-vocab"; count: number }> {
  const story = await prisma.journeyStory.findUnique({
    where: { id: storyId },
    include: { journey: true, practiceSet: true },
  });
  if (!story || !story.text || !story.title || !story.slug) return { status: "no-vocab", count: 0 };

  if (story.practiceSet?.locked) return { status: "locked", count: 0 };
  if (story.practiceSet && !force) return { status: "skipped", count: 0 };

  const items = buildPracticeItemsFromStory({
    title: story.title,
    slug: story.slug,
    text: story.text,
    language: story.journey.language,
    sourcePath: `journey/${story.id}`,
    vocab: (story.vocab as object[]) as never,
  });
  if (items.length < 3) return { status: "no-vocab", count: 0 };

  const exercises = buildMixedPracticeSession(items, [...PLAN], TARGET_SIZE);
  if (exercises.length === 0) return { status: "no-vocab", count: 0 };

  if (dryRun) {
    console.log(`  [dry] ${exercises.length} exercises`);
    return { status: story.practiceSet ? "updated" : "created", count: exercises.length };
  }

  // Replace any existing set in a single transaction so we never leave
  // a partially-rebuilt set visible to readers.
  await prisma.$transaction(async (tx) => {
    if (story.practiceSet) {
      await tx.storyPracticeExercise.deleteMany({ where: { setId: story.practiceSet.id } });
      await tx.storyPracticeSet.delete({ where: { id: story.practiceSet.id } });
    }
    await tx.storyPracticeSet.create({
      data: {
        storyId,
        locked: false,
        exercises: {
          create: exercises.map((ex, i) => {
            const { word, sentence, payload } = buildPayload(ex);
            return {
              orderIndex: i,
              type: ex.type,
              word,
              sentence,
              audioUrl: null,
              payload: payload as never,
            };
          }),
        },
      },
    });
  });

  return { status: story.practiceSet ? "updated" : "created", count: exercises.length };
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const dryRun = args.includes("--dry-run");
  const slugIdx = args.indexOf("--story");
  const singleSlug = slugIdx >= 0 ? args[slugIdx + 1] : null;

  const stories = await prisma.journeyStory.findMany({
    where: {
      status: "published",
      text: { not: null },
      ...(singleSlug ? { slug: singleSlug } : {}),
    },
    select: { id: true, slug: true, title: true },
    orderBy: [{ journeyId: "asc" }, { level: "asc" }, { slotIndex: "asc" }],
  });

  console.log(`Found ${stories.length} published stories. force=${force} dryRun=${dryRun}\n`);
  const stats = { created: 0, updated: 0, skipped: 0, locked: 0, noVocab: 0 };

  for (const s of stories) {
    process.stdout.write(`${s.slug?.padEnd(40) ?? "?"} `);
    try {
      const r = await seedOne(s.id, force, dryRun);
      switch (r.status) {
        case "created": stats.created += 1; console.log(`✓ created (${r.count})`); break;
        case "updated": stats.updated += 1; console.log(`✓ updated (${r.count})`); break;
        case "skipped": stats.skipped += 1; console.log(`· skipped (exists, use --force)`); break;
        case "locked":  stats.locked += 1;  console.log(`· locked (editor-approved)`); break;
        case "no-vocab": stats.noVocab += 1; console.log(`× skipped (no vocab)`); break;
      }
    } catch (err) {
      console.log(`✗ FAIL: ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log(`\nDone. created=${stats.created} updated=${stats.updated} skipped=${stats.skipped} locked=${stats.locked} no-vocab=${stats.noVocab}`);
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
