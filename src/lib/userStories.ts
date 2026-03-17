// /src/lib/userStories.ts
import { prisma } from "@/lib/prisma";
import { client as sanityClient } from "@/sanity/lib/client";
import { groq } from "next-sanity";
import { unstable_cache } from "next/cache";

export type PublicUserStory = {
  id: string;
  slug: string;
  title: string;
  language: string | null;
  variant?: string | null;
  level: string | null;
  cefrLevel?: string | null;
  focus?: string | null;
  topic: string | null;
  region: string | null;
  text: string | null;
  audioUrl: string | null;
  coverUrl: string | null;
  coverFilename: string | null;
  createdAt: Date;
};

type CreateStoryMirror = {
  createStoryId: string;
  slug: string;
  title: string;
  text: string | null;
  vocabRaw: string | null;
  language: string | null;
  variant: string | null;
  region: string | null;
  level: string | null;
  cefrLevel: string | null;
  focus: string | null;
  topic: string | null;
  coverUrl: string | null;
  audioUrl: string | null;
};

function isTransientDbError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const maybe = err as { code?: string; message?: string };
  if (maybe.code === "P1001" || maybe.code === "P2024") return true;
  if (typeof maybe.message !== "string") return false;
  return (
    maybe.message.includes("connection pool") ||
    maybe.message.includes("Can't reach database server")
  );
}

const createStoryMirrorFields = `
  createStoryId,
  "slug": slug.current,
  title,
  text,
  vocabRaw,
  language,
  variant,
  "region": coalesce(region_es, region_en, region_fr, region_it, region_pt, region_de),
  level,
  cefrLevel,
  focus,
  topic,
  "coverUrl": coalesce(coverUrl, cover.asset->url),
  "audioUrl": coalesce(audioUrl, audio.asset->url)
`;

function mapPublicUserStoryToMirror(story: PublicUserStory): CreateStoryMirror {
  return {
    createStoryId: story.id,
    slug: story.slug,
    title: story.title,
    text: story.text,
    vocabRaw: null,
    language: story.language,
    variant: story.variant ?? null,
    region: story.region,
    level: story.level,
    cefrLevel: story.cefrLevel ?? null,
    focus: story.focus ?? null,
    topic: story.topic,
    coverUrl: story.coverUrl,
    audioUrl: story.audioUrl,
  };
}

async function getPublishedCreateStoryMirrors(): Promise<CreateStoryMirror[]> {
  const query = groq`*[_type == "standaloneStory" && sourceType == "create" && published == true]{
    ${createStoryMirrorFields}
  }`;

  return sanityClient.fetch<CreateStoryMirror[]>(query);
}

const getPublishedCreateStoryMirrorsCached = unstable_cache(
  async (): Promise<CreateStoryMirror[]> => getPublishedCreateStoryMirrors(),
  ["published-create-story-mirrors-v1"],
  { revalidate: 60, tags: ["published-create-story-mirrors"] }
);

function mergeUserStoryWithMirror(
  story: PublicUserStory,
  mirror?: CreateStoryMirror | null
): PublicUserStory {
  if (!mirror) return story;

  return {
    ...story,
    slug: mirror.slug || story.slug,
    title: mirror.title || story.title,
    text: typeof mirror.text === "string" ? mirror.text : story.text,
    language: mirror.language ?? story.language,
    variant: mirror.variant ?? story.variant ?? null,
    level: mirror.level ?? story.level,
    cefrLevel: mirror.cefrLevel ?? story.cefrLevel ?? null,
    focus: mirror.focus ?? story.focus ?? null,
    topic: mirror.topic ?? story.topic,
    region: mirror.region ?? story.region,
    audioUrl: mirror.audioUrl ?? story.audioUrl,
    coverUrl: mirror.coverUrl ?? story.coverUrl,
  };
}

async function getCreateStoryMirrorMap(): Promise<Map<string, CreateStoryMirror>> {
  const mirrors = await getPublishedCreateStoryMirrorsCached();
  return new Map(
    mirrors
      .filter((story) => typeof story.createStoryId === "string" && story.createStoryId.trim() !== "")
      .map((story) => [story.createStoryId, story])
  );
}

