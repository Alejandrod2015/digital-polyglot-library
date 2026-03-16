import { unstable_cache } from "next/cache";
import { groq } from "next-sanity";
import { client } from "@/sanity/lib/client";
import { resolveContentVariant } from "@/lib/languageVariant";
import type { CefrLevel, Level } from "@/types/books";

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
  };
}

const getPublishedStandaloneStoriesCached = unstable_cache(
  async (): Promise<PublicStandaloneStory[]> => {
    const query = groq`*[_type == "standaloneStory" && published == true] | order(_createdAt desc){
      ${standaloneStoryFields}
    }`;

    const stories = await client.fetch<PublicStandaloneStory[]>(query);
    return stories.map(normalizeStandaloneStory);
  },
  ["published-standalone-stories-v1"],
  { revalidate: 60, tags: ["published-standalone-stories"] }
);

function isJourneyAssignedStandaloneStory(story: Pick<PublicStandaloneStory, "journeyEligible">) {
  return story.journeyEligible === true;
}

export async function getPublishedStandaloneStories(
  options: GetPublishedStandaloneStoriesOptions = {}
): Promise<PublicStandaloneStory[]> {
  const stories = await getPublishedStandaloneStoriesCached();
  if (options.includeJourneyStories) {
    return stories;
  }

  return stories.filter((story) => !isJourneyAssignedStandaloneStory(story));
}

export async function getStandaloneStoryBySlug(
  slug: string
): Promise<PublicStandaloneStory | null> {
  const query = groq`*[
    _type == "standaloneStory" &&
    published == true &&
    slug.current == $slug
  ][0]{
    ${standaloneStoryFields}
  }`;

  const story = await client.fetch<PublicStandaloneStory | null>(query, { slug });
  return story ? normalizeStandaloneStory(story) : null;
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

  const stories = await client.fetch<PublicStandaloneStory[]>(query, { ids });
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

  const stories = await client.fetch<PublicStandaloneStory[]>(query, { slugs });
  return stories.map(normalizeStandaloneStory);
}
