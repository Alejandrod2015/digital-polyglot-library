// Studio-only endpoint to compute word-level alignment for an existing
// JourneyStory and persist it to the new audioWordTimings column.
// Standalone path: does NOT touch the existing audio generation pipeline,
// the existing audioSegments column, or the legacy reader.

import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { isStudioMember } from "@/lib/studio-access";
import { generateWordTimingsForStory } from "@/lib/audioWordTimings";

export const maxDuration = 300;

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email || !(await isStudioMember(email))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured on this environment" },
      { status: 503 }
    );
  }

  let body: { storyId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const storyId = typeof body.storyId === "string" ? body.storyId.trim() : "";
  if (!storyId) {
    return NextResponse.json({ error: "storyId is required" }, { status: 400 });
  }

  try {
    const payload = await generateWordTimingsForStory(storyId);
    return NextResponse.json({
      ok: true,
      storyId,
      tokenCount: payload.words.length,
      audioDurationSec: payload.audioDurationSec,
      version: payload.version,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[word-timings] failed", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
