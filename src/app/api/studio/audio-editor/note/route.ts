import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { isStudioMember } from "@/lib/studio-access";

/**
 * POST /api/studio/audio-editor/note   { storyId, note }
 *
 * Save (or clear) the operator's free-form audio note; a manual reminder
 * of what still needs regenerating/uploading. Stored in
 * `JourneyStory.audioEditorNote`, which nothing else writes, so it
 * survives regeneration and QA passes.
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email || !(await isStudioMember(email))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { storyId?: string; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { storyId } = body;
  if (!storyId) return NextResponse.json({ error: "storyId required" }, { status: 400 });

  const trimmed = (body.note ?? "").trim();
  if (trimmed.length > 2000) {
    return NextResponse.json({ error: "La nota es demasiado larga (máx 2000 caracteres)" }, { status: 400 });
  }

  const story = await prisma.journeyStory.findUnique({ where: { id: storyId }, select: { id: true } });
  if (!story) return NextResponse.json({ error: "Historia no encontrada" }, { status: 404 });

  await prisma.journeyStory.update({
    where: { id: storyId },
    // Empty string clears the note back to null.
    data: { audioEditorNote: trimmed ? trimmed : null },
  });

  return NextResponse.json({ ok: true, note: trimmed || null });
}
