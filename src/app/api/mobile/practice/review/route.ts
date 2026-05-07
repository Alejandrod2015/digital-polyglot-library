export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getMobileSessionFromRequest } from "@/lib/mobileSession";
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

// Mobile mirror of /api/practice/review. Mobile session token auth.
// Same body and response shape as the web variant.
export async function POST(req: NextRequest): Promise<Response> {
  const session = getMobileSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json: unknown = await req.json().catch(() => null);
  if (!isReviewBody(json)) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const outcome = await applyReviewToFavorite({
    userId: session.sub,
    word: json.word,
    grade: json.grade as FsrsGrade,
    language: json.language?.trim() || undefined,
  });

  if (!outcome.ok) {
    if (outcome.error.kind === "not_found") {
      return NextResponse.json({ error: "Favorite not found" }, { status: 404 });
    }
    console.error("❌ Error en POST /api/mobile/practice/review:", outcome.error.message);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  return NextResponse.json(outcome.result);
}