export async function getCreateStoryMirrorByStoryId(
  createStoryId: string
): Promise<CreateStoryMirror | null> {
  const getMirrorByStoryIdCached = unstable_cache(
    async (cachedCreateStoryId: string): Promise<CreateStoryMirror | null> => {
      const query = groq`*[_type == "standaloneStory" && sourceType == "create" && published == true && createStoryId == $createStoryId][0]{
        ${createStoryMirrorFields}
      }`;
      const mirror = await sanityClient.fetch<CreateStoryMirror | null>(query, {
        createStoryId: cachedCreateStoryId,
      });
      if (mirror) {
        return mirror;
      }

      const story = await getUserStoryById(cachedCreateStoryId);
      if (story) {
        return mapPublicUserStoryToMirror(story);
      }

      return null;
    },
    ["create-story-mirror-by-story-id-v1", createStoryId],
    { revalidate: 60, tags: ["published-create-story-mirrors", `create-story:${createStoryId}`] }
  );

  return getMirrorByStoryIdCached(createStoryId);
}

export async function getCreateStoryMirrorBySlug(
  slug: string
): Promise<CreateStoryMirror | null> {
  const getMirrorBySlugCached = unstable_cache(
    async (cachedSlug: string): Promise<CreateStoryMirror | null> => {
      try {
        const story = await prisma.userStory.findUnique({
          where: { slug: cachedSlug },
          select: {
            id: true,
            slug: true,
            title: true,
            language: true,
            variant: true,
            level: true,
            cefrLevel: true,
            focus: true,
            topic: true,
            region: true,
            text: true,
            audioUrl: true,
            coverUrl: true,
            coverFilename: true,
            createdAt: true,
          },
        });

        if (story) {
          return mapPublicUserStoryToMirror(story);
        }
      } catch (err) {
        if (!isTransientDbError(err)) {
          throw err;
        }
        console.warn("[getCreateStoryMirrorBySlug] transient DB error, falling back to Sanity.");
      }

      const query = groq`*[_type == "standaloneStory" && sourceType == "create" && published == true && slug.current == $slug][0]{
        ${createStoryMirrorFields}
      }`;

      return sanityClient.fetch<CreateStoryMirror | null>(query, { slug: cachedSlug });
    },
    ["create-story-mirror-by-slug-v1", slug],
    { revalidate: 60, tags: ["published-create-story-mirrors", `story-slug:${slug}`] }
  );

  return getMirrorBySlugCached(slug);
}

async function getPublicUserStoriesRaw(limit: number | null): Promise<PublicUserStory[]> {
  try {
    return await prisma.userStory.findMany({
      where: { public: true },
      orderBy: { createdAt: "desc" },
      ...(typeof limit === "number" ? { take: limit } : {}),
      select: {
        id: true,
        slug: true,
        title: true,
        language: true,
        variant: true,
        level: true,
        cefrLevel: true,
        focus: true,
        topic: true,
        region: true,
        text: true,
        audioUrl: true,
        coverUrl: true,
        coverFilename: true,
        createdAt: true,
      },
    });
  } catch (err) {
    if (isTransientDbError(err)) {
      console.warn("[getPublicUserStories] transient DB error, returning empty list.");
      return [];
    }
    throw err;
  }
}

const getPublicUserStoriesRawCached = unstable_cache(
  async (limitKey: string): Promise<PublicUserStory[]> => {
    const parsedLimit = limitKey === "all" ? null : Number.parseInt(limitKey, 10);
    const limit = Number.isFinite(parsedLimit) ? parsedLimit : null;
    return getPublicUserStoriesRaw(limit);
  },
  ["public-user-stories-raw-v1"],
  { revalidate: 60, tags: ["public-user-stories"] }
);

export async function getPublicUserStories(opts?: {
  limit?: number;
}): Promise<PublicUserStory[]> {
  const limit = typeof opts?.limit === "number" ? opts.limit : null;
  const stories = await getPublicUserStoriesRawCached(limit === null ? "all" : String(limit));

  try {
    const mirrorMap = await getCreateStoryMirrorMap();
    return stories.map((story) => mergeUserStoryWithMirror(story, mirrorMap.get(story.id)));
  } catch (err) {
    console.warn("[getPublicUserStories] Failed to merge create-story mirrors, returning DB stories.", err);
    return stories;
  }
}

export async function getUserStoryById(
  id: string
): Promise<PublicUserStory | null> {
  try {
    const story = await prisma.userStory.findUnique({
      where: { id },
      select: {
        id: true,
        slug: true,
        title: true,
        language: true,
        variant: true,
        level: true,
        cefrLevel: true,
        focus: true,
        topic: true,
        region: true,
        text: true,
        audioUrl: true,
        coverUrl: true,
        coverFilename: true,
        createdAt: true,
      },
    });

    if (!story) return null;
    return story;
  } catch (err) {
    if (isTransientDbError(err)) {
      console.warn("[getUserStoryById] transient DB error, returning null.");
      return null;
    }
    throw err;
  }
}
