/**
 * Audio operations for a single practice exercise.
 *
 *   POST without body  → regenerate via Modal (Piper / Kokoro) with the
 *                        story's voice + 150 ms tail silence.
 *   POST multipart with `file=<mp3|wav|m4a>` → use the uploaded clip
 *                        directly (no re-encoding, just upload to R2
 *                        as-is so the editor controls the audio).
 *   DELETE              → clear audioUrl, leaving the row blank so the
 *                        mobile client falls back to runtime TTS again.
 */
import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { isStudioMember } from "@/lib/studio-access";
import { uploadPublicObject } from "@/lib/objectStorage";
import { regenerateExerciseAudio } from "@/lib/storyPracticeSets";

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

async function ensureUnlocked(storyId: string, exerciseId: string) {
  const ex = await prisma.storyPracticeExercise.findUnique({
    where: { id: exerciseId },
    include: { set: { select: { storyId: true, locked: true } } },
  });
  if (!ex || ex.set.storyId !== storyId) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  if (ex.set.locked) return { error: NextResponse.json({ error: "Set is locked" }, { status: 409 }) };
  return { exercise: ex };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ storyId: string; exerciseId: string }> }
) {
  const denied = await gate();
  if (denied) return denied;
  const { storyId, exerciseId } = await params;
  const guard = await ensureUnlocked(storyId, exerciseId);
  if ("error" in guard) return guard.error;

  const contentType = req.headers.get("content-type") ?? "";

  // Multipart upload: editor is replacing the audio with a custom clip.
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }
    const allowed = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/mp4", "audio/x-m4a", "audio/m4a"];
    if (!allowed.includes(file.type)) {
      return NextResponse.json(
        { error: `Unsupported type: ${file.type}. Use mp3/wav/m4a.` },
        { status: 400 }
      );
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const ext = file.type.includes("wav") ? "wav" : file.type.includes("mp4") || file.type.includes("m4a") ? "m4a" : "mp3";
    const hash = crypto.createHash("sha256").update(buf).digest("hex").slice(0, 16);
    const key = `media/generated/audio/practice-upload-${exerciseId.slice(0, 8)}-${hash}.${ext}`;
    const uploaded = await uploadPublicObject({
      key,
      body: buf,
      contentType: file.type,
    });
    if (!uploaded?.url) {
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
    const row = await prisma.storyPracticeExercise.update({
      where: { id: exerciseId },
      data: { audioUrl: uploaded.url },
    });
    return NextResponse.json({ audioUrl: row.audioUrl });
  }

  // No body or JSON body → regenerate from the sentence via Modal.
  try {
    const url = await regenerateExerciseAudio(exerciseId);
    if (!url) {
      return NextResponse.json(
        { error: "Audio could not be generated (Modal unavailable or unsupported voice)" },
        { status: 502 }
      );
    }
    return NextResponse.json({ audioUrl: url });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ storyId: string; exerciseId: string }> }
) {
  const denied = await gate();
  if (denied) return denied;
  const { storyId, exerciseId } = await params;
  const guard = await ensureUnlocked(storyId, exerciseId);
  if ("error" in guard) return guard.error;
  await prisma.storyPracticeExercise.update({
    where: { id: exerciseId },
    data: { audioUrl: null },
  });
  return NextResponse.json({ audioUrl: null });
}
