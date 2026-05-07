export const runtime = "nodejs";

import { getAuth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { compareByDueness } from "@/lib/fsrs";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function parseLimit(raw: string | null): number {
  if (!raw) return DEFAULT_LIMIT;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
}

function parseLanguage(raw: string | null): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

// Returns favorites ordered by FSRS dueness: items whose nextReviewAt is in
// the past come first (lapsed/new), followed by items scheduled in the near
// future. Foundation for SRS-aware practice sessions in the web reader.
export async function GET(req: NextRequest): Promise<Response> {
  const { userId } = getAuth(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = parseLimit(url.searchParams.get("limit"));
  const language = parseLanguage(url.searchParams.get("language"));

  try {
    const favorites = await prisma.favorite.findMany({
      where: {
        userId,
        ...(language ? { language } : {}),
      },
      select: {
        word: true,
        translation: true,
        wordType: true,
        exampleSentence: true,
        storySlug: true,
        storyTitle: true,
        sourcePath: true,
        language: true,
        nextReviewAt: true,
        lastReviewedAt: true,
        streak: true,
      },
    });

    const now = new Date();
    const sorted = [...favorites].sort((a, b) => compareByDueness(a, b, now));
    const due = sorted.slice(0, limit).map((fav) => ({
      ...fav,
      isDue: fav.nextReviewAt === null || fav.nextReviewAt.getTime() <= now.getTime(),
      nextReviewAt: fav.nextReviewAt ? fav.nextReviewAt.toISOString() : null,
      lastReviewedAt: fav.lastReviewedAt ? fav.lastReviewedAt.toISOString() : null,
    }));

    return NextResponse.json({
      items: due,
      total: favorites.length,
      dueCount: sorted.filter(
        (f) => f.nextReviewAt === null || f.nextReviewAt.getTime() <= now.getTime()
      ).length,
    });
  } catch (err) {
    console.error("❌ Error en GET /api/practice/due:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
