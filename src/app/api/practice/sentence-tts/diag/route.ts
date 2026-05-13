/**
 * TEMPORARY end-to-end diag for the practice TTS pipeline. NO auth.
 * Mirrors the real route's voice picking + Modal call + R2 cache check.
 * Goal: confirm the production endpoint actually generates Kokoro
 * audio. Remove once the audio voice question is closed.
 */

import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { getPublicObjectUrl } from "@/lib/objectStorage";

export const maxDuration = 60;

const PRACTICE_VOICES: Record<string, string> = {
  spanish: "kokoro/ef_dora",
  portuguese: "piper/pt_BR-cadu-medium",
  italian: "piper/it_IT-paola-medium",
};

const SUPPORTED_VOICES = new Set<string>([
  "piper/es_ES-sharvard-medium",
  "piper/es_MX-claude-high",
  "piper/pt_BR-cadu-medium",
  "piper/it_IT-paola-medium",
  "kokoro/ef_dora",
  "kokoro/em_alex",
  "kokoro/em_santa",
]);

const ENGINE_TO_MODAL_FN: Record<string, string> = {
  piper: "synthesize",
  kokoro: "synthesize-kokoro",
};

const CACHE_VERSION = "v3";

function pickVoice(language: string): string | null {
  return PRACTICE_VOICES[language.toLowerCase()] ?? null;
}

function modalEndpointFor(voiceId: string): string | null {
  const base = process.env.STUDIO_AUDIO_URL;
  if (!base) return null;
  const engine = voiceId.split("/", 1)[0];
  const fn = ENGINE_TO_MODAL_FN[engine];
  if (!fn) return null;
  return base.replace(/-synthesize(?=\.modal\.run\/?$)/, `-${fn}`);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const sentence = typeof body.sentence === "string" ? body.sentence.trim() : "";
  const language = typeof body.language === "string" ? body.language.trim() : "";
  const variant = typeof body.variant === "string" ? body.variant.trim() : "";
  const hintedVoiceId = typeof body.voiceId === "string" ? body.voiceId.trim() : "";
  if (!sentence || !language) {
    return NextResponse.json({ error: "sentence and language required" }, { status: 400 });
  }
  const voiceId = hintedVoiceId && SUPPORTED_VOICES.has(hintedVoiceId)
    ? hintedVoiceId
    : pickVoice(language);

  if (!voiceId) {
    return NextResponse.json({ error: "no voice for language", language });
  }

  const generatedKey = `media/generated/audio/practice-${crypto
    .createHash("sha256")
    .update(`${CACHE_VERSION}|${language}|${variant}|${voiceId}|${sentence}`)
    .digest("hex")
    .slice(0, 24)}.mp3`;
  const generatedPublicUrl = getPublicObjectUrl(generatedKey);

  const cacheHit = generatedPublicUrl
    ? await fetch(generatedPublicUrl, { method: "HEAD" }).then((r) => r.ok).catch(() => false)
    : false;

  const modalUrl = modalEndpointFor(voiceId);
  const modalToken = process.env.STUDIO_AUDIO_TOKEN;

  let modalResp: unknown = null;
  let modalStatus: number | string = "(not called)";
  let modalMs: number | null = null;
  if (!cacheHit && modalUrl && modalToken) {
    const generatedFilename = generatedKey.split("/").pop()!.replace(/\.mp3$/, "");
    const t0 = Date.now();
    try {
      const r = await fetch(modalUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          _token: modalToken,
          text: sentence,
          voiceId,
          filename: generatedFilename,
        }),
      });
      modalStatus = r.status;
      modalMs = Date.now() - t0;
      modalResp = await r.json().catch(async () => ({ text: (await r.text()).slice(0, 300) }));
    } catch (err) {
      modalStatus = "(threw)";
      modalMs = Date.now() - t0;
      modalResp = { error: err instanceof Error ? err.message : String(err) };
    }
  }

  return NextResponse.json({
    voiceDecision: { hintedVoiceId: hintedVoiceId || null, chosenVoiceId: voiceId },
    generatedKey,
    generatedPublicUrl,
    cacheHit,
    modalUrl,
    modalStatus,
    modalMs,
    modalResp,
  });
}
