export const runtime = "nodejs";

import { getAuth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { applyReviewToFavorite } from "@/lib/practiceReview";
import type { FsrsGrade } from "@/lib/fsrs";

type ReviewBody = {
  word: string;
  grade: number;
  language?: string;
};

function isReviewBody(value: unknown): value is ReviewBody {
  if (!value || typeof value !== "object") return false;
  const body = value as Record<string, unknown>;
  return (
    typeof body.word === "string" &&
    body.word.trim().length > 0 &&
    typeof body.grade === "number" &&
    Number.isInteger(body.grade) &&
    body.grade >= 1 &&
    body.grade <= 4 &&
    (body.language === undefined || typeof body.language === "string")
  );
}

// POST /api/practice/review
// Body: { word: string, grade: 1-4 (Again|Hard|Good|Easy), language?: string }
// Computes the next FSRS review server-side and persists nextReviewAt /
// lastReviewedAt / streak on the user's Favorite. Returns the updated state
// + the FSRS card so the client can show interval feedback.
export async function POST(req: NextRequest): Promise<Response> {
  const { userId } = getAuth(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json: unknown = await req.json().catch(() => null);
  if (!isReviewBody(json)) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const outcome = await applyReviewToFavorite({
    userId,
    word: json.word,
    grade: json.grade as FsrsGrade,
    language: json.language?.trim() || undefined,
  });

  if (!outcome.ok) {
    if (outcome.error.kind === "not_found") {
      return NextResponse.json({ error: "Favorite not found" }, { status: 404 });
    }
    console.error("❌ Error en POST /api/practice/review:", outcome.error.message);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  revalidateTag("favorites-by-user");
  return NextResponse.json(outcome.result);
}
