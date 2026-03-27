export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@/generated/prisma";
import { normalizeVocabType } from "@/lib/vocabTypes";
import { getMobileSessionFromRequest } from "@/lib/mobileSession";

declare global {
  var __prisma__: PrismaClient | undefined;
}

const prisma = globalThis.__prisma__ ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalThis.__prisma__ = prisma;

type FavoriteBody = {
  word: string;
  translation: string;
  wordType?: string | null;
  exampleSentence?: string | null;
  storySlug?: string | null;
  storyTitle?: string | null;
  sourcePath?: string | null;
  language?: string | null;
};

type FavoriteReviewBody = {
  word: string;
  nextReviewAt: string;
  lastReviewedAt: string;
  streak: number;
};

function isFavoriteBody(value: unknown): value is FavoriteBody {
  if (!value || typeof value !== "object") return false;
  const body = value as Record<string, unknown>;
  const optionalString = (input: unknown) =>
    input === undefined || input === null || typeof input === "string";

  return (
    typeof body.word === "string" &&
    typeof body.translation === "string" &&
    optionalString(body.wordType) &&
    optionalString(body.exampleSentence) &&
    optionalString(body.storySlug) &&
    optionalString(body.storyTitle) &&
    optionalString(body.sourcePath) &&
    optionalString(body.language)
  );
}

function isFavoriteReviewBody(value: unknown): value is FavoriteReviewBody {
  if (!value || typeof value !== "object") return false;
  const body = value as Record<string, unknown>;

  return (
    typeof body.word === "string" &&
    typeof body.nextReviewAt === "string" &&
    typeof body.lastReviewedAt === "string" &&
    typeof body.streak === "number"
  );
}

export async function GET(req: NextRequest): Promise<Response> {
  const session = getMobileSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const favorites = await prisma.favorite.findMany({
    where: { userId: session.sub },
    orderBy: [{ createdAt: "desc" }],
    select: {
      word: true,
      translation: true,
      wordType: true,
      exampleSentence: true,
      storySlug: true,
      storyTitle: true,
      sourcePath: true,
      language: true,
      nextReviewAt: true,
      lastReviewedAt: true,
      streak: true,
    },
  });

  return NextResponse.json(favorites);
}

export async function POST(req: NextRequest): Promise<Response> {
  const session = getMobileSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = (await req.json().catch(() => null)) as unknown;
  if (!isFavoriteBody(json)) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const normalizedWordType = normalizeVocabType(json.wordType, {
    word: json.word,
    definition: json.translation,
  });

  const existing = await prisma.favorite.findFirst({
    where: { userId: session.sub, word: json.word },
    select: { id: true },
  });

  const favorite = existing
    ? await prisma.favorite.update({
        where: { id: existing.id },
        data: {
          translation: json.translation,
          wordType: normalizedWordType,
          exampleSentence: json.exampleSentence ?? null,
          storySlug: json.storySlug ?? null,
          storyTitle: json.storyTitle ?? null,
          sourcePath: json.sourcePath ?? null,
          language: json.language ?? null,
        },
      })
    : await prisma.favorite.create({
        data: {
          userId: session.sub,
          word: json.word,
          translation: json.translation,
          wordType: normalizedWordType,
          exampleSentence: json.exampleSentence ?? null,
          storySlug: json.storySlug ?? null,
          storyTitle: json.storyTitle ?? null,
          sourcePath: json.sourcePath ?? null,
          language: json.language ?? null,
        },
      });

  return NextResponse.json(favorite, { status: 201 });
}

export async function DELETE(req: NextRequest): Promise<Response> {
  const session = getMobileSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = (await req.json().catch(() => null)) as { word?: unknown } | null;
  const word = typeof json?.word === "string" ? json.word.trim() : "";
  if (!word) {
    return NextResponse.json({ error: "Missing word" }, { status: 400 });
  }

  await prisma.favorite.deleteMany({
    where: { userId: session.sub, word },
  });

  return NextResponse.json({ success: true });
}

export async function PATCH(req: NextRequest): Promise<Response> {
  const session = getMobileSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = (await req.json().catch(() => null)) as unknown;
  if (!isFavoriteReviewBody(json)) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const parsedNext = new Date(json.nextReviewAt);
  const parsedLast = new Date(json.lastReviewedAt);
  if (Number.isNaN(parsedNext.getTime()) || Number.isNaN(parsedLast.getTime())) {
    return NextResponse.json({ error: "Invalid datetime" }, { status: 400 });
  }

  const existing = await prisma.favorite.findFirst({
    where: { userId: session.sub, word: json.word },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Favorite not found" }, { status: 404 });
  }

  const favorite = await prisma.favorite.update({
    where: { id: existing.id },
    data: {
      nextReviewAt: parsedNext,
      lastReviewedAt: parsedLast,
      streak: Math.max(0, Math.floor(json.streak)),
    },
  });

  return NextResponse.json(favorite);
}
