export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileSessionFromRequest } from "@/lib/mobileSession";
import { compareByDueness } from "@/lib/fsrs";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function parseLimit(raw: string | null): number {
  if (!raw) return DEFAULT_LIMIT;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
}

function parseLanguage(raw: string | null): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

// Mobile mirror of /api/practice/due. Returns the user's favorites ordered by
// FSRS dueness so the practice flow on mobile can load SRS-due items first.
// Authenticates with the mobile session token, not Clerk's web cookie.
export async function GET(req: NextRequest): Promise<Response> {
  const session = getMobileSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = parseLimit(url.searchParams.get("limit"));
  const language = parseLanguage(url.searchParams.get("language"));

  try {
    const favorites = await prisma.favorite.findMany({
      where: {
        userId: session.sub,
        ...(language ? { language } : {}),
      },
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

    // Per-story voiceId hint: practice TTS picks the voice used to
    // narrate the story (when it's a Studio-generated JourneyStory).
    // Catalog stories don't carry a voiceId (their audio was produced
    // with ElevenLabs which is paid + not in our licence-clean cast),
    // so they fall through to the language default downstream.
    const slugs = Array.from(
      new Set(favorites.map((f) => f.storySlug).filter((s): s is string => Boolean(s)))
    );
    const journeyVoiceRows = slugs.length
      ? await prisma.journeyStory.findMany({
          where: { slug: { in: slugs } },
          select: { slug: true, voiceId: true },
        })
      : [];
    const voiceBySlug = new Map<string, string>();
    for (const row of journeyVoiceRows) {
      if (row.slug && row.voiceId) voiceBySlug.set(row.slug, row.voiceId);
    }

    const now = new Date();
    const sorted = [...favorites].sort((a, b) => compareByDueness(a, b, now));
    const due = sorted.slice(0, limit).map((fav) => ({
      ...fav,
      voiceId: fav.storySlug ? voiceBySlug.get(fav.storySlug) ?? null : null,
      isDue: fav.nextReviewAt === null || fav.nextReviewAt.getTime() <= now.getTime(),
      nextReviewAt: fav.nextReviewAt ? fav.nextReviewAt.toISOString() : null,
      lastReviewedAt: fav.lastReviewedAt ? fav.lastReviewedAt.toISOString() : null,
    }));

    return NextResponse.json({
      items: due,
      total: favorites.length,
      dueCount: sorted.filter(
        (f) => f.nextReviewAt === null || f.nextReviewAt.getTime() <= now.getTime()
      ).length,
    });
  } catch (err) {
    console.error("❌ Error en GET /api/mobile/practice/due:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
