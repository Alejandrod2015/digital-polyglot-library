// /src/app/api/library/route.ts (optimizado con cache)

export const runtime = "nodejs";

import { getAuth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { unstable_cache, revalidateTag } from "next/cache";
import { PrismaClient } from "@/generated/prisma";

declare global {
  var __prisma__: PrismaClient | undefined;
}
const prisma = globalThis.__prisma__ ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalThis.__prisma__ = prisma;

type LibraryType = "book" | "story";

type LibraryBody =
  | { type: "book"; bookId: string; title: string; coverUrl: string }
  | {
      type: "story";
      storyId: string;
      title: string;
      coverUrl: string;
      bookId: string;
    };

function isLibraryBody(x: unknown): x is LibraryBody {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  const type = o.type;
  if (type === "book")
    return (
      typeof o.bookId === "string" &&
      typeof o.title === "string" &&
      typeof o.coverUrl === "string"
    );
  if (type === "story")
    return (
      typeof o.storyId === "string" &&
      typeof o.bookId === "string" &&
      typeof o.title === "string" &&
      typeof o.coverUrl === "string"
    );
  return false;
}

// ✅ cache por usuario + tipo
const getLibraryCached = unstable_cache(
  async (userId: string, type: LibraryType) => {
    if (type === "story") {
      const rows = await prisma.libraryStory.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });

      const polyglotIds = rows
        .filter((row) => row.bookId === "polyglot")
        .map((row) => row.storyId);

      if (polyglotIds.length === 0) return rows;

      const polyglotStories = await prisma.userStory.findMany({
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
      });

      const byId = new Map(polyglotStories.map((s) => [s.id, s]));
      return rows.map((row) => {
        if (row.bookId !== "polyglot") return row;
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
      });
    }
    return prisma.libraryBook.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  },
  ["library-by-user"],
  { revalidate: 60, tags: ["library-by-user"] }
);

// 🧠 GET → obtener biblioteca (optimizado)
export async function GET(req: NextRequest): Promise<Response> {
  const { userId } = getAuth(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type = (searchParams.get("type") as LibraryType) ?? "book";

  try {
    const data = await getLibraryCached(userId, type);
    return NextResponse.json(data);
  } catch (err: unknown) {
    console.error("❌ Error en GET /api/library:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

// 💾 POST → agregar libro o historia
export async function POST(req: NextRequest): Promise<Response> {
  const { userId } = getAuth(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json: unknown = await req.json();
  if (!isLibraryBody(json))
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  try {
    if (json.type === "story") {
      const existing = await prisma.libraryStory.findFirst({
        where: { userId, storyId: json.storyId },
      });
      const story = existing
        ? await prisma.libraryStory.update({
            where: { id: existing.id },
            data: {
              title: json.title,
              coverUrl: json.coverUrl,
              bookId: json.bookId,
            },
          })
        : await prisma.libraryStory.create({
            data: {
              userId,
              storyId: json.storyId,
              title: json.title,
              coverUrl: json.coverUrl,
              bookId: json.bookId,
            },
          });
      revalidateTag("library-by-user");
      return NextResponse.json(story, { status: 201 });
    }

    const existing = await prisma.libraryBook.findFirst({
      where: { userId, bookId: json.bookId },
    });
    const book = existing
      ? await prisma.libraryBook.update({
          where: { id: existing.id },
          data: { title: json.title, coverUrl: json.coverUrl },
        })
      : await prisma.libraryBook.create({
          data: {
            userId,
            bookId: json.bookId,
            title: json.title,
            coverUrl: json.coverUrl,
          },
        });
    revalidateTag("library-by-user");
    return NextResponse.json(book, { status: 201 });
  } catch (err: unknown) {
    console.error("❌ Error en POST /api/library:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

// ❌ DELETE → eliminar libro o historia
export async function DELETE(req: NextRequest): Promise<Response> {
  const { userId } = getAuth(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json: unknown = await req.json();
  const type = (json as { type?: unknown })?.type;
  try {
    if (type === "story") {
      const storyId = (json as { storyId?: unknown })?.storyId;
      if (typeof storyId !== "string")
        return NextResponse.json({ error: "Missing storyId" }, { status: 400 });
      await prisma.libraryStory.deleteMany({ where: { userId, storyId } });
      revalidateTag("library-by-user");
      return NextResponse.json({ success: true });
    }

    const bookId = (json as { bookId?: unknown })?.bookId;
    if (typeof bookId !== "string")
      return NextResponse.json({ error: "Missing bookId" }, { status: 400 });
    await prisma.libraryBook.deleteMany({ where: { userId, bookId } });
    revalidateTag("library-by-user");
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("❌ Error en DELETE /api/library:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
