import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isStudioMember } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";
import { revalidateTag } from "next/cache";

/**
 * POST /api/studio/journeys/publish
 * Body: { storyId }; marks a JourneyStory as published (readable in the app)
 * No longer writes to Sanity; the reader loads directly from PostgreSQL.
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email || !(await isStudioMember(email)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: Record<string, any>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { storyId } = body;
  if (!storyId) return NextResponse.json({ error: "storyId required" }, { status: 400 });

  const story = await prisma.journeyStory.findUnique({ where: { id: storyId } });
  if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });
  if (!story.text || !story.title) return NextResponse.json({ error: "Story not generated yet" }, { status: 400 });

  // Continuity gate (2026-06-27): a topic must NEVER end on an unresolved
  // cliffhanger. A `mini-cliffhanger` is valid mid-topic, but only if a later
  // slot pays it off. If this story is a mini-cliffhanger and NO later slot
  // exists in its topic (any status), block the publish. This is the
  // automatic, deterministic guard for the A1 LATAM 2026-06-26 incident
  // (Community s3 / Meeting s3 shipped as the last story with no resolution).
  // The full semantic + repetition audit lives in
  // POST /api/studio/journeys/audit-continuity (run before launching a journey).
  if (story.arcType === "mini-cliffhanger") {
    const laterSlot = await prisma.journeyStory.findFirst({
      where: {
        journeyId: story.journeyId,
        level: story.level,
        topic: story.topic,
        slotIndex: { gt: story.slotIndex },
      },
      select: { id: true },
    });
    if (!laterSlot) {
      return NextResponse.json(
        {
          error:
            "Continuity gate: this story is a mini-cliffhanger and the last slot in its topic, so the topic would end on an unresolved hook. Add a later slot that resolves it (a draft is enough), or change its arcType, before publishing.",
        },
        { status: 422 }
      );
    }
  }

  // Practice-audio completeness gate (2026-07-27): a story must NEVER be
  // published with its practice set missing audio that the app actually plays.
  // A silent-on-device bug traced to this: meaning_in_context exercises whose
  // word audio was never pre-baked fall back to runtime word-tts (silent on
  // Android). If a practice set exists, require: every meaning_in_context has
  // payload.audioClip.wordClipUrl, and every fill_blank has
  // payload.audioClip.clipUrl.
  //
  // NOT required (2026-08-24): the SENTENCE clip of a meaning_in_context.
  // That card is mode "meaning" (MobileLibraryShell mapSharedExerciseToMobile),
  // and its autoplay calls playPracticeMeaningAudio, which plays wordClipUrl
  // and NEVER the sentence clip; the code there says so in as many words.
  // Demanding it billed one ElevenLabs render per vocab word that nobody can
  // hear: 12 of the 16 clips per story on the PT-BR A1 journey.
  // Generate with scripts/_genWordClips.ts (words) + scripts/_genPracticeClips.ts
  // (sentences) before publishing. No env-var bypass.
  {
    const set = await prisma.storyPracticeSet.findUnique({
      where: { storyId },
      select: { exercises: { select: { type: true, word: true, payload: true } } },
    });
    if (set && set.exercises.length) {
      const missingWord: string[] = [];
      const missingClip: string[] = [];
      for (const ex of set.exercises) {
        const clip = ((ex.payload as Record<string, unknown> | null)?.audioClip ?? null) as
          | Record<string, unknown>
          | null;
        if (ex.type === "meaning_in_context") {
          if (!clip?.wordClipUrl) missingWord.push(ex.word);
        } else if (ex.type === "fill_blank") {
          if (!clip?.clipUrl) missingClip.push(ex.word);
        }
      }
      if (missingWord.length || missingClip.length) {
        const parts: string[] = [];
        if (missingWord.length)
          parts.push(`${missingWord.length} meaning exercise(s) missing word audio (wordClipUrl): ${missingWord.slice(0, 8).join(", ")}${missingWord.length > 8 ? "…" : ""}`);
        if (missingClip.length)
          parts.push(`${missingClip.length} exercise(s) missing sentence audio (clipUrl): ${missingClip.slice(0, 8).join(", ")}${missingClip.length > 8 ? "…" : ""}`);
        return NextResponse.json(
          {
            error:
              "Practice-audio gate: this story's practice set is missing audio, which plays silent on device. " +
              parts.join("; ") +
              ". Run scripts/_genWordClips.ts <slug> (words) and scripts/_genPracticeClips.ts <slug> (sentences), then publish.",
          },
          { status: 422 }
        );
      }
    }
  }

  try {
    await prisma.journeyStory.update({
      where: { id: storyId },
      data: { status: "published", error: null },
    });

    // Invalidate cached journey stories so the reader picks up the new story
    revalidateTag("published-journey-stories");

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
