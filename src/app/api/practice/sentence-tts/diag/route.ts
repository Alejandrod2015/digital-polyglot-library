/**
 * TEMPORARY diagnostic endpoint to verify the practice TTS routing
 * decisions in production without needing a mobile JWT. Mirrors the
 * voice-picking logic of the real `/api/practice/sentence-tts` route
 * but returns the chosen voiceId + R2 paths instead of generating
 * audio. Remove once the practice audio voice issue is closed.
 */

import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { getPublicObjectUrl } from "@/lib/objectStorage";

const PRACTICE_VOICES: Record<string, string> = {
  spanish: "piper/es_MX-claude-high",
  portuguese: "piper/pt_BR-cadu-medium",
  italian: "piper/it_IT-paola-medium",
};

const SUPPORTED_PIPER_VOICES = new Set<string>([
  "piper/es_ES-sharvard-medium",
  "piper/es_MX-claude-high",
  "piper/pt_BR-cadu-medium",
  "piper/it_IT-paola-medium",
]);

function pickVoice(language: string): string | null {
  return PRACTICE_VOICES[language.toLowerCase()] ?? null;
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
  const voiceId = hintedVoiceId && SUPPORTED_PIPER_VOICES.has(hintedVoiceId)
    ? hintedVoiceId
    : pickVoice(language);

  const CACHE_VERSION = "v2";
  const cacheKey = (() => {
    const payload = `${CACHE_VERSION}|${language}|${variant}|${voiceId}|${sentence}`;
    const hash = crypto.createHash("sha256").update(payload).digest("hex").slice(0, 24);
    return `media/practice/tts/${hash}.mp3`;
  })();
  const generatedKey = `media/generated/audio/practice-${crypto
    .createHash("sha256")
    .update(`${CACHE_VERSION}|${language}|${variant}|${voiceId}|${sentence}`)
    .digest("hex")
    .slice(0, 24)}.mp3`;

  return NextResponse.json({
    decision: {
      hintedVoiceId: hintedVoiceId || null,
      hintedRespected: hintedVoiceId && SUPPORTED_PIPER_VOICES.has(hintedVoiceId),
      defaultForLanguage: pickVoice(language),
      chosenVoiceId: voiceId,
    },
    cacheKey,
    generatedKey,
    cacheKeyUrl: getPublicObjectUrl(cacheKey),
    generatedKeyUrl: getPublicObjectUrl(generatedKey),
    supported: Array.from(SUPPORTED_PIPER_VOICES),
    practiceVoices: PRACTICE_VOICES,
  });
}
