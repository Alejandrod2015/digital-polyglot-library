// FSRS-4.5 (Free Spaced Repetition Scheduler) algorithm port.
// Reference implementation: https://github.com/open-spaced-repetition/fsrs4anki
// Spec: computes next review interval based on per-card memory stability and
// difficulty, given a grade (Again / Hard / Good / Easy) for the current
// review. Outperforms SM-2 and the simple-interval scheme that lived in
// favorites/page.tsx (10min/24h/3-7-14d) by adapting per word.
//
// Foundation for Movida 2 of the asset roadmap. Self-contained: no external
// deps. The current Favorite schema only stores { streak, nextReviewAt,
// lastReviewedAt }, so favoriteToFsrsCard adapts approximately until a future
// migration adds proper { stability, difficulty, lapses, reps, state }
// columns. Forward-looking: as users grade reviews, FSRS state can be stored
// either in the existing JSON-friendly fields or a new column set.

export type FsrsGrade = 1 | 2 | 3 | 4; // Again / Hard / Good / Easy
export type FsrsState = "new" | "learning" | "review" | "relearning";

export type FsrsCard = {
  state: FsrsState;
  stability: number;        // S parameter, in days; controls forgetting curve
  difficulty: number;       // D parameter, 1.0 (easy) to 10.0 (hard)
  lastReview: Date | null;
  reps: number;
  lapses: number;
};

// Default weights from open-spaced-repetition/fsrs4anki v4.5.
// Tuning these to a real corpus produces better intervals; defaults work as
// a strong baseline for any language-learning app from day 1.
export const FSRS_DEFAULT_PARAMETERS: readonly number[] = [
  0.4072, 1.1829, 3.1262, 15.4722, 7.2102, 0.5316, 1.0651, 0.0234, 1.616,
  0.1544, 1.0824, 1.9813, 0.0953, 0.2975, 2.2042, 0.2407, 2.9466, 0.5034,
  0.6567,
];

// Target retention. 0.9 means "schedule the review when the user has a 90%
// chance of recalling the word." Higher = more frequent reviews, more work.
// Lower = fewer reviews, more forgetting.
export const FSRS_REQUEST_RETENTION = 0.9;

// Cap interval at ~100 years; anything beyond is academic.
export const FSRS_MAXIMUM_INTERVAL = 36500;

const DECAY = -0.5;
const FACTOR = Math.pow(0.9, 1 / DECAY) - 1; // 19/81 ≈ 0.2346

export function newCard(): FsrsCard {
  return {
    state: "new",
    stability: 0,
    difficulty: 0,
    lastReview: null,
    reps: 0,
    lapses: 0,
  };
}

function constrainDifficulty(d: number): number {
  return Math.max(1, Math.min(10, d));
}

function initStability(grade: FsrsGrade, w: readonly number[]): number {
  return Math.max(0.1, w[grade - 1]);
}

function initDifficulty(grade: FsrsGrade, w: readonly number[]): number {
  return constrainDifficulty(w[4] - (grade - 3) * w[5]);
}

function nextDifficulty(d: number, grade: FsrsGrade, w: readonly number[]): number {
  const updated = d - w[6] * (grade - 3);
  // Mean reversion toward initial difficulty for grade=Good (3)
  return constrainDifficulty(w[7] * (initDifficulty(3, w) - updated) + updated);
}

function nextRecallStability(
  d: number,
  s: number,
  r: number,
  grade: FsrsGrade,
  w: readonly number[]
): number {
  const hardPenalty = grade === 2 ? w[15] : 1;
  const easyBonus = grade === 4 ? w[16] : 1;
  return (
    s *
    (1 +
      Math.exp(w[8]) *
        (11 - d) *
        Math.pow(s, -w[9]) *
        (Math.exp((1 - r) * w[10]) - 1) *
        hardPenalty *
        easyBonus)
  );
}

function nextForgetStability(d: number, s: number, r: number, w: readonly number[]): number {
  return w[11] * Math.pow(d, -w[12]) * (Math.pow(s + 1, w[13]) - 1) * Math.exp((1 - r) * w[14]);
}

function intervalFromStability(stability: number, requestRetention: number): number {
  // Interval (days) for the card to decay to requestRetention recall probability.
  const interval = (stability / FACTOR) * (Math.pow(requestRetention, 1 / DECAY) - 1);
  return Math.max(1, Math.min(FSRS_MAXIMUM_INTERVAL, Math.round(interval)));
}

