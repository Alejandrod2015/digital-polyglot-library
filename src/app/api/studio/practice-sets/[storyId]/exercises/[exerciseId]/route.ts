/**
 * Studio API: edit a single exercise inside a JourneyStory's practice set.
 *
 *   PATCH  body: { sentence?, word?, audioUrl?, payload? }
 *
 * `payload` lets editors override options/answer/extra fields without
 * having dedicated columns for each exercise type.
 */
import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isStudioMember } from "@/lib/studio-access";

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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ storyId: string; exerciseId: string }> }
) {
  const denied = await gate();
  if (denied) return denied;
  const { storyId, exerciseId } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    sentence?: string;
    word?: string;
    audioUrl?: string | null;
    payload?: Record<string, unknown>;
  };

  // Make sure the exercise belongs to a set owned by this story so we
  // don't let a user with an exerciseId of one story edit another's.
  const exercise = await prisma.storyPracticeExercise.findUnique({
    where: { id: exerciseId },
    include: { set: { select: { storyId: true, locked: true } } },
  });
  if (!exercise || exercise.set.storyId !== storyId) {
    return NextResponse.json({ error: "Exercise not found" }, { status: 404 });
  }
  if (exercise.set.locked) {
    return NextResponse.json({ error: "Set is locked. Unlock first." }, { status: 409 });
  }

  const updated = await prisma.storyPracticeExercise.update({
    where: { id: exerciseId },
    data: {
      ...(typeof body.sentence === "string" ? { sentence: body.sentence } : {}),
      ...(typeof body.word === "string" ? { word: body.word } : {}),
      ...(body.audioUrl !== undefined ? { audioUrl: body.audioUrl } : {}),
      ...(body.payload && typeof body.payload === "object"
        ? { payload: body.payload as never }
        : {}),
    },
  });

  return NextResponse.json({
    exercise: {
      id: updated.id,
      orderIndex: updated.orderIndex,
      type: updated.type,
      word: updated.word,
      sentence: updated.sentence,
      audioUrl: updated.audioUrl,
      payload: updated.payload,
    },
  });
}
