import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { isStudioMember } from "@/lib/studio-access";
import { DEFAULT_NARRATION_TEMPO, DEFAULT_VOICE_SETTINGS, softenPunctuationForTts } from "@/lib/elevenlabs";
import { spliceFragmentIntoMaster } from "@/lib/audioEditorSplice";
import { replaceSectionAndRebuild } from "@/lib/audioEditorSections";

export const maxDuration = 120;

// Max in-app ElevenLabs regenerations allowed per segment (spend cap).
// Beyond this the operator falls back to manual upload (no API cost).
const MAX_REGENS_PER_SEGMENT = 1;

// Voice ids that belong to local TTS engines (not ElevenLabs). The editor
// can't synthesize these on the server, so regenerate is ElevenLabs-only.
const LOCAL_ENGINE_PREFIXES = ["piper/", "kokoro/", "f5/", "qwen/", "qwen17/", "chatterbox/", "coqui/", "bark/"];

function resolveElevenLabsVoiceId(voiceId: string): string | null {
  const id = voiceId.trim();
  if (!id) return null;
  if (id.startsWith("elevenlabs/")) return id.slice("elevenlabs/".length) || null;
  if (LOCAL_ENGINE_PREFIXES.some((p) => id.startsWith(p))) return null;
  // Bare id with no known local-engine prefix → treat as ElevenLabs.
  return id;
}

