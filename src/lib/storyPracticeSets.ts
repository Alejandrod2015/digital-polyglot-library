/**
 * Build + persist a JourneyStory's practice set (the 10-exercise
 * editorial pool the mobile end-of-story screen reads from). Shared
 * by the seed script and the Studio "regenerate" endpoint.
 */
import { prisma } from "@/lib/prisma";
import { buildPracticeItemsFromStory } from "@/lib/storyPracticeItems";
import { buildMixedPracticeSession, type PracticeExercise, type PracticeMode } from "@/lib/practiceExercises";
import { generateExerciseAudio } from "@/lib/storyPracticeAudio";

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
  const created = await prisma.$transaction(async (tx) => {
    if (story.practiceSet) {
      await tx.storyPracticeExercise.deleteMany({ where: { setId: story.practiceSet.id } });
      await tx.storyPracticeSet.delete({ where: { id: story.practiceSet.id } });
    }
    return tx.storyPracticeSet.create({
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
      include: { exercises: { orderBy: { orderIndex: "asc" } } },
    });
  });

  // Pre-render the audio for every exercise so editors and end users
  // see clips ready in Studio + the mobile reveal is instant. Done
  // sequentially to keep Modal load gentle; each call is ~1-2s. If a
  // single render fails we keep going and leave audioUrl null for
  // that row.
  for (const row of created.exercises) {
    const audioText = audioTextFor(row.sentence, row.payload, row.word);
    if (!audioText.trim()) continue;
    try {
      const url = await generateExerciseAudio({
        sentence: audioText,
        language: story.journey.language,
        voiceId: story.voiceId,
        variant: row.type,
      });
      if (url) {
        await prisma.storyPracticeExercise.update({
          where: { id: row.id },
          data: { audioUrl: url },
        });
      }
    } catch (err) {
      console.warn(`[storyPracticeSets] audio pre-render failed for exercise ${row.id}: ${err instanceof Error ? err.message : err}`);
    }
  }

  return { status: wasUpdate ? "updated" : "created", count: exercises.length };
}

/**
 * Re-render the audio of one exercise. Used by the Studio
 * "Regenerar audio" button when an editor wants a fresh take —
 * always with `force` so the returned URL is guaranteed to be a new
 * file in R2 (browsers won't refresh an <audio src> when the string
 * is the same as before).
 */
export async function regenerateExerciseAudio(exerciseId: string): Promise<string | null> {
  const row = await prisma.storyPracticeExercise.findUnique({
    where: { id: exerciseId },
    include: { set: { include: { story: { include: { journey: true } } } } },
  });
  if (!row) throw new Error("Exercise not found");
  const audioText = audioTextFor(row.sentence, row.payload as Record<string, unknown>, row.word);
  if (!audioText.trim()) return null;

  const url = await generateExerciseAudio({
    sentence: audioText,
    language: row.set.story.journey.language,
    voiceId: row.set.story.voiceId,
    variant: row.type,
    force: true,
  });
  if (url) {
    await prisma.storyPracticeExercise.update({
      where: { id: exerciseId },
      data: { audioUrl: url },
    });
  }
  return url;
}

/**
 * Sentence to send to the TTS for a given exercise row.
 *
 * Fill-blank rows store the sentence with "_____" in place of the
 * target word (that's what gets shown on screen), but the audio has
 * to speak the complete sentence with the actual word so the learner
 * hears the correct phrasing. We replace any run of underscores with
 * the answer; for the other exercise types `sentence` is already the
 * full text and we return it as-is.
 */
function audioTextFor(sentence: string, payload: unknown, fallbackWord: string): string {
  const answer =
    payload && typeof payload === "object" && "answer" in payload && typeof (payload as { answer?: unknown }).answer === "string"
      ? ((payload as { answer: string }).answer)
      : fallbackWord;
  if (!sentence.includes("_")) return sentence;
  return sentence.replace(/_+/g, answer);
}
