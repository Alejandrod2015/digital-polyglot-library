import { describe, it, expect } from "vitest";
import {
  reviewCard,
  newCard,
  favoriteToFsrsCard,
  compareByDueness,
  FSRS_DEFAULT_PARAMETERS,
} from "../fsrs";

describe("fsrs", () => {
  describe("newCard", () => {
    it("starts in 'new' state with zero stats", () => {
      const card = newCard();
      expect(card.state).toBe("new");
      expect(card.stability).toBe(0);
      expect(card.difficulty).toBe(0);
      expect(card.reps).toBe(0);
      expect(card.lapses).toBe(0);
      expect(card.lastReview).toBeNull();
    });
  });

  describe("reviewCard on new card", () => {
    const now = new Date("2026-05-07T12:00:00Z");

    it("Easy (4) on new card → stability matches FSRS_DEFAULT_PARAMETERS[3]", () => {
      const review = reviewCard(newCard(), 4, now);
      expect(review.card.stability).toBeCloseTo(FSRS_DEFAULT_PARAMETERS[3], 4);
      expect(review.card.state).toBe("review");
      expect(review.card.reps).toBe(1);
      expect(review.intervalDays).toBeGreaterThan(0);
    });

    it("Again (1) on new card → small stability, learning state", () => {
      const review = reviewCard(newCard(), 1, now);
      expect(review.card.stability).toBeCloseTo(FSRS_DEFAULT_PARAMETERS[0], 4);
      expect(review.card.state).toBe("learning");
    });

    it("difficulty stays in [1, 10]", () => {
      for (const grade of [1, 2, 3, 4] as const) {
        const review = reviewCard(newCard(), grade, now);
        expect(review.card.difficulty).toBeGreaterThanOrEqual(1);
        expect(review.card.difficulty).toBeLessThanOrEqual(10);
      }
    });
  });

  describe("reviewCard interval scaling", () => {
    const now = new Date("2026-05-07T12:00:00Z");

    it("Easy interval > Good interval > Hard interval on new card", () => {
      const easy = reviewCard(newCard(), 4, now);
      const good = reviewCard(newCard(), 3, now);
      const hard = reviewCard(newCard(), 2, now);
      expect(easy.intervalDays).toBeGreaterThan(good.intervalDays);
      expect(good.intervalDays).toBeGreaterThan(hard.intervalDays);
    });

    it("Again resets stability low (relearning)", () => {
      const card = reviewCard(newCard(), 4, now).card;
      const later = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
      const lapse = reviewCard(card, 1, later);
      expect(lapse.card.state).toBe("relearning");
      expect(lapse.card.lapses).toBe(1);
      // Forget-stability should be lower than the prior recall stability
      expect(lapse.card.stability).toBeLessThan(card.stability);
    });

    it("repeated Goods grow stability monotonically", () => {
      let card = newCard();
      let prev = 0;
      let now = new Date("2026-05-07T12:00:00Z");
      for (let i = 0; i < 5; i += 1) {
        const review = reviewCard(card, 3, now);
        expect(review.card.stability).toBeGreaterThan(prev);
        prev = review.card.stability;
        card = review.card;
        // Move "now" forward to the scheduled review
        now = review.nextReviewAt;
      }
      expect(card.reps).toBe(5);
    });
  });

  describe("favoriteToFsrsCard adapter", () => {
    it("never-reviewed favorite (streak=0, no lastReviewedAt) → fresh new card", () => {
      const card = favoriteToFsrsCard({ streak: 0, nextReviewAt: null, lastReviewedAt: null });
      expect(card.state).toBe("new");
      expect(card.reps).toBe(0);
    });

    it("reviewed favorite (streak>0) → review state with proportional stability", () => {
      const lastReview = new Date("2026-05-01T12:00:00Z");
      const card = favoriteToFsrsCard({
        streak: 3,
        nextReviewAt: new Date("2026-05-15T12:00:00Z"),
        lastReviewedAt: lastReview,
      });
      expect(card.state).toBe("review");
      expect(card.reps).toBe(3);
      expect(card.stability).toBe(9); // 3 streak * 3 days/streak
      expect(card.lastReview).toEqual(lastReview);
    });
  });

  describe("compareByDueness", () => {
    const now = new Date("2026-05-07T12:00:00Z");
    const past = new Date("2026-05-05T12:00:00Z");
    const future = new Date("2026-05-15T12:00:00Z");

    it("due-in-past comes before due-in-future", () => {
      const a = { nextReviewAt: past, lastReviewedAt: past };
      const b = { nextReviewAt: future, lastReviewedAt: past };
      expect(compareByDueness(a, b, now)).toBeLessThan(0);
    });

    it("never-scheduled (null nextReviewAt) sorts before scheduled future", () => {
      const a = { nextReviewAt: null, lastReviewedAt: null };
      const b = { nextReviewAt: future, lastReviewedAt: null };
      expect(compareByDueness(a, b, now)).toBeLessThan(0);
    });
  });
});
