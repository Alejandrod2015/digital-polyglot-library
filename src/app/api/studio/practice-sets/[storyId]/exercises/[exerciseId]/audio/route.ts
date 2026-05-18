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

/** Returns the text to send to Piper for this exercise. Prefers
 *  payload.audioClip.sentence (full sentence) over the display column
 *  `sentence` (may contain `_____`). Falls back to replacing the blank
 *  with the answer when audioClip is absent. */
function resolveTTSText(exercise: {
  sentence: string;
  word: string;
  payload: unknown;
}): string {
  const payload = (exercise.payload ?? {}) as Record<string, unknown>;
  const clip = payload.audioClip as Record<string, unknown> | null | undefined;
  const clipSentence = clip && typeof clip.sentence === "string" ? clip.sentence.trim() : "";
  if (clipSentence) return clipSentence;

  const raw = (exercise.sentence ?? "").trim();
  if (!raw) return "";
  const hasBlank = /_{3,}/.test(raw);
  if (!hasBlank) return raw;

  const answer =
    typeof payload.answer === "string" && payload.answer.trim()
      ? payload.answer.trim()
      : exercise.word.trim();
  if (!answer) return raw;
  return raw.replace(/_{3,}/g, answer);
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
              practiceVoiceId: true,
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

  // The DB column `sentence` is the display form ("Mmm, _____!" for
  // fill_blank). Piper reads the underscores as silence/garbage, so the
  // audio ends up missing the target word. The generator stores the
  // full sentence in `payload.audioClip.sentence`; prefer that, and fall
  // back to substituting `_____` with the answer when missing.
  const sentence = resolveTTSText(exercise);
  if (!sentence) {
    return NextResponse.json({ error: "Este ejercicio no tiene frase para sintetizar." }, { status: 400 });
  }
  const journey = exercise.set.story.journey;
  const language = journey?.language ?? "";
  const variant = journey?.variant ?? "";
  // Practice voice priority: per-story override → narration voice (when
  // it happens to be a supported practice voice) → language default
  // (handled downstream by sentence-tts).
  const { resolvePracticeVoice } = await import("@/lib/practiceVoices");
  const voiceId =
    resolvePracticeVoice(exercise.set.story.practiceVoiceId, language) ??
    exercise.set.story.voiceId ??
    undefined;
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
