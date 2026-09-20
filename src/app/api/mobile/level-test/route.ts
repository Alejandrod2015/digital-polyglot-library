export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { buildLevelTest } from "@/lib/levelTest/buildLevelTest";

/**
 * GET /api/mobile/level-test?language=Spanish&variant=latam
 *
 * The listening level test for a language and variant: the ladder of
 * rungs and every authored station (clip URLs, text, both questions). No
 * session needed: the onboarding runs it before the learner has a journey,
 * and the clips are public story audio anyway. 404 when the language has
 * no authored test, so the app can fall back to its bundled questions.
 *
 * Served from the live catalogue on every call, so a story that goes
 * offline drops out of the test on its own; cached for an hour at the
 * edge because the catalogue changes a few times a week, not a minute.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const language = req.nextUrl.searchParams.get("language")?.trim();
  const variant = req.nextUrl.searchParams.get("variant")?.trim() || null;
  if (!language) {
    return NextResponse.json({ error: "language is required" }, { status: 400 });
  }

  try {
    const built = await buildLevelTest(language, variant);
    if (!built) {
      return NextResponse.json({ error: "No level test for this language" }, { status: 404 });
    }
    if (built.problems.length > 0) {
      console.warn("[level-test] stations left out:", built.problems);
    }
    if (built.payload.ladder.length === 0) {
      return NextResponse.json({ error: "Level test has no stations" }, { status: 503 });
    }
    return NextResponse.json(built.payload, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch (err) {
    console.error("Error in GET /api/mobile/level-test:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