/**
 * POST /api/studio/audio-editor/regenerate
 *   { storyId, startSec, endSec, voiceId, text }
 *
 * Re-synthesize a tramo with its ElevenLabs voice (a fresh take of the
 * SAME voice + text), then splice it into the master — matching the
 * master's tempo + loudness — and store the result as a preview. Costs
 * ElevenLabs credits; the UI gates this behind an explicit confirm.
 *
 * Splice runs on local ffmpeg or Modal (Vercel), so this works in prod.
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email || !(await isStudioMember(email))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { storyId?: string; startSec?: number; endSec?: number; voiceId?: string; text?: string; fragmentIndex?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }
  const { storyId } = body;
  const startSec = Number(body.startSec);
  const endSec = Number(body.endSec);
  const text = (body.text ?? "").trim();
  const rawVoiceId = (body.voiceId ?? "").trim();
  // When the story has captured sections, the editor sends the section
  // index → we re-synthesize THAT section and rebuild the master (no
  // time-splice, no offsets). startSec/endSec are only needed for the
  // legacy time-splice fallback.
  const sectionMode = typeof body.fragmentIndex === "number";
  const fragmentIndex = body.fragmentIndex ?? -1;

  if (!storyId) return NextResponse.json({ error: "storyId requerido" }, { status: 400 });
  if (!sectionMode && (!Number.isFinite(startSec) || !Number.isFinite(endSec) || endSec <= startSec)) {
    return NextResponse.json({ error: "startSec/endSec inválidos" }, { status: 400 });
  }
  if (!text) return NextResponse.json({ error: "Falta el texto del tramo a regenerar" }, { status: 400 });
  if (!rawVoiceId) return NextResponse.json({ error: "Falta la voz del tramo" }, { status: 400 });

  const elVoiceId = resolveElevenLabsVoiceId(rawVoiceId);
  if (!elVoiceId) {
    return NextResponse.json(
      { error: `La voz "${rawVoiceId}" no es de ElevenLabs (es un motor local). Para esa voz usa "Subir fragmento".` },
      { status: 400 },
    );
  }

  const story = await prisma.journeyStory.findUnique({
    where: { id: storyId },
    select: { id: true, slug: true, audioUrl: true, audioFilename: true, audioEditorRegenCounts: true },
  });
  if (!story) return NextResponse.json({ error: "Historia no encontrada" }, { status: 404 });
  if (!story.audioUrl) {
    return NextResponse.json({ error: "La historia no tiene audio maestro todavía" }, { status: 400 });
  }

  // Spend cap: each in-app ElevenLabs regenerate costs credits, so a
  // segment can only be regenerated MAX_REGENS_PER_SEGMENT times. Past
  // that the operator must use "Subir fragmento" (manual upload, no API
  // cost). Manual uploads never touch this counter. Keyed by fragment
  // index; only enforced in section mode (the only path with an index).
  const regenCounts: Record<string, number> =
    story.audioEditorRegenCounts && typeof story.audioEditorRegenCounts === "object" && !Array.isArray(story.audioEditorRegenCounts)
      ? (story.audioEditorRegenCounts as Record<string, number>)
      : {};
  const usedRegens = sectionMode ? Number(regenCounts[String(fragmentIndex)] ?? 0) : 0;
  if (sectionMode && usedRegens >= MAX_REGENS_PER_SEGMENT) {
    return NextResponse.json(
      {
        error: `Límite de ${MAX_REGENS_PER_SEGMENT} regeneraciones alcanzado para este segmento. Para más cambios, usa "Subir fragmento" (genera el audio en ElevenLabs y súbelo manualmente).`,
        regenLimitReached: true,
        regensUsed: usedRegens,
        regenLimit: MAX_REGENS_PER_SEGMENT,
      },
      { status: 429 },
    );
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ELEVENLABS_API_KEY no configurado" }, { status: 500 });

  // The title fragment (index 0) is a bare noun phrase; appending a
  // terminal period nudges v2 toward a falling "title" read (best-effort).
  // We tried v3 for a cleaner title intonation, but it added background
  // noise + a room mismatch against the v2 body, so EVERYTHING stays on
  // v2. When v2's title intonation isn't good enough, the operator uploads
  // a manual take ("Subir fragmento") instead of burning regen credits.
  const isTitle = sectionMode && fragmentIndex === 0;
  const ttsText = isTitle && !/[.!?…:]$/.test(text.trim()) ? `${text.trim()}.` : text;
  const model = "eleven_multilingual_v2";
  const voiceSettings = DEFAULT_VOICE_SETTINGS;

  // ── Synthesize the new segment with ElevenLabs ──
  let segment: Buffer;
  try {
    const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${elVoiceId}`, {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        text: softenPunctuationForTts(ttsText),
        model_id: model,
        voice_settings: voiceSettings,
        // next_text suppresses the seam inhale/exhale (disableStitching
        // parity). v2 supports it for every fragment, title included.
        next_text: " ",
      }),
    });
    if (!ttsRes.ok) {
      const detail = await ttsRes.text().catch(() => "");
      return NextResponse.json({ error: `ElevenLabs ${ttsRes.status}: ${detail.slice(0, 300)}` }, { status: 502 });
    }
    segment = Buffer.from(await ttsRes.arrayBuffer());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error sintetizando con ElevenLabs" }, { status: 502 });
  }

  // ── SECTION MODE: swap this section's standalone file + rebuild master.
  // Exact, no time-splice, no drift. Writes directly (no preview) — the
  // old section file stays in R2, so re-regenerating is the "undo".
  if (sectionMode) {
    try {
      const r = await replaceSectionAndRebuild({
        storyId,
        fragmentIndex,
        newSectionBuffer: segment,
        newText: text || undefined,
        normalizeSection: true, // fresh TTS runs hot (esp. v3) → loudnorm
      });
      // NOTE: we deliberately do NOT re-run aeneas here — playback uses
      // the section files, so the edit loop stays fast (~seconds). The
      // word-highlight timings refresh once via the "Re-alinear" button
      // when the operator is done editing sections.

      // Count this paid regeneration against the per-segment cap.
      const newUsed = usedRegens + 1;
      const nextCounts = { ...regenCounts, [String(fragmentIndex)]: newUsed };
      await prisma.journeyStory.update({
        where: { id: storyId },
        data: { audioEditorRegenCounts: nextCounts },
      });

      return NextResponse.json({
        ok: true,
        sectionReplaced: true,
        audioUrl: r.audioUrl,
        sectionUrl: r.sectionUrl,
        prevSectionUrl: r.prevSectionUrl,
        regensUsed: newUsed,
        regenLimit: MAX_REGENS_PER_SEGMENT,
      });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Error reemplazando la sección" }, { status: 502 });
    }
  }

  const baseName = (story.audioFilename ?? `${story.slug}.mp3`)
    .replace(/\.mp3$/, "")
    .replace(/_edit\d+$/, "")
    .replace(/_upload\d+$/, "")
    .replace(/_regen\d+$/, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_");
  const newFilename = `${baseName}_regen${Date.now()}.mp3`;

  // Splice, matching the master narration profile (tempo + loudness).
  let result: { url: string; filename: string };
  try {
    result = await spliceFragmentIntoMaster({
      masterUrl: story.audioUrl,
      fragment: segment,
      startSec,
      endSec,
      filename: newFilename,
      process: { tempo: DEFAULT_NARRATION_TEMPO, loudnorm: true },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error empalmando el tramo" }, { status: 502 });
  }

  await prisma.journeyStory.update({
    where: { id: storyId },
    data: { audioUrlPreview: result.url, audioFilenamePreview: result.filename },
  });

  return NextResponse.json({ ok: true, audioUrlPreview: result.url, audioFilenamePreview: result.filename });
}
