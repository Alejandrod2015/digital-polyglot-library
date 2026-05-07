import { prisma } from "@/lib/prisma";
import { reviewCard, favoriteToFsrsCard, type FsrsGrade, type FsrsCard } from "@/lib/fsrs";

// Server-side helper that applies a single FSRS review to a user's Favorite
// and persists the new schedule. Pure function from the consumer's POV: pass
// (userId, word, grade) and get back the updated review state. Foundation
// for /api/practice/review (web) and /api/mobile/practice/review (mobile).
//
// Why this lives in lib (not inline in the route): both web and mobile
// endpoints share the same logic, and a future Studio-side script (e.g.,
// "regrade all old favorites with neutral state") can call it the same way.

export type ApplyReviewInput = {
  userId: string;
  word: string;
  grade: FsrsGrade;
  language?: string;
  now?: Date;
};

export type ApplyReviewResult = {
  word: string;
  grade: FsrsGrade;
  intervalDays: number;
  nextReviewAt: string;
  lastReviewedAt: string;
  streak: number;
  card: FsrsCard;
};

export type ApplyReviewError =
  | { kind: "not_found" }
  | { kind: "db_error"; message: string };

export async function applyReviewToFavorite(
  input: ApplyReviewInput
): Promise<{ ok: true; result: ApplyReviewResult } | { ok: false; error: ApplyReviewError }> {
  const { userId, word, grade, language, now } = input;
  const reviewTime = now ?? new Date();

  let favorite;
  try {
    favorite = await prisma.favorite.findFirst({
      where: {
        userId,
        word,
        ...(language ? { language } : {}),
      },
    });
  } catch (err) {
    return {
      ok: false,
      error: { kind: "db_error", message: err instanceof Error ? err.message : String(err) },
    };
  }

  if (!favorite) {
    return { ok: false, error: { kind: "not_found" } };
  }

  const card = favoriteToFsrsCard({
    streak: favorite.streak,
    nextReviewAt: favorite.nextReviewAt,
    lastReviewedAt: favorite.lastReviewedAt,
  });

  const review = reviewCard(card, grade, reviewTime);

  // Persist using the existing Favorite columns. Streak stores card.reps as
  // an approximation (current schema doesn't carry stability/difficulty
  // separately). When a future migration adds those columns, this helper
  // can write them too without changing the consumer API.
  let updated;
  try {
    updated = await prisma.favorite.update({
      where: { id: favorite.id },
      data: {
        nextReviewAt: review.nextReviewAt,
        lastReviewedAt: reviewTime,
        streak: Math.max(0, review.card.reps),
      },
    });
  } catch (err) {
    return {
      ok: false,
      error: { kind: "db_error", message: err instanceof Error ? err.message : String(err) },
    };
  }

  return {
    ok: true,
    result: {
      word: updated.word,
      grade,
      intervalDays: review.intervalDays,
      nextReviewAt: review.nextReviewAt.toISOString(),
      lastReviewedAt: reviewTime.toISOString(),
      streak: updated.streak,
      card: review.card,
    },
  };
}
