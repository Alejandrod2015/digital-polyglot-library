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
    })),
  };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ storyId: string }> }) {
  const denied = await gate();
  if (denied) return denied;
  const { storyId } = await params;
  const set = await loadSet(storyId);
  if (!set) return NextResponse.json({ set: null });
  return NextResponse.json({ set: serialize(set) });
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
  const set = await loadSet(storyId);
  return NextResponse.json({ status: result.status, set: set ? serialize(set) : null });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ storyId: string }> }) {
  const denied = await gate();
  if (denied) return denied;
  const { storyId } = await params;
  const body = (await req.json().catch(() => ({}))) as { locked?: boolean };
  if (typeof body.locked !== "boolean") {
    return NextResponse.json({ error: "Missing `locked` boolean" }, { status: 400 });
  }
  const set = await prisma.storyPracticeSet.findUnique({ where: { storyId } });
  if (!set) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.storyPracticeSet.update({ where: { id: set.id }, data: { locked: body.locked } });
  const fresh = await loadSet(storyId);
  return NextResponse.json({ set: fresh ? serialize(fresh) : null });
}
