import { NextResponse } from "next/server";
import { getStandaloneStoriesBySlugs } from "@/lib/standaloneStories";
import {
  getConfiguredStandaloneStorySlugs,
  getStandaloneStoryAudioSegments,
} from "@/lib/standaloneStoryAudioSegments";

export async function GET(req: Request) {
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
    const eligibleSlugs = requestedSlugs.filter((slug) => configuredSlugs.has(slug));
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

    return NextResponse.json({ stories: payload });
  } catch (error) {
    console.error("[standalone-story-audio] Failed to load audio metadata:", error);
    return NextResponse.json(
      { error: "Failed to load standalone story audio metadata" },
      { status: 500 }
    );
  }
}
