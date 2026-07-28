import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { isStudioMember } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";
import { effectiveAudioStatus } from "@/lib/staleAudioLock";

/**
 * GET /api/studio/journeys/stories?journeyId=xxx; get all stories for a journey
 */
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  if (!user?.primaryEmailAddress?.emailAddress || !(await isStudioMember(user.primaryEmailAddress.emailAddress)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const journeyId = request.nextUrl.searchParams.get("journeyId");
  if (!journeyId) return NextResponse.json({ error: "journeyId required" }, { status: 400 });

  const stories = await prisma.journeyStory.findMany({
    where: { journeyId, status: { not: "deprecated" } },
    orderBy: [{ level: "asc" }, { topic: "asc" }, { slotIndex: "asc" }],
    select: {
      id: true, journeyId: true, slug: true, level: true, topic: true, slotIndex: true,
      status: true, title: true, wordCount: true, vocabCount: true,
      sanityId: true, coverDone: true, coverUrl: true,
      audioUrl: true, audioStatus: true, updatedAt: true,
      audioQaStatus: true, audioQaScore: true, audioQaNotes: true,
      auditScore: true, auditOffenders: true, auditedAt: true,
      error: true,
    },
  });

  // Un candado de audio caducado no es "generando": es pendiente. Sin esto,
  // un render que muere sin ejecutar su catch deja el punto del monitor en
  // curso para siempre (paso el 2026-07-22 con 18 historias, 6 dias).
  const ahora = Date.now();
  return NextResponse.json(
    stories.map((s) => ({ ...s, audioStatus: effectiveAudioStatus(s.audioStatus, s.updatedAt, ahora) }))
  );
}

/**
 * DELETE /api/studio/journeys/stories; delete a single story
 * Body: { storyId }
 */
export async function DELETE(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  if (!user?.primaryEmailAddress?.emailAddress || !(await isStudioMember(user.primaryEmailAddress.emailAddress)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: Record<string, any>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { storyId } = body;
  if (!storyId) return NextResponse.json({ error: "storyId required" }, { status: 400 });

  await prisma.journeyStory.delete({ where: { id: storyId } });
  return NextResponse.json({ ok: true });
}

/**
 * POST /api/studio/journeys/stories; add a new story slot to a topic
 * Body: { journeyId, level, topic, slotIndex }
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  if (!user?.primaryEmailAddress?.emailAddress || !(await isStudioMember(user.primaryEmailAddress.emailAddress)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: Record<string, any>;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { journeyId, level, topic, slotIndex } = body;
  if (!journeyId || !level || !topic || slotIndex == null)
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const story = await prisma.journeyStory.create({
    data: { journeyId, level, topic, slotIndex, status: "draft" },
    select: {
      id: true, journeyId: true, slug: true, level: true, topic: true, slotIndex: true,
      status: true, title: true, wordCount: true, vocabCount: true,
      sanityId: true, coverDone: true, coverUrl: true,
      audioUrl: true, audioStatus: true,
      audioQaStatus: true, audioQaScore: true, audioQaNotes: true,
      auditScore: true, auditOffenders: true, auditedAt: true,
      error: true,
    },
  });

  return NextResponse.json(story);
}
