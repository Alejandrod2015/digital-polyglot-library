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

  const matchingLang = allStories.filter(
    (s) => (s.language ?? "").trim().toLowerCase() === language.trim().toLowerCase()
  );

  // Show ALL matching-language stories + topic info
  const allMatchingLangDetail = matchingLang.map((s) => ({
    slug: s.slug,
    title: s.title,
    variant: s.variant,
    cefrLevel: s.cefrLevel,
    journeyEligible: s.journeyEligible,
    journeyTopic: s.journeyTopic,
    topic: s.topic,
  }));

  const tracks = await buildJourneyVariants(language, "General");

  return NextResponse.json({
    requestedLanguage: language,
    totalStories: allStories.length,
    matchingLangCount: matchingLang.length,
    allMatchingLangDetail,
    tracks: tracks.map((t) => ({
      id: t.id,
      label: t.label,
      levels: t.levels.map((lvl) => ({
        id: lvl.id,
        title: lvl.title,
        topics: lvl.topics.map((tp) => ({
          slug: tp.slug,
          label: tp.label,
          storyCount: tp.storyCount,
          storyTarget: tp.storyTarget,
          storySlugs: tp.stories.map((st) => st.storySlug),
        })),
      })),
    })),
  });
}
