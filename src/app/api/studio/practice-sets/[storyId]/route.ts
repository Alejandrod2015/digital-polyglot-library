/**
 * Studio API for the editorial practice-set of one JourneyStory.
 *
 *   POST   regenerate the set (body: `{ force?: boolean }`)
 *   PATCH  toggle locked  (body: `{ locked: boolean }`)
 *   GET    fetch the current set
 *
 * Auth: signed-in Clerk user that's also in the Studio members list.
 */
import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isStudioMember } from "@/lib/studio-access";
import { buildAndPersistStoryPracticeSet } from "@/lib/storyPracticeSets";

async function gate(): Promise<NextResponse | null> {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email || !(await isStudioMember(email))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

async function loadSet(storyId: string) {
  return prisma.storyPracticeSet.findUnique({
    where: { storyId },
    include: { exercises: { orderBy: { orderIndex: "asc" } } },
  });
}

function serialize(set: NonNullable<Awaited<ReturnType<typeof loadSet>>>) {
  return {
    id: set.id,
    locked: set.locked,
    updatedAt: set.updatedAt.toISOString(),
    exercises: set.exercises.map((e) => ({
      id: e.id,
      orderIndex: e.orderIndex,
      type: e.type,
      word: e.word,
      sentence: e.sentence,
      audioUrl: e.audioUrl,
      payload: e.payload,
      featured: e.featured,
    })),
  };
}

async function loadStoryMeta(storyId: string) {
  return prisma.journeyStory.findUnique({
    where: { id: storyId },
    select: { practiceVoiceId: true, journey: { select: { language: true } } },
  });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ storyId: string }> }) {
  const denied = await gate();
  if (denied) return denied;
  const { storyId } = await params;
  const [set, meta] = await Promise.all([loadSet(storyId), loadStoryMeta(storyId)]);
  return NextResponse.json({
    set: set ? serialize(set) : null,
    practiceVoiceId: meta?.practiceVoiceId ?? null,
    language: meta?.journey.language ?? null,
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ storyId: string }> }) {
  const denied = await gate();
  if (denied) return denied;
  const { storyId } = await params;
  const body = (await req.json().catch(() => ({}))) as { force?: boolean };
  const result = await buildAndPersistStoryPracticeSet(storyId, !!body.force);
  if (result.status === "skipped") {
    return NextResponse.json({ error: `Skipped: ${result.reason}` }, { status: 409 });
  }
  const [set, meta] = await Promise.all([loadSet(storyId), loadStoryMeta(storyId)]);
  return NextResponse.json({
    status: result.status,
    set: set ? serialize(set) : null,
    practiceVoiceId: meta?.practiceVoiceId ?? null,
    language: meta?.journey.language ?? null,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ storyId: string }> }) {
  const denied = await gate();
  if (denied) return denied;
  const { storyId } = await params;
  const body = (await req.json().catch(() => ({}))) as { locked?: boolean; practiceVoiceId?: string | null };

  if (typeof body.locked !== "boolean" && body.practiceVoiceId === undefined) {
    return NextResponse.json({ error: "Missing `locked` or `practiceVoiceId`" }, { status: 400 });
  }

  // Lock toggle lives on the set row.
  if (typeof body.locked === "boolean") {
    const set = await prisma.storyPracticeSet.findUnique({ where: { storyId } });
    if (!set) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await prisma.storyPracticeSet.update({ where: { id: set.id }, data: { locked: body.locked } });
  }

  // practiceVoiceId lives on the parent JourneyStory (it applies to
  // future audio regens, not the set itself).
  if (body.practiceVoiceId !== undefined) {
    const value = body.practiceVoiceId;
    if (value === null || value === "") {
      await prisma.journeyStory.update({ where: { id: storyId }, data: { practiceVoiceId: null } });
    } else if (typeof value === "string") {
      const { isPracticeVoiceSupported } = await import("@/lib/practiceVoices");
      if (!isPracticeVoiceSupported(value)) {
        return NextResponse.json(
          { error: `practiceVoiceId "${value}" no es una voz soportada por el pipeline de práctica.` },
          { status: 400 }
        );
      }
      await prisma.journeyStory.update({ where: { id: storyId }, data: { practiceVoiceId: value } });
    }
  }

  const fresh = await loadSet(storyId);
  const story = await prisma.journeyStory.findUnique({
    where: { id: storyId },
    select: { practiceVoiceId: true, journey: { select: { language: true } } },
  });
  return NextResponse.json({
    set: fresh ? serialize(fresh) : null,
    practiceVoiceId: story?.practiceVoiceId ?? null,
    language: story?.journey.language ?? null,
  });
}
