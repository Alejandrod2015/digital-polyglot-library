import { unstable_cache } from "next/cache";
import { groq } from "next-sanity";
import { freshClient } from "@/sanity/lib/client";
import { resolveContentVariant } from "@/lib/languageVariant";
import type { CefrLevel, Level } from "@/types/books";
import { getJourneyFocusFromLearningGoal, normalizeJourneyFocus, type JourneyFocus } from "@/lib/onboarding";

export type PublicStandaloneStory = {
  id: string;
  slug: string;
  title: string;
  text: string;
  vocabRaw: string | null;
  theme: string[];
  language: string | null;
  variant: string | null;
  region: string | null;
  level: string | null;
  cefrLevel: string | null;
  focus: string | null;
  journeyFocus: JourneyFocus | null;
  topic: string | null;
  journeyEligible: boolean | null;
  journeyTopic: string | null;
  journeyOrder: number | null;
  coverUrl: string | null;
  audioUrl: string | null;
  createdAt: string;
};

type GetPublishedStandaloneStoriesOptions = {
  includeJourneyStories?: boolean;
};

const standaloneStoryFields = `
  "id": _id,
  "slug": slug.current,
  title,
  text,
  vocabRaw,
  "theme": coalesce(theme, []),
  language,
  variant,
  "region": coalesce(region_es, region_en, region_fr, region_it, region_pt, region_de),
  level,
  cefrLevel,
  focus,
  journeyFocus,
  topic,
  journeyEligible,
  journeyTopic,
  journeyOrder,
  "coverUrl": coalesce(coverUrl, cover.asset->url),
  "audioUrl": coalesce(audioUrl, audio.asset->url),
  "createdAt": _createdAt
`;

const legacyLevelFallback: Record<Level, CefrLevel> = {
  beginner: "a1",
  intermediate: "b1",
  advanced: "c1",
};

function normalizeStandaloneStory(story: PublicStandaloneStory): PublicStandaloneStory {
  const resolvedLevel =
    typeof story.level === "string" &&
    ["beginner", "intermediate", "advanced"].includes(story.level)
      ? (story.level as Level)
      : null;

  return {
    ...story,
    variant:
      resolveContentVariant({
        language: story.language,
        variant: story.variant,
        region: story.region,
      }) ?? null,
    cefrLevel:
      story.cefrLevel ??
      (resolvedLevel ? legacyLevelFallback[resolvedLevel] : null),
    journeyFocus:
      normalizeJourneyFocus(story.journeyFocus) ??
      getJourneyFocusFromLearningGoal(null),
  };
}

const getPublishedStandaloneStoriesCached = unstable_cache(
  async (): Promise<PublicStandaloneStory[]> => {
    const query = groq`*[_type == "standaloneStory" && published == true] | order(_createdAt desc){
      ${standaloneStoryFields}
    }`;

    const stories = await freshClient.fetch<PublicStandaloneStory[]>(query);
    return stories.map(normalizeStandaloneStory);
  },
  ["published-standalone-stories-v1"],
  { revalidate: 60, tags: ["published-standalone-stories"] }
);

async function getPublishedJourneyStandaloneStories(): Promise<PublicStandaloneStory[]> {
  const query = groq`*[
    _type == "standaloneStory" &&
    journeyEligible == true
  ] | order(_createdAt desc){
    ${standaloneStoryFields}
  }`;

  const stories = await freshClient.fetch<PublicStandaloneStory[]>(query);
  return stories.map(normalizeStandaloneStory);
}

export function isJourneyAssignedStandaloneStory(
  story: Pick<PublicStandaloneStory, "journeyEligible" | "journeyTopic" | "journeyOrder">
) {
  if (story.journeyEligible === true) {
    return true;
  }

  if (typeof story.journeyTopic === "string" && story.journeyTopic.trim() !== "") {
    return true;
  }

  return typeof story.journeyOrder === "number" && Number.isFinite(story.journeyOrder);
}

export async function getPublishedStandaloneStories(
  options: GetPublishedStandaloneStoriesOptions = {}
): Promise<PublicStandaloneStory[]> {
  if (options.includeJourneyStories) {
    const [sanityStories, prismaStories] = await Promise.all([
      getPublishedJourneyStandaloneStories(),
      // Dynamic import avoids a circular dependency (journeyStories imports PublicStandaloneStory from this module).
      import("@/lib/journeyStories").then((m) => m.getPublishedJourneyStories()),
    ]);
    console.log("[journey-debug] getPublishedStandaloneStories merge", {
      sanityCount: sanityStories.length,
      prismaCount: prismaStories.length,
      prismaSample: prismaStories.slice(0, 2).map((s) => ({
        slug: s.slug,
        language: s.language,
        variant: s.variant,
        cefrLevel: s.cefrLevel,
        journeyEligible: s.journeyEligible,
        journeyTopic: s.journeyTopic,
      })),
    });
    const sanitySlugs = new Set(sanityStories.map((story) => story.slug));
    const merged = [...sanityStories];
    for (const story of prismaStories) {
      if (sanitySlugs.has(story.slug)) continue;
      merged.push(story);
    }
    return merged;
  }

  const stories = await getPublishedStandaloneStoriesCached();
  return stories.filter((story) => !isJourneyAssignedStandaloneStory(story));
}

export async function getStandaloneStoryBySlug(
  slug: string
): Promise<PublicStandaloneStory | null> {
  const getStandaloneStoryBySlugCached = unstable_cache(
    async (cachedSlug: string): Promise<PublicStandaloneStory | null> => {
      const query = groq`*[
        _type == "standaloneStory" &&
        published == true &&
        slug.current == $slug
      ][0]{
        ${standaloneStoryFields}
      }`;

      const story = await freshClient.fetch<PublicStandaloneStory | null>(query, { slug: cachedSlug });
      return story ? normalizeStandaloneStory(story) : null;
    },
    ["published-standalone-story-by-slug-v1", slug],
    { revalidate: 60, tags: ["published-standalone-stories", `standalone-story:${slug}`] }
  );

  return getStandaloneStoryBySlugCached(slug);
}

export async function getStandaloneStoriesByIds(
  ids: string[]
): Promise<PublicStandaloneStory[]> {
  if (ids.length === 0) return [];

  const query = groq`*[
    _type == "standaloneStory" &&
    published == true &&
    _id in $ids
  ]{
    ${standaloneStoryFields}
  }`;

  const stories = await freshClient.fetch<PublicStandaloneStory[]>(query, { ids });
  return stories.map(normalizeStandaloneStory);
}

export async function getStandaloneStoriesBySlugs(
  slugs: string[]
): Promise<PublicStandaloneStory[]> {
  if (slugs.length === 0) return [];

  const query = groq`*[
    _type == "standaloneStory" &&
    published == true &&
    slug.current in $slugs
  ]{
    ${standaloneStoryFields}
  }`;

  const stories = await freshClient.fetch<PublicStandaloneStory[]>(query, { slugs });
  return stories.map(normalizeStandaloneStory);
}
