import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isStudioMember } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";
import { findVoice } from "@/lib/voiceCatalog";
import { isVoiceApproved } from "@/lib/approvedVoices";

// Engines that are NOT ElevenLabs (local TTS / cloned) → not covered by the
// ElevenLabs approved-voices allowlist, so they skip that check here.
const NON_ELEVENLABS_PREFIXES = ["f5/", "piper/", "kokoro/", "qwen/", "qwen17/", "chatterbox/", "coqui/", "bark/"];

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  if (!user?.primaryEmailAddress?.emailAddress || !(await isStudioMember(user.primaryEmailAddress.emailAddress)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { storyId?: string; voiceId?: string | null };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { storyId, voiceId } = body;
  if (!storyId) return NextResponse.json({ error: "storyId required" }, { status: 400 });
  if (voiceId) {
    // POLICY 2026-07-24 (solo ElevenLabs, o silencio): una voz de motor local
    // (piper/kokoro/f5/qwen/…) no puede fijarse en una historia; antes se
    // permitía (saltaba el check de aprobación) y luego preview-segment la
    // renderizaba con Piper. Prohibido → 403.
    const isLocalEngine = NON_ELEVENLABS_PREFIXES.some((p) => voiceId.startsWith(p));
    if (isLocalEngine) {
      return NextResponse.json(
        {
          error: `La voz "${voiceId}" es de un motor local (no ElevenLabs). Deshabilitado por política (solo ElevenLabs).`,
          code: "NON_ELEVENLABS_GENERATION_DISABLED",
        },
        { status: 403 },
      );
    }
    if (!findVoice(voiceId)) {
      return NextResponse.json({ error: `Unknown voiceId: ${voiceId}` }, { status: 400 });
    }
    // Fail-fast: an ElevenLabs voice must be on the approved allowlist
    // (src/lib/approvedVoices.ts) before it can be attached to a story;
    // otherwise every regenerate/preview with it would be blocked anyway.
    const elId = voiceId.startsWith("elevenlabs/") ? voiceId.slice("elevenlabs/".length) : voiceId;
    if (!isVoiceApproved(elId)) {
      return NextResponse.json(
        { error: `La voz "${voiceId}" no está en la allowlist de voces aprobadas. Solo el dueño aprueba voces nuevas.` },
        { status: 403 },
      );
    }
  }

  await prisma.journeyStory.update({
    where: { id: storyId },
    data: { voiceId: voiceId || null },
  });
  return NextResponse.json({ ok: true });
}
