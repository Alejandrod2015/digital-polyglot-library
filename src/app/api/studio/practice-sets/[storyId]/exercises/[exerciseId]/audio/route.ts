/**
 * Studio API: regenerate the TTS clip for a single practice exercise.
 *
 *   POST  body: {}  (uses the exercise's current `sentence` + the parent
 *                    journey's language/variant + the story's voiceId)
 *
 * Internally delegates to /api/practice/sentence-tts so the R2 cache key
 * and Modal voice-selection logic stay in one place. The parent practice
 * set must be unlocked.
 */
import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isStudioMember } from "@/lib/studio-access";

// sentence-tts can cold-start on Modal; mirror its max duration so we
// don't time out before it does.
export const maxDuration = 300;

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
  { params }: { params: Promise<{ storyId: string; exerciseId: string }> }
) {
  const denied = await gate();
  if (denied) return denied;
  const { storyId, exerciseId } = await params;

  const exercise = await prisma.storyPracticeExercise.findUnique({
    where: { id: exerciseId },
    include: {
      set: {
        select: {
          storyId: true,
          locked: true,
          story: {
            select: {
              voiceId: true,
              journey: { select: { language: true, variant: true } },
            },
          },
        },
      },
    },
  });
  if (!exercise || exercise.set.storyId !== storyId) {
    return NextResponse.json({ error: "Exercise not found" }, { status: 404 });
  }
  if (exercise.set.locked) {
    return NextResponse.json(
      { error: "Set is locked. Desbloquéalo antes de regenerar audio." },
      { status: 409 }
    );
  }

  const sentence = (exercise.sentence ?? "").trim();
  if (!sentence) {
    return NextResponse.json({ error: "Este ejercicio no tiene frase para sintetizar." }, { status: 400 });
  }
  const journey = exercise.set.story.journey;
  const language = journey?.language ?? "";
  const variant = journey?.variant ?? "";
  const voiceId = exercise.set.story.voiceId ?? undefined;
  if (!language) {
    return NextResponse.json({ error: "Idioma del journey no disponible." }, { status: 400 });
  }

  // Reuse the existing sentence-tts pipeline (R2 cache + Modal Piper/Kokoro)
  // by hitting it as an internal fetch. Forward the Clerk session cookie
  // so the nested handler's `auth()` resolves the same user.
  const cookieHeader = req.headers.get("cookie") ?? "";
  const authHeader = req.headers.get("authorization") ?? "";
  const origin = new URL(req.url).origin;

  let ttsRes: Response;
  try {
    ttsRes = await fetch(`${origin}/api/practice/sentence-tts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify({ sentence, language, variant, voiceId }),
    });
  } catch (err) {
    return NextResponse.json(
      { error: "No se pudo conectar al servicio de TTS", detail: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }
  if (!ttsRes.ok) {
    const detail = await ttsRes.text().catch(() => "");
    return NextResponse.json(
      { error: `TTS falló (HTTP ${ttsRes.status})`, detail: detail.slice(0, 400) },
      { status: ttsRes.status }
    );
  }
  const payload = (await ttsRes.json().catch(() => ({}))) as { url?: string };
  const newUrl = typeof payload.url === "string" ? payload.url : null;
  if (!newUrl) {
    return NextResponse.json({ error: "sentence-tts no devolvió URL." }, { status: 502 });
  }

  const updated = await prisma.storyPracticeExercise.update({
    where: { id: exerciseId },
    data: { audioUrl: newUrl },
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
