import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { isStudioMember } from "@/lib/studio-access";

/**
 * POST /api/studio/audio-editor/comment   { storyId, fragmentIndex, comment }
 *
 * Save (or clear) a per-segment operator comment for the audio editor —
 * a free-form reminder the worker leaves on an individual block/title
 * ("subí manual", "falta regenerar"). Stored in
 * `JourneyStory.audioEditorComments`, keyed by fragment index. Nothing
 * else writes this column, so comments survive regeneration + QA.
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email || !(await isStudioMember(email))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { storyId?: string; fragmentIndex?: number; comment?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { storyId } = body;
  const fragmentIndex = body.fragmentIndex;
  if (!storyId) return NextResponse.json({ error: "storyId required" }, { status: 400 });
  if (typeof fragmentIndex !== "number" || !Number.isInteger(fragmentIndex) || fragmentIndex < 0) {
    return NextResponse.json({ error: "fragmentIndex inválido" }, { status: 400 });
  }

  const trimmed = (body.comment ?? "").trim();
  if (trimmed.length > 1000) {
    return NextResponse.json({ error: "El comentario es demasiado largo (máx 1000 caracteres)" }, { status: 400 });
  }

  const story = await prisma.journeyStory.findUnique({
    where: { id: storyId },
    select: { id: true, audioEditorComments: true },
  });
  if (!story) return NextResponse.json({ error: "Historia no encontrada" }, { status: 404 });

  const comments: Record<string, string> =
    story.audioEditorComments && typeof story.audioEditorComments === "object" && !Array.isArray(story.audioEditorComments)
      ? { ...(story.audioEditorComments as Record<string, string>) }
      : {};

  // Empty string clears this segment's comment.
  if (trimmed) comments[String(fragmentIndex)] = trimmed;
  else delete comments[String(fragmentIndex)];

  await prisma.journeyStory.update({
    where: { id: storyId },
    data: { audioEditorComments: Object.keys(comments).length ? comments : Prisma.DbNull },
  });

  return NextResponse.json({ ok: true, fragmentIndex, comment: trimmed || null });
}