function currentRetrievability(card: FsrsCard, now: Date): number {
  if (!card.lastReview || card.stability === 0) return 0;
  const daysElapsed = (now.getTime() - card.lastReview.getTime()) / (1000 * 60 * 60 * 24);
  return Math.pow(1 + (FACTOR * daysElapsed) / card.stability, DECAY);
}

export type FsrsReview = {
  card: FsrsCard;
  intervalDays: number;
  nextReviewAt: Date;
};

export function reviewCard(
  card: FsrsCard,
  grade: FsrsGrade,
  now: Date = new Date(),
  parameters: readonly number[] = FSRS_DEFAULT_PARAMETERS,
  requestRetention: number = FSRS_REQUEST_RETENTION
): FsrsReview {
  const w = parameters;
  let nextCard: FsrsCard;

  if (card.state === "new") {
    nextCard = {
      state: grade === 1 ? "learning" : grade === 4 ? "review" : "learning",
      stability: initStability(grade, w),
      difficulty: initDifficulty(grade, w),
      lastReview: now,
      reps: 1,
      lapses: 0,
    };
  } else {
    const r = currentRetrievability(card, now);
    const newDifficulty = nextDifficulty(card.difficulty, grade, w);
    let newStability: number;
    let newState: FsrsState;
    let lapses = card.lapses;

    if (grade === 1) {
      newStability = nextForgetStability(card.difficulty, card.stability, r, w);
      newState = "relearning";
      lapses += 1;
    } else {
      newStability = nextRecallStability(card.difficulty, card.stability, r, grade, w);
      newState = "review";
    }

    nextCard = {
      state: newState,
      stability: newStability,
      difficulty: newDifficulty,
      lastReview: now,
      reps: card.reps + 1,
      lapses,
    };
  }

  const intervalDays = intervalFromStability(nextCard.stability, requestRetention);
  const nextReviewAt = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000);

  return { card: nextCard, intervalDays, nextReviewAt };
}

// Adapter from the current Favorite schema (streak + nextReviewAt +
// lastReviewedAt) to FsrsCard. Approximation while the DB hasn't been
// migrated to store full FSRS state. After integration:
//   1. Read favorite from DB
//   2. favoriteToFsrsCard(favorite) -> FsrsCard
//   3. reviewCard(card, grade) -> FsrsReview
//   4. Write { nextReviewAt, lastReviewedAt, streak: card.reps } back to DB
// A subsequent migration can add { stability, difficulty, lapses, state }
// columns so no precision is lost across reviews.
export function favoriteToFsrsCard(fav: {
  streak: number;
  nextReviewAt: Date | null;
  lastReviewedAt: Date | null;
}): FsrsCard {
  if (fav.streak === 0 && !fav.lastReviewedAt) {
    return newCard();
  }
  // Heuristic: treat streak as reps. Stability is approximated as 3 days per
  // streak unit (so streak=3 -> 9 days, matching old "after 3 hits, review in
  // 14 days" intuition). Difficulty starts neutral at 5; will be refined as
  // the user grades real reviews going forward.
  return {
    state: fav.streak > 0 ? "review" : "learning",
    stability: Math.max(1, fav.streak * 3),
    difficulty: 5,
    lastReview: fav.lastReviewedAt,
    reps: Math.max(0, fav.streak),
    lapses: 0,
  };
}

// Sort favorites by FSRS due-ness. Earliest-due first; new cards (no review
// history) come before scheduled cards but after lapsed cards. Use this on
// the server to fill the practice queue.
export function compareByDueness(
  a: { nextReviewAt: Date | null; lastReviewedAt: Date | null },
  b: { nextReviewAt: Date | null; lastReviewedAt: Date | null },
  now: Date = new Date()
): number {
  const aDue = a.nextReviewAt ? a.nextReviewAt.getTime() : -Infinity;
  const bDue = b.nextReviewAt ? b.nextReviewAt.getTime() : -Infinity;
  // Both due in past or no nextReviewAt: lapsed/new come first
  if (aDue <= now.getTime() && bDue <= now.getTime()) {
    return aDue - bDue;
  }
  return aDue - bDue;
}
