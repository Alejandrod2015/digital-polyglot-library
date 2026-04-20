import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { PublicStandaloneStory } from "@/lib/standaloneStories";

/**
 * Converts a JourneyStory from PostgreSQL into PublicStandaloneStory shape
 * so the reader can display it identically to Sanity stories.
 */
function toPublicStory(s: {
  id: string;
  slug: string | null;
  title: string | null;
  text: string | null;
  synopsis: string | null;
  vocab: any;
  level: string;
  topic: string;
  coverDone: boolean;
  coverUrl: string | null;
  audioUrl: string | null;
  journey: { language: string; variant: string };
  createdAt: Date;
}): PublicStandaloneStory {
  return {
    id: `journey-${s.id}`,
    slug: s.slug || s.id,
    title: s.title || "Untitled",
    text: s.text || "",
    vocabRaw: s.vocab ? JSON.stringify(
      Array.isArray(s.vocab)
        ? (s.vocab as any[]).map((v: any) => ({
            word: v.word ?? "",
            definition: v.definition ?? v.translation ?? "",
            ...(v.type ? { type: v.type } : {}),
            ...(v.surface ? { surface: v.surface } : {}),
          }))
        : s.vocab
    ) : null,
    theme: [s.topic],
    language: s.journey.language,
    variant: s.journey.variant,
    region: s.journey.variant,
    level: s.level,
    cefrLevel: s.level,
    focus: null,
    journeyFocus: null,
    topic: s.topic,
    journeyEligible: true,
    journeyTopic: s.topic,
    journeyOrder: null,
    coverUrl: s.coverUrl ?? null,
    audioUrl: s.audioUrl ?? null,
    createdAt: s.createdAt.toISOString(),
  };
}

/**
 * Get all published journey stories from PostgreSQL.
 * Cached for 60s with ISR revalidation.
 */
export const getPublishedJourneyStories = unstable_cache(
  async (): Promise<PublicStandaloneStory[]> => {
    try {
      console.log("[journey-debug] getPublishedJourneyStories: running prisma.journeyStory.findMany");
      const stories = await prisma.journeyStory.findMany({
        where: { status: "published" },
        include: { journey: { select: { language: true, variant: true } } },
        orderBy: { createdAt: "desc" },
      });
      console.log("[journey-debug] getPublishedJourneyStories: raw count", {
        rawCount: stories.length,
        sampleRaw: stories.slice(0, 2).map((s) => ({
          id: s.id,
          status: s.status,
          title: s.title,
          hasText: !!s.text,
          level: s.level,
          topic: s.topic,
          journeyLanguage: s.journey?.language,
          journeyVariant: s.journey?.variant,
        })),
      });
      const filtered = stories.filter((s) => s.text && s.title).map(toPublicStory);
      console.log("[journey-debug] getPublishedJourneyStories: filtered count", filtered.length);
      return filtered;
    } catch (err) {
      console.error("[journey-debug] getPublishedJourneyStories ERROR", err);
      return [];
    }
  },
  ["published-journey-stories-v2"],
  { revalidate: 60, tags: ["published-journey-stories"] }
);

/**
 * Get a single published journey story by slug.
 */
export async function getJourneyStoryBySlug(
  slug: string
): Promise<PublicStandaloneStory | null> {
  try {
    const story = await prisma.journeyStory.findFirst({
      where: { slug, status: "published" },
      include: { journey: { select: { language: true, variant: true } } },
    });
    if (!story || !story.text || !story.title) return null;
    return toPublicStory(story);
  } catch {
    return null;
  }
}
