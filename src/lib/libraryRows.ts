// Loads My Library rows for a user and attaches the display metadata the
// cards need. Lives outside the route handler so the same code can be
// exercised without going through the HTTP + Clerk layer.

import { prisma } from "@/lib/prisma";
import { getStandaloneStoriesByIds } from "@/lib/standaloneStories";
import {
  libraryStoryKey,
  resolveLibraryBookMeta,
  resolveLibraryStoryMeta,
} from "@/lib/libraryMeta";

export type LibraryType = "book" | "story";

export async function loadLibraryBookRows(userId: string) {
  const rows = await prisma.libraryBook.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  const meta = await resolveLibraryBookMeta(rows.map((row) => row.bookId));
  return rows.map((row) => ({ ...row, meta: meta.get(row.bookId) ?? null }));
}

export async function loadLibraryStoryRows(userId: string) {
  const rows = await prisma.libraryStory.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  const polyglotIds = rows.filter((row) => row.bookId === "polyglot").map((row) => row.storyId);
  const standaloneIds = rows.filter((row) => row.bookId === "standalone").map((row) => row.storyId);

  const [polyglotStories, standaloneStories] = await Promise.all([
    polyglotIds.length === 0
      ? Promise.resolve([])
      : prisma.userStory.findMany({
          where: { id: { in: polyglotIds } },
          select: {
            id: true,
            slug: true,
            language: true,
            region: true,
            level: true,
            topic: true,
            coverUrl: true,
            audioUrl: true,
          },
        }),
    getStandaloneStoriesByIds(standaloneIds),
  ]);

  const byId = new Map(polyglotStories.map((s) => [s.id, s]));
  const standaloneById = new Map(standaloneStories.map((s) => [s.id, s]));
  // Book-backed rows resolve their book/story metadata against the real
  // catalog, not the build-time static dump, so a purchased title missing
  // from the dump still renders with cover, level and working links.
  const bookMeta = await resolveLibraryStoryMeta(
    rows.filter((row) => row.bookId !== "polyglot" && row.bookId !== "standalone")
  );

  return rows.map((row) => {
    if (row.bookId === "polyglot" || row.bookId === "standalone") {
      const story =
        row.bookId === "polyglot" ? byId.get(row.storyId) : standaloneById.get(row.storyId);
      if (!story) return row;
      return {
        ...row,
        storySlug: story.slug,
        language: story.language,
        region: story.region,
        level: story.level,
        topic: story.topic,
        audioUrl: story.audioUrl,
        coverUrl: story.coverUrl ?? row.coverUrl,
      };
    }

    const meta = bookMeta.get(libraryStoryKey(row.bookId, row.storyId));
    if (!meta) return row;
    return {
      ...row,
      meta,
      storySlug: meta.storySlug,
      bookSlug: meta.bookSlug,
      language: meta.language,
      region: meta.region,
      level: meta.level,
      topic: meta.topic,
      coverUrl: meta.coverUrl ?? row.coverUrl,
      audioUrl: meta.audioUrl ?? null,
    };
  });
}

export async function loadLibraryRows(userId: string, type: LibraryType) {
  return type === "story" ? loadLibraryStoryRows(userId) : loadLibraryBookRows(userId);
}
