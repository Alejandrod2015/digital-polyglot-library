import { prisma } from "@/lib/prisma";
import type { PracticeExercise } from "@/lib/practiceExercises";
import { loadPersistedExercisesForSlugs } from "@/lib/persistedPracticeExercises";
import {
  LEVEL_TEST_STATION_SIZE,
  type LevelTestExercise,
  type LevelTestPayload,
  type LevelTestRung,
  type LevelTestStation,
} from "@domain/levelTest";

/**
 * The level test, built from the live catalogue: for each rung, the first
 * live stories of that level (for the learner's variant) whose curated
 * practice set has enough usable exercises. Nothing is authored by hand:
 * the test is made of the same `StoryPracticeSet` exercises the learner
 * will practise with after every story (user, 2026-09-20: "use the
 * formats we already have, so they get used to them").
 *
 * A station takes four exercises, one of each format first (listen,
 * meaning, context, fill-the-gap) and then more of the same until four.
 * `match_meaning` and `speaking` stay out: match is a multi-pair board
 * that does not score as one answer, and speaking needs a microphone.
 */

/** Languages with a level test. Mobile sends the display name. */
const LANGUAGE_BY_DISPLAY: Record<string, string> = { spanish: "spanish" };

export function hasListeningLevelTest(language: string | null | undefined): boolean {
  return Boolean(language && LANGUAGE_BY_DISPLAY[language.toLowerCase()]);
}

/** Variant pools, in the keys the app sends (`es`/`spain`, `latam`, ...). */
const SPAIN_VARIANTS = ["spain"];
const LATAM_VARIANTS = ["latam", "mexico", "colombia", "argentina", "chile", "peru"];

const LADDER_LATAM: LevelTestRung[] = ["A1", "A2", "B1", "B2", "C1"];
const LADDER_SPAIN: LevelTestRung[] = ["A1", "A2", "B1", "B2"];

/** Stories per rung offered to the app, which picks one at random. */
const STORIES_PER_RUNG = 2;

const FORMAT_ORDER: PracticeExercise["type"][] = [
  "listen_choose",
  "meaning_in_context",
  "fill_blank",
];

function resolveVariant(variant: string | null | undefined): { key: "spain" | "latam"; pool: string[]; ladder: LevelTestRung[] } {
  const key = (variant ?? "").trim().toLowerCase();
  return key === "spain" || key === "es"
    ? { key: "spain", pool: SPAIN_VARIANTS, ladder: LADDER_SPAIN }
    : { key: "latam", pool: LATAM_VARIANTS, ladder: LADDER_LATAM };
}

/** The three single-answer formats. `listen_choose` carries no clip in the
 *  set: the app fetches the word's pre-baked ElevenLabs clip from the
 *  practice audio route, exactly as it does after a story. */
function usable(exercise: PracticeExercise): boolean {
  return FORMAT_ORDER.includes(exercise.type);
}

/**
 * Four exercises for a station: one per format in `FORMAT_ORDER`, then the
 * remaining slots with whatever formats are left, keeping the set's order.
 * Null when the story cannot fill four.
 */
export function pickStationExercises(exercises: PracticeExercise[]): PracticeExercise[] | null {
  const pool = exercises.filter(usable);
  const picked: PracticeExercise[] = [];
  for (const type of FORMAT_ORDER) {
    const next = pool.find((e) => e.type === type && !picked.includes(e));
    if (next) picked.push(next);
  }
  for (const e of pool) {
    if (picked.length >= LEVEL_TEST_STATION_SIZE) break;
    if (!picked.includes(e)) picked.push(e);
  }
  return picked.length >= LEVEL_TEST_STATION_SIZE ? picked.slice(0, LEVEL_TEST_STATION_SIZE) : null;
}

export type StationProblem = { level: LevelTestRung; reason: string };

export async function buildLevelTest(
  language: string,
  variant: string | null | undefined
): Promise<{ payload: LevelTestPayload; problems: StationProblem[] } | null> {
  const dbLanguage = LANGUAGE_BY_DISPLAY[language.toLowerCase()];
  if (!dbLanguage) return null;
  const { key, pool, ladder } = resolveVariant(variant);

  const stations: LevelTestStation[] = [];
  const problems: StationProblem[] = [];

  // One query for the candidate stories of every rung, one for their
  // exercises, instead of two per story: this route answers the app before
  // the onboarding curtain lifts, so it has to be quick.
  const candidates = await prisma.journeyStory.findMany({
    where: {
      status: "published",
      level: { in: ladder.map((l) => l.toLowerCase()) },
      audioUrl: { not: null },
      journey: { status: "active", language: dbLanguage, variant: { in: pool } },
      practiceSet: { isNot: null },
    },
    orderBy: [{ journey: { variant: "asc" } }, { topic: "asc" }, { slotIndex: "asc" }],
    select: { slug: true, title: true, level: true },
  });
  // Only the first few stories per rung go to the exercises query: every
  // candidate would drag ~20 exercise rows with their payload each.
  const CANDIDATES_PER_RUNG = 4;
  const shortlist: string[] = [];
  for (const level of ladder) {
    candidates
      .filter((c) => c.slug && c.level.toLowerCase() === level.toLowerCase())
      .slice(0, CANDIDATES_PER_RUNG)
      .forEach((c) => shortlist.push(c.slug as string));
  }
  const exercisesBySlug = await loadPersistedExercisesForSlugs(shortlist);

  for (const level of ladder) {
    let found = 0;
    for (const story of candidates) {
      if (found >= STORIES_PER_RUNG) break;
      if (!story.slug || story.level.toLowerCase() !== level.toLowerCase()) continue;
      const picked = pickStationExercises(exercisesBySlug.get(story.slug) ?? []);
      if (!picked) continue;
      stations.push({
        id: `${key}-${level.toLowerCase()}-${story.slug}`,
        level,
        story: { slug: story.slug, title: story.title ?? "" },
        exercises: picked as unknown as LevelTestExercise[],
      });
      found++;
    }
    if (found === 0) {
      problems.push({ level, reason: `no live ${level} story with four usable curated exercises (${key})` });
    }
  }

  return {
    payload: {
      language,
      variant: key,
      ladder: ladder.filter((level) => stations.some((s) => s.level === level)),
      stations,
    },
    problems,
  };
}
