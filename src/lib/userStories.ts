// /src/lib/userStories.ts
import { prisma } from "@/lib/prisma";
import { writeClient as sanityClient } from "@/sanity/lib/client";
import { groq } from "next-sanity";

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
  "coverUrl": cover.asset->url,
  "audioUrl": audio.asset->url
`;

async function getPublishedCreateStoryMirrors(): Promise<CreateStoryMirror[]> {
  const query = groq`*[_type == "standaloneStory" && sourceType == "create" && published == true]{
    ${createStoryMirrorFields}
  }`;

  return sanityClient.fetch<CreateStoryMirror[]>(query);
}

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
  const mirrors = await getPublishedCreateStoryMirrors();
  return new Map(mirrors.map((mirror) => [mirror.createStoryId, mirror]));
}

export async function getCreateStoryMirrorByStoryId(
  createStoryId: string
): Promise<CreateStoryMirror | null> {
  const query = groq`*[_type == "standaloneStory" && sourceType == "create" && published == true && createStoryId == $createStoryId][0]{
    ${createStoryMirrorFields}
  }`;

  return sanityClient.fetch<CreateStoryMirror | null>(query, { createStoryId });
}

export async function getCreateStoryMirrorBySlug(
  slug: string
): Promise<CreateStoryMirror | null> {
  const query = groq`*[_type == "standaloneStory" && sourceType == "create" && published == true && slug.current == $slug][0]{
    ${createStoryMirrorFields}
  }`;

  return sanityClient.fetch<CreateStoryMirror | null>(query, { slug });
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

export async function getPublicUserStories(opts?: {
  limit?: number;
}): Promise<PublicUserStory[]> {
  const limit = typeof opts?.limit === "number" ? opts.limit : null;
  const [stories, mirrorMap] = await Promise.all([
    getPublicUserStoriesRaw(limit),
    getCreateStoryMirrorMap(),
  ]);

  return stories.map((story) => mergeUserStoryWithMirror(story, mirrorMap.get(story.id)));
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
    const mirrorMap = await getCreateStoryMirrorMap();
    return mergeUserStoryWithMirror(story, mirrorMap.get(story.id));
  } catch (err) {
    if (isTransientDbError(err)) {
      console.warn("[getUserStoryById] transient DB error, returning null.");
      return null;
    }
    throw err;
  }
}
