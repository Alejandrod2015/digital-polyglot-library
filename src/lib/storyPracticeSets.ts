/**
 * Build + persist a JourneyStory's practice set. As of the pool-unification
 * migration (20260518180000) this set holds BOTH:
 *   - The 10 featured exercises that show on the end-of-story screen
 *     (orderIndex 0–9, featured=true).
 *   - The extended pool (orderIndex 10+, featured=false) used by the
 *     Practice tab when picking exercises by language.
 *
 * Featured slots follow the original PLAN. Pool slots cycle through the
 * same plan again so we get the same format mix without duplicating the
 * same vocab item back-to-back (`buildMixedPracticeSession` already
 * deduplicates by word inside one call).
 */
import { prisma } from "@/lib/prisma";
import { buildPracticeItemsFromStory, rankItemsForFeatured } from "@/lib/storyPracticeItems";
import { buildMixedPracticeSession, type PracticeExercise, type PracticeMode } from "@/lib/practiceExercises";
import { sanitizePracticeSentence } from "@/lib/sanitizePracticeSentence";

const FEATURED_PLAN: PracticeMode[] = ["context", "meaning", "listening", "context", "meaning", "listening", "natural", "context", "meaning", "context"];
const POOL_EXTENSION_PLAN: PracticeMode[] = ["context", "meaning", "listening", "natural", "context", "meaning", "listening", "natural", "context", "meaning"];
const FEATURED_SIZE = 10;
// Hard cap on total pool size so generation cost stays bounded even for
// stories with very rich vocab. Set generously — the actual cap per
// story is min(this, vocab.length * 2) inside `buildMixedPracticeSession`.
const POOL_TARGET_SIZE = 30;

export type BuildResult =
  | { status: "created" | "updated"; count: number }
  | { status: "skipped"; reason: "exists" | "locked" | "no-vocab" | "not-found" };

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

export async function buildAndPersistStoryPracticeSet(
  storyId: string,
  force: boolean
): Promise<BuildResult> {
  const story = await prisma.journeyStory.findUnique({
    where: { id: storyId },
    include: { journey: true, practiceSet: true },
  });
  if (!story || !story.text || !story.title || !story.slug) {
    return { status: "skipped", reason: "not-found" };
  }
  if (story.practiceSet?.locked) return { status: "skipped", reason: "locked" };
  if (story.practiceSet && !force) return { status: "skipped", reason: "exists" };

  const items = buildPracticeItemsFromStory({
    title: story.title,
    slug: story.slug,
    text: story.text,
    language: story.journey.language,
    sourcePath: `journey/${story.id}`,
    vocab: (story.vocab as object[]) as never,
  });
  if (items.length < 3) return { status: "skipped", reason: "no-vocab" };

  // Featured: the 10 that show end-of-story. Items are pre-ranked by
  // pedagogical value (text frequency + grammar diversity) so the slots
  // get filled with the words most worth practicing, not just the
  // first 10 in the vocab JSON.
  const rankedItems = rankItemsForFeatured(items, story.text);
  const featured = buildMixedPracticeSession(rankedItems, FEATURED_PLAN, FEATURED_SIZE);
  if (featured.length === 0) return { status: "skipped", reason: "no-vocab" };

  // Pool extension: capped at min(POOL_TARGET_SIZE - featured.length, items.length).
  // We pass the FULL item list again — buildMixedPracticeSession dedupes
  // within a single call, so we won't ship two fill_blank for the same
  // word here. There IS overlap with featured (same word can appear in
  // both featured and pool), which is fine: Practice tab queries by
  // language and lemma, not by featured flag, so duplicates broaden the
  // pool rather than hurt it.
  const poolExtensionBudget = Math.max(0, POOL_TARGET_SIZE - featured.length);
  const poolExtra = poolExtensionBudget > 0
    ? buildMixedPracticeSession(items, POOL_EXTENSION_PLAN, poolExtensionBudget)
    : [];

  const allExercises = [...featured, ...poolExtra];
  if (allExercises.length === 0) return { status: "skipped", reason: "no-vocab" };

  const language = story.journey.language;
  const wasUpdate = !!story.practiceSet;
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
          create: allExercises.map((ex, i) => {
            const { word, sentence, payload } = buildPayload(ex);
            return {
              orderIndex: i,
              type: ex.type,
              word,
              // Strip orphan trailing quotes the upstream generator
              // sometimes leaves; otherwise TTS clicks at the end.
              sentence: sanitizePracticeSentence(sentence),
              audioUrl: null,
              payload: payload as never,
              featured: i < FEATURED_SIZE,
              language,
            };
          }),
        },
      },
    });
  });

  return { status: wasUpdate ? "updated" : "created", count: allExercises.length };
}
