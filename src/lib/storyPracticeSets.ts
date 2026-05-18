/**
 * Build + persist a JourneyStory's practice set (the 10-exercise
 * editorial pool the mobile end-of-story screen reads from). Shared
 * by the seed script and the Studio "regenerate" endpoint.
 */
import { prisma } from "@/lib/prisma";
import { buildPracticeItemsFromStory } from "@/lib/storyPracticeItems";
import { buildMixedPracticeSession, type PracticeExercise, type PracticeMode } from "@/lib/practiceExercises";
import { sanitizePracticeSentence } from "@/lib/sanitizePracticeSentence";

const PLAN: PracticeMode[] = ["context", "meaning", "listening", "context", "meaning", "listening", "natural", "context", "meaning", "context"];
const TARGET_SIZE = 10;

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

  const exercises = buildMixedPracticeSession(items, PLAN, TARGET_SIZE);
  if (exercises.length === 0) return { status: "skipped", reason: "no-vocab" };

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
          create: exercises.map((ex, i) => {
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
            };
          }),
        },
      },
    });
  });

  return { status: wasUpdate ? "updated" : "created", count: exercises.length };
}
