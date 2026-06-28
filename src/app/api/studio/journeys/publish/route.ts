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
