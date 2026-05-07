// Mobile-side companion to the studio word-timings pipeline.
// Returns the AudioWordTimingsPayload for a given JourneyStory slug,
// or { timings: null } when no alignment exists. The mobile reader uses
// this to opt into the highlighted body render. Safe to call for every
// story; the payload is null for any story that hasn't been aligned.

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

import { getMobileSessionFromRequest } from "@/lib/mobileSession";
import { coerceAudioWordTimings } from "@/lib/audioWordTimings";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest): Promise<Response> {
  const session = getMobileSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const slug = req.nextUrl.searchParams.get("slug")?.trim();
  if (!slug) {
    return NextResponse.json({ error: "slug required" }, { status: 400 });
  }

  try {
    const row = await prisma.journeyStory.findFirst({
      where: { slug, status: "published" },
      select: { audioWordTimings: true },
    });

    const timings = coerceAudioWordTimings(row?.audioWordTimings ?? null);
    return NextResponse.json({ timings });
  } catch (error) {
    console.error("[mobile/audio-word-timings] failed", error);
    return NextResponse.json({ timings: null });
  }
}
