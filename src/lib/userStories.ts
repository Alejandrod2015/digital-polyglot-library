// /src/lib/userStories.ts
import { prisma } from "@/lib/prisma";
import { unstable_cache } from "next/cache";

export type PublicUserStory = {
  id: string;
  slug: string;
  title: string;
  language: string | null;
  variant: string | null;
  level: string | null;
  topic: string | null;
  region: string | null;
  text: string | null;
  audioUrl: string | null;
  coverUrl: string | null;
  coverFilename: string | null;
  createdAt: Date;
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

const getPublicUserStoriesCached = unstable_cache(
  async (limit: number | null): Promise<PublicUserStory[]> => {
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
  },
  ["public-user-stories-v2"],
  { revalidate: 60, tags: ["public-user-stories"] }
);

export async function getPublicUserStories(opts?: {
  limit?: number;
}): Promise<PublicUserStory[]> {
  const limit = typeof opts?.limit === "number" ? opts.limit : null;
  return getPublicUserStoriesCached(limit);
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
        topic: true,
        region: true,
        text: true,
        audioUrl: true,
        coverUrl: true,
        coverFilename: true,
        createdAt: true,
      },
    });

    return story;
  } catch (err) {
    if (isTransientDbError(err)) {
      console.warn("[getUserStoryById] transient DB error, returning null.");
      return null;
    }
    throw err;
  }
}
