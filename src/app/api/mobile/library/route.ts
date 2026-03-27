export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@/generated/prisma";
import { getStandaloneStoriesByIds } from "@/lib/standaloneStories";
import { getMobileSessionFromRequest } from "@/lib/mobileSession";

declare global {
  var __prisma__: PrismaClient | undefined;
}
const prisma = globalThis.__prisma__ ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalThis.__prisma__ = prisma;

type LibraryType = "book" | "story";

export async function GET(req: NextRequest): Promise<Response> {
  const session = getMobileSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = (searchParams.get("type") as LibraryType) ?? "book";

  if (type === "story") {
    const rows = await prisma.libraryStory.findMany({
      where: { userId: session.sub },
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

    const byId = new Map(polyglotStories.map((story) => [story.id, story]));
    const standaloneById = new Map(standaloneStories.map((story) => [story.id, story]));

    return NextResponse.json(
      rows.map((row) => {
        if (row.bookId === "polyglot") {
          const story = byId.get(row.storyId);
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

        if (row.bookId === "standalone") {
          const story = standaloneById.get(row.storyId);
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

        return row;
      })
    );
  }

  const books = await prisma.libraryBook.findMany({
    where: { userId: session.sub },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(books);
}
