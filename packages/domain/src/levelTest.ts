/**
 * Listening level test: the shared pieces between the API that serves the
 * stations and the mobile runner that plays them.
 *
 * The test is a ladder. Each rung (A1, A2, B1, B2, C1) is one STATION: a
 * clip of real story audio at that level, one comprehension question and
 * one vocabulary question from that same story. A station is PASSED only
 * when both answers are right. The learner climbs from the lowest rung and
 * the first station they fail ends the test.
 *
 * Two deliberate biases towards placing LOW (decided 2026-09-20):
 *
 *  1. Both answers must be right. With 3 and 4 options, guessing passes a
 *     station about 8% of the time, so a rung is rarely won by luck.
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
 * The highest rung the learner actually demonstrated: every station from
 * the bottom of the ladder up to it was passed. `ladder` is the order the
 * stations were offered in (lowest first); results are matched by level so
 * the caller can pass them in any order. A0 when the first rung failed or
 * nothing was answered.
 */
export function demonstratedLevelFromStations(
  results: readonly LevelTestStationResult[],
  ladder: readonly LevelTestRung[]
): LevelTestLevel {
  let reached: LevelTestLevel = "A0";
  for (const level of ladder) {
    const station = results.find((r) => r.level === level);
    if (!station || !station.passed) break;
    reached = level;
  }
  return reached;
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

/** One clip of the station: a story paragraph with its own mp3. */
export type LevelTestClip = {
  url: string;
  text: string;
  durationSec: number;
};

export type LevelTestChoiceQuestion = {
  question: string;
  options: string[];
  answerIndex: number;
};

export type LevelTestStation = {
  id: string;
  level: LevelTestRung;
  story: { slug: string; title: string };
  clips: LevelTestClip[];
  comprehension: LevelTestChoiceQuestion;
  vocab: LevelTestChoiceQuestion & { word: string };
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
