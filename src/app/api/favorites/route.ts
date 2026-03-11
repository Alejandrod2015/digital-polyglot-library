export const runtime = "nodejs";

import { getAuth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { unstable_cache, revalidateTag } from "next/cache";
import { PrismaClient } from "@/generated/prisma";
import { normalizeVocabType } from "@/lib/vocabTypes";
import { books } from "@/data/books";
import { findBestAudioSegment } from "@/lib/audioSegments";
import { getStandaloneStoryAudioSegments } from "@/lib/standaloneStoryAudioSegments";
import { getSegmentIdFromSourcePath, isStandaloneSourcePath } from "@/lib/storySource";

declare global {
  // eslint-disable-next-line no-var
  var __prisma__: PrismaClient | undefined;
}
const prisma = globalThis.__prisma__ ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalThis.__prisma__ = prisma;

const bookLanguageBySlug = new Map<string, string>();
const storyLanguageBySlug = new Map<string, string>();
for (const book of Object.values(books)) {
  const lang = typeof book.language === "string" ? book.language.trim() : "";
  if (!lang) continue;
  if (typeof book.slug === "string" && book.slug.trim()) {
    bookLanguageBySlug.set(book.slug.trim().toLowerCase(), lang);
  }
  for (const story of book.stories ?? []) {
    if (typeof story.slug === "string" && story.slug.trim()) {
      storyLanguageBySlug.set(story.slug.trim().toLowerCase(), lang);
    }
  }
}

function inferLanguageFromSourcePath(sourcePath?: string | null): string | null {
  if (!sourcePath || typeof sourcePath !== "string") return null;
  const raw = sourcePath.trim();
  if (!raw) return null;
  try {
    const path = raw.startsWith("http") ? new URL(raw).pathname : raw;
    const parts = path.split("/").filter(Boolean);
    if (parts[0] === "books" && parts[1]) {
      return bookLanguageBySlug.get(parts[1].toLowerCase()) ?? null;
    }
  } catch {
    // ignore malformed path
  }
  return null;
}

function withSegmentId(sourcePath: string, segmentId: string): string {
  try {
    const url = sourcePath.startsWith("http")
      ? new URL(sourcePath)
      : new URL(sourcePath, "https://example.local");
    url.searchParams.set("segmentId", segmentId);
    return sourcePath.startsWith("http") ? url.toString() : `${url.pathname}${url.search}`;
  } catch {
    return sourcePath;
  }
}

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
  const optionalString = (v: unknown) =>
    v === undefined || v === null || typeof v === "string";
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
    const missingLanguageStorySlugs = Array.from(
      new Set(
        favorites
          .filter((fav) => !(typeof fav.language === "string" && fav.language.trim()))
          .map((fav) => (typeof fav.storySlug === "string" ? fav.storySlug.trim().toLowerCase() : ""))
          .filter(Boolean)
      )
    );

    const userStoriesBySlug = new Map<string, string>();
    if (missingLanguageStorySlugs.length > 0) {
      const userStories = await prisma.userStory.findMany({
        where: { slug: { in: missingLanguageStorySlugs } },
        select: { slug: true, language: true },
      });
      for (const story of userStories) {
        if (typeof story.slug === "string" && typeof story.language === "string" && story.language.trim()) {
          userStoriesBySlug.set(story.slug.trim().toLowerCase(), story.language);
        }
      }
    }

    const backfillOps: Array<Promise<unknown>> = [];
    const normalized = favorites.map((fav) => {
      const currentLanguage = typeof fav.language === "string" ? fav.language.trim() : "";
      const inferredLanguage =
        currentLanguage ||
        (typeof fav.storySlug === "string" ? storyLanguageBySlug.get(fav.storySlug.trim().toLowerCase()) ?? "" : "") ||
        (typeof fav.storySlug === "string" ? userStoriesBySlug.get(fav.storySlug.trim().toLowerCase()) ?? "" : "") ||
        inferLanguageFromSourcePath(fav.sourcePath) ||
        "";

      if (!currentLanguage && inferredLanguage) {
        backfillOps.push(
          prisma.favorite.update({
            where: { id: fav.id },
            data: { language: inferredLanguage },
          })
        );
      }

      let resolvedSourcePath = fav.sourcePath;
      const existingSegmentId = getSegmentIdFromSourcePath(fav.sourcePath);
      const canBackfillStandaloneSegment =
        !existingSegmentId &&
        isStandaloneSourcePath(fav.sourcePath, fav.storySlug) &&
        typeof fav.storySlug === "string" &&
        fav.storySlug.trim() &&
        typeof fav.exampleSentence === "string" &&
        fav.exampleSentence.trim() &&
        typeof fav.word === "string" &&
        fav.word.trim();

      if (canBackfillStandaloneSegment) {
        const segments = getStandaloneStoryAudioSegments(fav.storySlug!);
        const segment = findBestAudioSegment(segments, fav.exampleSentence!, {
          targetWord: fav.word,
        });

        if (segment && typeof fav.sourcePath === "string") {
          resolvedSourcePath = withSegmentId(fav.sourcePath, segment.id);
          backfillOps.push(
            prisma.favorite.update({
              where: { id: fav.id },
              data: { sourcePath: resolvedSourcePath },
            })
          );
        }
      }

      return {
        ...fav,
        language: inferredLanguage || null,
        sourcePath: resolvedSourcePath,
        wordType:
          normalizeVocabType(fav.wordType, {
            word: fav.word,
            definition: fav.translation,
          }) ?? null,
      };
    });

    if (backfillOps.length > 0) {
      await Promise.allSettled(backfillOps);
      revalidateTag("favorites-by-user");
    }

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
