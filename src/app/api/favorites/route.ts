export const runtime = "nodejs";

import { getAuth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { unstable_cache, revalidateTag } from "next/cache";
import { PrismaClient } from "@/generated/prisma";
import { normalizeVocabType } from "@/lib/vocabTypes";

declare global {
  // eslint-disable-next-line no-var
  var __prisma__: PrismaClient | undefined;
}
const prisma = globalThis.__prisma__ ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalThis.__prisma__ = prisma;

type FavoriteBody = {
  word: string;
  translation: string;
  wordType?: string;
  exampleSentence?: string;
  storySlug?: string;
  storyTitle?: string;
  sourcePath?: string;
  language?: string;
};
function isFavoriteBody(x: unknown): x is FavoriteBody {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  const optionalString = (v: unknown) => v === undefined || typeof v === "string";
  return (
    typeof o.word === "string" &&
    typeof o.translation === "string" &&
    optionalString(o.wordType) &&
    optionalString(o.exampleSentence) &&
    optionalString(o.storySlug) &&
    optionalString(o.storyTitle) &&
    optionalString(o.sourcePath) &&
    optionalString(o.language)
  );
}

type FavoriteReviewBody = {
  word: string;
  nextReviewAt: string;
  lastReviewedAt: string;
  streak: number;
};
function isFavoriteReviewBody(x: unknown): x is FavoriteReviewBody {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.word === "string" &&
    typeof o.nextReviewAt === "string" &&
    typeof o.lastReviewedAt === "string" &&
    typeof o.streak === "number" &&
    Number.isFinite(o.streak)
  );
}

// ✅ cache con tag por usuario
const getFavoritesCached = unstable_cache(
  async (userId: string) =>
    prisma.favorite.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }),
  ["favorites-by-user"],
  { revalidate: 60, tags: ["favorites-by-user"] }
);

// 🧠 GET
export async function GET(req: NextRequest): Promise<Response> {
  const { userId } = getAuth(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const favorites = await getFavoritesCached(userId);
    const normalized = favorites.map((fav) => ({
      ...fav,
      wordType:
        normalizeVocabType(fav.wordType, {
          word: fav.word,
          definition: fav.translation,
        }) ?? null,
    }));
    return NextResponse.json(normalized);
  } catch (err: unknown) {
    console.error("❌ Error en GET /api/favorites:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

// 💾 POST
export async function POST(req: NextRequest): Promise<Response> {
  const { userId } = getAuth(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json: unknown = await req.json();
  if (!isFavoriteBody(json))
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const {
    word,
    translation,
    wordType,
    exampleSentence,
    storySlug,
    storyTitle,
    sourcePath,
    language,
  } = json;

  const normalizedWordType = normalizeVocabType(wordType, {
    word,
    definition: translation,
  });

  try {
    const existing = await prisma.favorite.findFirst({
      where: { userId, word },
      select: { id: true },
    });

    const favorite = existing
      ? await prisma.favorite.update({
          where: { id: existing.id },
          data: {
            translation,
            wordType: normalizedWordType,
            exampleSentence: exampleSentence ?? null,
            storySlug: storySlug ?? null,
            storyTitle: storyTitle ?? null,
            sourcePath: sourcePath ?? null,
            language: language ?? null,
          },
        })
      : await prisma.favorite.create({
          data: {
            userId,
            word,
            translation,
            wordType: normalizedWordType,
            exampleSentence: exampleSentence ?? null,
            storySlug: storySlug ?? null,
            storyTitle: storyTitle ?? null,
            sourcePath: sourcePath ?? null,
            language: language ?? null,
          },
        });

    // ✅ invalidar cache del tag
    revalidateTag("favorites-by-user");

    return NextResponse.json(favorite, { status: 201 });
  } catch (err: unknown) {
    console.error("❌ Error en POST /api/favorites:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

// ❌ DELETE
export async function DELETE(req: NextRequest): Promise<Response> {
  const { userId } = getAuth(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json: unknown = await req.json();
  const word = (json as { word?: unknown })?.word;

  if (typeof word !== "string" || word.length === 0)
    return NextResponse.json({ error: "Missing word" }, { status: 400 });

  try {
    await prisma.favorite.deleteMany({
      where: { userId, word },
    });

    // ✅ invalidar cache del tag
    revalidateTag("favorites-by-user");

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("❌ Error en DELETE /api/favorites:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

// 📝 PATCH (SRS review progress)
export async function PATCH(req: NextRequest): Promise<Response> {
  const { userId } = getAuth(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json: unknown = await req.json();
  if (!isFavoriteReviewBody(json))
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const { word, nextReviewAt, lastReviewedAt, streak } = json;
  const parsedNext = new Date(nextReviewAt);
  const parsedLast = new Date(lastReviewedAt);
  if (Number.isNaN(parsedNext.getTime()) || Number.isNaN(parsedLast.getTime())) {
    return NextResponse.json({ error: "Invalid datetime" }, { status: 400 });
  }

  try {
    const existing = await prisma.favorite.findFirst({
      where: { userId, word },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Favorite not found" }, { status: 404 });
    }

    const updated = await prisma.favorite.update({
      where: { id: existing.id },
      data: {
        nextReviewAt: parsedNext,
        lastReviewedAt: parsedLast,
        streak: Math.max(0, Math.floor(streak)),
      },
    });

    revalidateTag("favorites-by-user");
    return NextResponse.json(updated);
  } catch (err: unknown) {
    console.error("❌ Error en PATCH /api/favorites:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
