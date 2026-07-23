export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma";
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

  // --- Resolver historia de cada favorito, EXCLUIR huérfanos y adjuntar clip
  // curado (2026-07-22). Un favorito guarda `storySlug` como pseudo-slug
  // `journey-{id}` (journey stories) o como slug real (journey o standalone).
  // Un favorito es HUÉRFANO si su historia ya no está VIVA: borrada, no
  // publicada, o su journey archived/draft. Esos NO deben seguir generando
  // ejercicios "fantasma" en la sección de práctica → se filtran aquí.
  // Para los vivos (journey), adjuntamos el clip PRE-HORNEADO de su ejercicio
  // curado (match por id + palabra); ese es el audio correcto sin runtime.
  const JOURNEY_PREFIX = "journey-";
  const pseudoIds: string[] = [];
  const plainSlugs: string[] = [];
  for (const f of favorites) {
    if (!f.storySlug) continue;
    if (f.storySlug.startsWith(JOURNEY_PREFIX)) {
      pseudoIds.push(f.storySlug.slice(JOURNEY_PREFIX.length));
    } else {
      plainSlugs.push(f.storySlug);
    }
  }

  const norm = (w: string) => w.trim().toLowerCase();
  type ClipMap = Map<
    string,
    {
      clipUrl: string | null;
      voiceId: string | null;
      wordClipUrl: string | null;
      wordVoiceId: string | null;
    }
  >;
  const collectClips = (
    exercises: { word: string | null; payload: unknown }[]
  ): ClipMap => {
    const m: ClipMap = new Map();
    for (const ex of exercises) {
      const ac = ((ex.payload as Record<string, unknown> | null)?.audioClip ??
        null) as Record<string, unknown> | null;
      const clipUrl = typeof ac?.clipUrl === "string" ? ac.clipUrl : null;
      const wordClipUrl = typeof ac?.wordClipUrl === "string" ? ac.wordClipUrl : null;
      // Guardar la entrada si hay clip de oración O de palabra: el meaning/match
      // pre-horneado (wordClipUrl) debe llegar aunque no exista clip de oración.
      if ((!clipUrl && !wordClipUrl) || !ex.word) continue;
      const k = norm(ex.word);
      if (!m.has(k)) {
        m.set(k, {
          clipUrl,
          voiceId: typeof ac?.voiceId === "string" ? ac.voiceId : null,
          wordClipUrl,
          wordVoiceId: typeof ac?.wordVoiceId === "string" ? ac.wordVoiceId : null,
        });
      }
    }
    return m;
  };

  // Historia viva = JourneyStory publicada + journey no archived/draft.
  const LIVE_JOURNEY: Prisma.JourneyWhereInput = { status: { notIn: ["archived", "draft"] } };
  const liveByKey = new Map<string, ClipMap>(); // key: el storySlug original

  if (pseudoIds.length > 0) {
    const rows = await prisma.journeyStory.findMany({
      where: { id: { in: pseudoIds }, status: "published", journey: LIVE_JOURNEY },
      select: {
        id: true,
        practiceSet: { select: { exercises: { select: { word: true, payload: true } } } },
      },
    });
    for (const r of rows) {
      liveByKey.set(`${JOURNEY_PREFIX}${r.id}`, collectClips(r.practiceSet?.exercises ?? []));
    }
  }
  if (plainSlugs.length > 0) {
    const jrows = await prisma.journeyStory.findMany({
      where: { slug: { in: plainSlugs }, status: "published", journey: LIVE_JOURNEY },
      select: {
        slug: true,
        practiceSet: { select: { exercises: { select: { word: true, payload: true } } } },
      },
    });
    for (const r of jrows) {
      if (r.slug) liveByKey.set(r.slug, collectClips(r.practiceSet?.exercises ?? []));
    }
    // Standalone: existencia = viva (no tienen practice set → sin clip curado).
    const srows = await prisma.standaloneStory.findMany({
      where: { slug: { in: plainSlugs } },
      select: { slug: true },
    });
    for (const r of srows) {
      if (r.slug && !liveByKey.has(r.slug)) liveByKey.set(r.slug, new Map());
    }
  }

  const enriched = favorites.flatMap((f) => {
    if (!f.storySlug) return [f]; // sin historia: no se puede validar → conservador, se mantiene
    const clips = liveByKey.get(f.storySlug);
    if (!clips) return []; // HUÉRFANO (historia borrada / muerta / archived) → EXCLUIR
    const clip = clips.get(norm(f.word));
    // Adjuntar el clip curado de la palabra cuando exista (mismo idioma/voz que
    // el narrador; audio correcto sin Modal). No tocamos `exampleSentence`.
    // `wordClipUrl` (palabra pre-horneada) alimenta meaning y match sin runtime.
    return [
      clip
        ? {
            ...f,
            ...(clip.clipUrl ? { clipUrl: clip.clipUrl, voiceId: clip.voiceId } : {}),
            wordClipUrl: clip.wordClipUrl,
            wordVoiceId: clip.wordVoiceId,
          }
        : f,
    ];
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
