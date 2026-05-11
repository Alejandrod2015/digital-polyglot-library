// /src/lib/userStories.ts
//
// Reads user-generated stories from Prisma (UserStory). Previously this
// module went through a Sanity `standaloneStory` mirror with sourceType="create";
// after the Sanity -> Studio migration the mirror is gone and Prisma is the
// only source of truth. The CreateStoryMirror shape is preserved for
// backwards compatibility with the existing consumers (the story reader
// page and the practice endpoint).

import { prisma } from "@/lib/prisma";
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

export type CreateStoryMirror = {
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

const PUBLIC_USER_STORY_SELECT = {
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
} as const;

async function getMirrorByStoryIdFromPrisma(
  storyId: string
): Promise<CreateStoryMirror | null> {
  try {
    const story = await prisma.userStory.findUnique({
      where: { id: storyId },
      select: PUBLIC_USER_STORY_SELECT,
    });
    return story ? mapPublicUserStoryToMirror(story) : null;
  } catch (err) {
    if (isTransientDbError(err)) {
      console.warn("[getMirrorByStoryIdFromPrisma] transient DB error.");
      return null;
    }
    throw err;
  }
}

async function getMirrorBySlugFromPrisma(
  slug: string
): Promise<CreateStoryMirror | null> {
  try {
    const story = await prisma.userStory.findUnique({
      where: { slug },
      select: PUBLIC_USER_STORY_SELECT,
    });
    return story ? mapPublicUserStoryToMirror(story) : null;
  } catch (err) {
    if (isTransientDbError(err)) {
      console.warn("[getMirrorBySlugFromPrisma] transient DB error.");
      return null;
    }
    throw err;
  }
}

export async function getCreateStoryMirrorByStoryId(
  createStoryId: string
): Promise<CreateStoryMirror | null> {
  const cached = unstable_cache(
    async (id: string) => getMirrorByStoryIdFromPrisma(id),
    ["create-story-mirror-by-story-id-v2", createStoryId],
    { revalidate: 60, tags: ["published-create-story-mirrors", `create-story:${createStoryId}`] }
  );
  return cached(createStoryId);
}

export async function getCreateStoryMirrorByStoryIdFresh(
  createStoryId: string
): Promise<CreateStoryMirror | null> {
  return getMirrorByStoryIdFromPrisma(createStoryId);
}

export async function getCreateStoryMirrorBySlug(
  slug: string
): Promise<CreateStoryMirror | null> {
  const cached = unstable_cache(
    async (s: string) => getMirrorBySlugFromPrisma(s),
    ["create-story-mirror-by-slug-v2", slug],
    { revalidate: 60, tags: ["published-create-story-mirrors", `story-slug:${slug}`] }
  );
  return cached(slug);
}

export async function getCreateStoryMirrorBySlugFresh(
  slug: string
): Promise<CreateStoryMirror | null> {
  return getMirrorBySlugFromPrisma(slug);
}

// Drafts no longer exist after the Sanity -> Studio migration. UserStory
// is published-or-deleted; there's no draft mirror. These stubs return
// null so existing consumers keep compiling without surprises.
export async function getDraftCreateStoryMirrorBySlug(
  _slug: string
): Promise<CreateStoryMirror | null> {
  return null;
}

export async function getDraftCreateStoryMirrorByStoryId(
  _createStoryId: string
): Promise<CreateStoryMirror | null> {
  return null;
}

async function getPublicUserStoriesRaw(limit: number | null): Promise<PublicUserStory[]> {
  try {
    return await prisma.userStory.findMany({
      where: { public: true },
      orderBy: { createdAt: "desc" },
      ...(typeof limit === "number" ? { take: limit } : {}),
      select: PUBLIC_USER_STORY_SELECT,
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
  ["public-user-stories-raw-v2"],
  { revalidate: 60, tags: ["public-user-stories"] }
);

export async function getPublicUserStories(opts?: {
  limit?: number;
}): Promise<PublicUserStory[]> {
  const limit = typeof opts?.limit === "number" ? opts.limit : null;
  return getPublicUserStoriesRawCached(limit === null ? "all" : String(limit));
}

export async function getUserStoryById(
  id: string
): Promise<PublicUserStory | null> {
  try {
    const story = await prisma.userStory.findUnique({
      where: { id },
      select: PUBLIC_USER_STORY_SELECT,
    });
    return story ?? null;
  } catch (err) {
    if (isTransientDbError(err)) {
      console.warn("[getUserStoryById] transient DB error, returning null.");
      return null;
    }
    throw err;
  }
}
