import { NextRequest, NextResponse } from "next/server";
import { getStandaloneStoriesBySlugs } from "@/lib/standaloneStories";
import {
  getConfiguredStandaloneStorySlugs,
  getStandaloneStoryAudioSegments,
} from "@/lib/standaloneStoryAudioSegments";
import { filterHearableSlugs, getAudioViewerFromRequest } from "@/lib/audioAccess";
import { signAudioUrlsDeep } from "@/lib/mediaSigning";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slugsParam = searchParams.get("slugs");
    if (!slugsParam) {
      return NextResponse.json({ stories: [] });
    }

    const requestedSlugs = Array.from(
      new Set(
        slugsParam
          .split(",")
          .map((slug) => slug.trim().toLowerCase())
          .filter(Boolean)
      )
    );

    if (requestedSlugs.length === 0) {
      return NextResponse.json({ stories: [] });
    }

    const configuredSlugs = new Set(getConfiguredStandaloneStorySlugs());
    // El muro 2026-09, aplicado tambien aqui: sin esto cualquier anonimo se
    // llevaba los audioUrl con un GET.
    const viewer = await getAudioViewerFromRequest(req);
    const hearableSlugs = await filterHearableSlugs(
      viewer,
      requestedSlugs.filter((slug) => configuredSlugs.has(slug))
    );
    const eligibleSlugs = requestedSlugs.filter((slug) => hearableSlugs.has(slug));
    if (eligibleSlugs.length === 0) {
      return NextResponse.json({ stories: [] });
    }

    const stories = await getStandaloneStoriesBySlugs(eligibleSlugs);
    const payload = stories
      .map((story) => {
        const segments = getStandaloneStoryAudioSegments(story.slug);
        return {
          slug: story.slug,
          audioUrl: story.audioUrl,
          audioSegments: segments,
        };
      })
      .filter((story) => typeof story.audioUrl === "string" && story.audioUrl.trim() && story.audioSegments.length > 0);

    return NextResponse.json(signAudioUrlsDeep({ stories: payload }));
  } catch (error) {
    console.error("[standalone-story-audio] Failed to load audio metadata:", error);
    return NextResponse.json(
      { error: "Failed to load standalone story audio metadata" },
      { status: 500 }
    );
  }
}
