/**
 * Studio API: upload a custom audio clip for a single practice exercise.
 *
 *   POST /api/studio/practice-sets/[storyId]/exercises/[exerciseId]/audio
 *
 * Multipart body with a single `file` field. Accepts mp3/wav/m4a/ogg up
 * to 5 MB. Stores under media/generated/audio/practice-<exerciseId>-
 * <timestamp>.<ext> in the public R2 bucket and writes the resulting
 * URL back onto the exercise row.
 *
 * Used by PracticeSetEditor so editors can replace a TTS-generated clip
 * with a real recording without leaving the row.
 */
import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isStudioMember } from "@/lib/studio-access";
import { uploadPublicObject, isObjectStorageConfigured } from "@/lib/objectStorage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/m4a",
  "audio/mp4",
  "audio/aac",
  "audio/x-m4a",
  "audio/ogg",
  "audio/webm",
]);

function extFromType(type: string): string {
  if (type.includes("mpeg") || type.includes("mp3")) return "mp3";
  if (type.includes("wav") || type.includes("wave")) return "wav";
  if (type.includes("m4a") || type.includes("mp4") || type.includes("aac")) return "m4a";
  if (type.includes("ogg")) return "ogg";
  if (type.includes("webm")) return "webm";
  return "mp3";
}

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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ storyId: string; exerciseId: string }> },
) {
  const denied = await gate();
  if (denied) return denied;

  if (!isObjectStorageConfigured()) {
    return NextResponse.json({ error: "Object storage not configured" }, { status: 500 });
  }

  const { storyId, exerciseId } = await params;

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

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: "Missing `file` field" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB; max 5 MB)` },
      { status: 413 },
    );
  }
  const type = (file.type || "audio/mpeg").toLowerCase();
  if (!ALLOWED_TYPES.has(type)) {
    return NextResponse.json(
      { error: `Unsupported audio type: ${type}` },
      { status: 415 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const key = `media/generated/audio/practice-${exerciseId}-${Date.now()}.${extFromType(type)}`;
  const uploaded = await uploadPublicObject({
    key,
    body: buffer,
    contentType: type,
  });
  if (!uploaded) {
    return NextResponse.json({ error: "Upload failed" }, { status: 502 });
  }

  const updated = await prisma.storyPracticeExercise.update({
    where: { id: exerciseId },
    data: { audioUrl: uploaded.url },
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
