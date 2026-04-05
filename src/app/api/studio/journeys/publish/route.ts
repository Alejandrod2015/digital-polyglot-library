import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isStudioMember } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";
import { revalidateTag } from "next/cache";

/**
 * POST /api/studio/journeys/publish
 * Body: { storyId } — marks a JourneyStory as published (readable in the app)
 * No longer writes to Sanity — the reader loads directly from PostgreSQL.
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
