import { unstable_cache } from "next/cache";
import { groq } from "next-sanity";
import { client } from "@/sanity/lib/client";

export type PublicStandaloneStory = {
  id: string;
  slug: string;
  title: string;
  text: string;
  vocabRaw: string | null;
  theme: string[];
  language: string | null;
  region: string | null;
  level: string | null;
  focus: string | null;
  topic: string | null;
  coverUrl: string | null;
  audioUrl: string | null;
  createdAt: string;
};

const standaloneStoryFields = `
  "id": _id,
  "slug": slug.current,
  title,
  text,
  vocabRaw,
  "theme": coalesce(theme, []),
  language,
  "region": coalesce(region_es, region_en, region_fr, region_it, region_pt, region_de),
  level,
  focus,
  topic,
  "coverUrl": cover.asset->url,
  "audioUrl": audio.asset->url,
  "createdAt": _createdAt
`;

const getPublishedStandaloneStoriesCached = unstable_cache(
  async (): Promise<PublicStandaloneStory[]> => {
    const query = groq`*[_type == "standaloneStory" && published == true] | order(_createdAt desc){
      ${standaloneStoryFields}
    }`;

    return client.fetch<PublicStandaloneStory[]>(query);
  },
  ["published-standalone-stories-v1"],
  { revalidate: 60, tags: ["published-standalone-stories"] }
);

export async function getPublishedStandaloneStories(): Promise<PublicStandaloneStory[]> {
  return getPublishedStandaloneStoriesCached();
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

  return client.fetch<PublicStandaloneStory | null>(query, { slug });
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

  return client.fetch<PublicStandaloneStory[]>(query, { ids });
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

  return client.fetch<PublicStandaloneStory[]>(query, { slugs });
}
