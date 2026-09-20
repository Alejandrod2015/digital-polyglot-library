/**
 * Listening level test: the shared pieces between the API that serves the
 * stations and the mobile runner that plays them.
 *
 * The test is a ladder. Each rung (A1, A2, B1, B2, C1) is one STATION: four
 * curated practice exercises from one live story at that level (listen,
 * meaning, context, fill-the-gap), the very formats the learner will
 * practise with afterwards, so the test also teaches the app (user,
 * 2026-09-20: "use what we already have"). A station is PASSED with three
 * of four right (`stationPassed`). The learner climbs from the lowest rung;
 * the test ends after two failed stations in a row (`shouldStopLadder`).
 *
 * A rung counts as DEMONSTRATED only when the rung below it was passed
 * too (A1 stands alone). One slip on an easy clip therefore does not end
 * the test, and one lucky pass on a hard clip does not count. Simulated
 * on 2026-09-20 with a "first failure ends the test" rule, a B2 learner
 * with an ordinary ear landed on A0 18% of the time; with this rule, 7%,
 * while a guesser still lands on A0 98% of the time.
 *
 * Two deliberate biases towards placing LOW (decided 2026-09-20):
 *
 *  1. Three of four right per station. With four options each, guessing
 *     passes a station about 5% of the time, so a rung is rarely won by luck.
 *  2. The learner STARTS one rung below what they demonstrated
 *     (`placementFromDemonstrated`). Learning with narrated stories asks
 *     for more than the grammar level a language school certifies: the
 *     stories carry far more vocabulary and run at narration speed. The
 *     testers who began one rung under their result scored 93-100% and
 *     stayed; the ones placed at their result struggled and left or
 *     dropped several levels.
 *
 * There is no A0 station: failing A1 already places the learner at A0, so
 * a station below it would only lengthen the test. C1 is the top rung and
 * there is no C2 in the catalogue, so a learner who passes everything is
 * placed at B2 and told they can add C1 from their journeys.
 */

export const LEVEL_TEST_SCALE = ["A0", "A1", "A2", "B1", "B2", "C1"] as const;

export type LevelTestLevel = (typeof LEVEL_TEST_SCALE)[number];

/** Levels that can have a station. A0 is a result, never a rung. */
export type LevelTestRung = Exclude<LevelTestLevel, "A0">;

export type LevelTestStationResult = {
  level: LevelTestRung;
  /** Both answers right. */
  passed: boolean;
};

/**
 * The highest rung the learner actually demonstrated: passed, with the
 * rung below it passed as well (the first rung needs no confirmation).
 * `ladder` is the order the stations were offered in (lowest first);
 * results are matched by level so the caller can pass them in any order.
 * A0 when nothing qualifies.
 */
export function demonstratedLevelFromStations(
  results: readonly LevelTestStationResult[],
  ladder: readonly LevelTestRung[]
): LevelTestLevel {
  const passed = (level: LevelTestRung) => results.some((r) => r.level === level && r.passed);
  let reached: LevelTestLevel = "A0";
  ladder.forEach((level, index) => {
    if (passed(level) && (index === 0 || passed(ladder[index - 1]))) reached = level;
  });
  return reached;
}

/**
 * Whether the climb is over: two failed stations in a row. `results` must
 * be in the order they were answered.
 */
export function shouldStopLadder(results: readonly LevelTestStationResult[]): boolean {
  const n = results.length;
  return n >= 2 && !results[n - 1].passed && !results[n - 2].passed;
}

/**
 * Where the learner starts: one rung below what they demonstrated, never
 * below A0. The catalogue then maps this to the nearest track it has for
 * the learner's variant (a Spain learner placed at A0 lands on A1, the
 * lowest Spain track), which is a product decision, not a bug.
 */
export function placementFromDemonstrated(level: LevelTestLevel): LevelTestLevel {
  const index = LEVEL_TEST_SCALE.indexOf(level);
  return LEVEL_TEST_SCALE[Math.max(0, index - 1)];
}

/**
 * One practice exercise as `/api/story-practice` serves it (`PracticeExercise`
 * in `src/lib/practiceExercises.ts`). The domain package does not import the
 * web types, so the shape is opaque here; the app maps it with the same
 * function it uses for end-of-story practice.
 */
export type LevelTestExercise = { id: string; type: string } & Record<string, unknown>;

/** Exercises per station and how many must be right to pass the rung. */
export const LEVEL_TEST_STATION_SIZE = 4;
export const LEVEL_TEST_STATION_PASS = 3;

/** A rung is passed with 3 of its 4 exercises right. With four options per
 *  exercise, guessing passes a station about 5% of the time. Sizes other
 *  than 4 scale the bar to three quarters, rounded up. */
export function stationPassed(correct: number, total: number): boolean {
  if (total <= 0) return false;
  const needed = total === LEVEL_TEST_STATION_SIZE ? LEVEL_TEST_STATION_PASS : Math.ceil((total * 3) / 4);
  return correct >= needed;
}

export type LevelTestStation = {
  id: string;
  level: LevelTestRung;
  story: { slug: string; title: string };
  /** Four curated exercises of that story: listen, meaning, context and
   *  fill-the-gap, the same formats the learner will practise with. */
  exercises: LevelTestExercise[];
};

/** What `GET /api/mobile/level-test` returns. */
export type LevelTestPayload = {
  language: string;
  variant: string;
  ladder: LevelTestRung[];
  /** Every authored station; the client picks one per rung at random so
   *  two attempts do not always hear the same clips. */
  stations: LevelTestStation[];
};

/**
 * One station per rung, chosen with `random` (0 <= random() < 1) so the
 * runner can be deterministic in tests. Rungs with no station are dropped
 * from the ladder, which shortens the test rather than breaking it.
 */
export function pickStations(
  payload: Pick<LevelTestPayload, "ladder" | "stations">,
  random: () => number = Math.random
): LevelTestStation[] {
  const picked: LevelTestStation[] = [];
  for (const level of payload.ladder) {
    const candidates = payload.stations.filter((s) => s.level === level);
    if (candidates.length === 0) continue;
    const index = Math.min(candidates.length - 1, Math.floor(random() * candidates.length));
    picked.push(candidates[index]);
  }
  return picked;
}
