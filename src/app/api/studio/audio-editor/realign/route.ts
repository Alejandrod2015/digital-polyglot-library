import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { isStudioMember } from "@/lib/studio-access";
import { generateWordTimingsForStory } from "@/lib/audioWordTimings";

export const maxDuration = 300;

/**
 * POST /api/studio/audio-editor/realign
 *
 * Re-run aeneas forced alignment on the current master audio to refresh
 * `audioWordTimings`. Useful when an existing story's timings were
 * produced before improvements to the alignment pipeline (e.g. before
 * `stripSpeakerLabels` was added; those legacy timings have spurious
 * tokens at speaker-label positions which cause "next speaker name
 * appears at the end of each block" in the editor).
 *
 * Doesn't touch the audio file itself; only updates the timings JSON.
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email || !(await isStudioMember(email))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { storyId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { storyId } = body;
  if (!storyId) return NextResponse.json({ error: "storyId required" }, { status: 400 });

  try {
    const payload = await generateWordTimingsForStory(storyId);
    return NextResponse.json({
      ok: true,
      wordCount: payload.words.length,
      audioDurationSec: payload.audioDurationSec,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Alignment failed" },
      { status: 500 },
    );
  }
}
