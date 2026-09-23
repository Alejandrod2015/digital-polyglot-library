export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { buildLevelTest } from "@/lib/levelTest/buildLevelTest";
import { signAudioUrlsDeep } from "@/lib/mediaSigning";

/**
 * GET /api/mobile/level-test?language=Spanish&variant=latam
 *
 * The level test for a language and variant: the ladder of rungs and, per
 * rung, two live stories with four curated practice exercises each (the
 * same ones `/api/story-practice` serves). No session needed: the clips
 * are story audio the reader already plays. 404 when the language has no
 * test, so the app falls back to its bundled grammar quiz.
 *
 * Built from the live catalogue on every call, so a story that goes
 * offline drops out on its own; cached for an hour at the edge because the
 * catalogue changes a few times a week, not a minute. Audio URLs are
 * signed here like the practice route does.
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
    return NextResponse.json(signAudioUrlsDeep(built.payload), {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=3600" },
    });
  } catch (err) {
    console.error("Error in GET /api/mobile/level-test:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
