export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { normalizeVocabType } from "@/lib/vocabTypes";
import { getActiveMobileSession } from "@/lib/mobileSession";
import { prisma } from "@/lib/prisma";

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
  const session = await getActiveMobileSession(req);
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

  // Enriquecer cada palabra guardada con el clip PRE-HORNEADO de su set de
  // práctica, cuando exista (match por historia + palabra normalizada). GARANTÍA
  // (2026-07-22): la oración que se muestra y el audio que suena salen del MISMO
  // registro (audioClip del ejercicio), así no pueden desincronizarse. Antes la
  // sección reconstruía la oración desde el favorito y el audio venía aparte de
  // Modal → mudo o cruzado. Palabras sin ejercicio pre-horneado quedan igual
  // (fallback on-demand).
  const slugs = [
    ...new Set(favorites.map((f) => f.storySlug).filter((s): s is string => !!s)),
  ];
  const clipByKey = new Map<
    string,
    { clipUrl: string; sentence: string; voiceId: string | null }
  >();
  if (slugs.length > 0) {
    const sets = await prisma.storyPracticeSet.findMany({
      where: { story: { slug: { in: slugs }, status: "published" } },
      select: {
        story: { select: { slug: true } },
        exercises: { select: { word: true, payload: true } },
      },
    });
    const norm = (w: string) => w.trim().toLowerCase();
    for (const set of sets) {
      const slug = set.story?.slug;
      if (!slug) continue;
      for (const ex of set.exercises) {
        const ac = ((ex.payload as Record<string, unknown> | null)?.audioClip ??
          null) as Record<string, unknown> | null;
        const clipUrl = typeof ac?.clipUrl === "string" ? ac.clipUrl : null;
        const sentence = typeof ac?.sentence === "string" ? ac.sentence : null;
        if (!clipUrl || !sentence || !ex.word) continue;
        const key = `${slug}::${norm(ex.word)}`;
        // El primero gana (orderIndex asc no está garantizado aquí, pero un
        // mismo (historia,palabra) mapea al mismo clip de todos modos).
        if (!clipByKey.has(key)) {
          clipByKey.set(key, {
            clipUrl,
            sentence,
            voiceId: typeof ac?.voiceId === "string" ? ac.voiceId : null,
          });
        }
      }
    }
  }

  const enriched = favorites.map((f) => {
    if (!f.storySlug) return f;
    const match = clipByKey.get(`${f.storySlug}::${f.word.trim().toLowerCase()}`);
    if (!match) return f;
    // Adjuntar el clip PRE-HORNEADO de la palabra (arregla el mudo de la sección:
    // reproduce el clip correcto sin Modal) + voiceId para que el audio de
    // palabra use la voz correcta. NO sobrescribimos `exampleSentence`: algunas
    // audioClip.sentence de meaning_in_context son fragmentos y romperían el
    // display de la oración en modo contexto. El clip es el audio del mismo
    // (historia, palabra), así que es el audio que corresponde.
    return {
      ...f,
      clipUrl: match.clipUrl,
      voiceId: match.voiceId,
    };
  });

  return NextResponse.json(enriched);
}

export async function POST(req: NextRequest): Promise<Response> {
  const session = await getActiveMobileSession(req);
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
  const session = await getActiveMobileSession(req);
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
  const session = await getActiveMobileSession(req);
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
