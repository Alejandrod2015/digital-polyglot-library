import { NextResponse } from "next/server";
import { getPublishedStandaloneStories } from "@/lib/standaloneStories";
import { buildJourneyVariants } from "@/app/journey/journeyData";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/debug/journey-pipeline?language=German
 * Temporary debug endpoint to inspect the journey build pipeline.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const language = url.searchParams.get("language") ?? "German";

  const allStories = await getPublishedStandaloneStories({ includeJourneyStories: true });

  const languageCounts = new Map<string, number>();
  for (const s of allStories) {
    const key = (s.language ?? "(null)").toLowerCase();
    languageCounts.set(key, (languageCounts.get(key) ?? 0) + 1);
  }

  const matchingLang = allStories.filter(
    (s) => (s.language ?? "").trim().toLowerCase() === language.trim().toLowerCase()
  );

  const tracks = await buildJourneyVariants(language, "General");

  return NextResponse.json({
    requestedLanguage: language,
    totalStories: allStories.length,
    languageCounts: Object.fromEntries(languageCounts),
    matchingLangCount: matchingLang.length,
    matchingLangSample: matchingLang.slice(0, 3).map((s) => ({
      slug: s.slug,
      title: s.title,
      language: s.language,
      variant: s.variant,
      region: s.region,
      cefrLevel: s.cefrLevel,
      level: s.level,
      journeyEligible: s.journeyEligible,
      journeyTopic: s.journeyTopic,
      topic: s.topic,
    })),
    tracksCount: tracks.length,
    tracks: tracks.map((t) => ({
      id: t.id,
      label: t.label,
      levelsCount: t.levels.length,
      totalStories: t.levels.reduce((sum, lvl) => sum + lvl.topics.reduce((s, tp) => s + tp.storyCount, 0), 0),
    })),
  });
}
