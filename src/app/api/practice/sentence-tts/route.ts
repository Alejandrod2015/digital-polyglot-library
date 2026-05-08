/**
 * High-quality TTS for a single practice sentence. Replaces the robotic browser
 * speechSynthesis fallback when the user picks the "HQ TTS" button in practice.
 *
 * Cache strategy: hash (language|variant|sentence) and store the resulting MP3
 * at media/practice/tts/<hash>.mp3 in R2. Repeat plays are served straight
 * from R2 without paying ElevenLabs again.
 *
 * Voice selection mirrors the journey audio pipeline so the practice clip
 * sounds like the same speaker the learner just heard reading the story.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import {
  DEFAULT_VOICE_SETTINGS,
  GERMAN_DIALOGUE_VOICES,
  softenPunctuationForTts,
} from "@/lib/elevenlabs";
import { getMobileSessionFromRequest } from "@/lib/mobileSession";
import { getPublicObjectUrl, uploadPublicObject } from "@/lib/objectStorage";

export const maxDuration = 30;

type Body = {
  sentence?: string;
  language?: string;
  variant?: string;
};

function pickVoice(language: string): string {
  const lang = language.toLowerCase();
  // For practice clips we just want a clean single voice per language; pick
  // the narrator from each language's existing journey cast.
  if (lang === "german") return GERMAN_DIALOGUE_VOICES.moritz;
  // TODO: extend with Italian/Spanish/etc. as those journeys add multi-voice.
  // Falls back to Moritz which still produces intelligible multilingual output.
  return GERMAN_DIALOGUE_VOICES.moritz;
}

function cacheKey(args: { sentence: string; language: string; variant: string; voiceId: string }): string {
  const payload = `${args.language}|${args.variant}|${args.voiceId}|${args.sentence}`;
  const hash = crypto.createHash("sha256").update(payload).digest("hex").slice(0, 24);
  return `media/practice/tts/${hash}.mp3`;
}

export async function POST(request: NextRequest) {
  // Aceptamos auth de Clerk (web) o JWT mobile. Antes solo Clerk
  // funcionaba, así que la app mobile (que firma con custom JWT
  // `digital-polyglot-mobile`) recibía 401 silencioso y los botones
  // "HQ" del Practice no producían audio. Patrón espejo del resto de
  // las rutas user-* que también soportan ambos.
  const { userId: clerkUserId } = await auth();
  const mobileSession = getMobileSessionFromRequest(request);
  const userId = clerkUserId ?? mobileSession?.sub ?? null;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Body;
  try { body = (await request.json()) as Body; } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const sentence = typeof body.sentence === "string" ? body.sentence.trim() : "";
  const language = typeof body.language === "string" ? body.language.trim() : "";
  const variant = typeof body.variant === "string" ? body.variant.trim() : "";
  if (!sentence || !language) {
    return NextResponse.json({ error: "sentence and language required" }, { status: 400 });
  }
  if (sentence.length > 500) {
    return NextResponse.json({ error: "sentence too long (max 500 chars)" }, { status: 400 });
  }

  const voiceId = pickVoice(language);
  const key = cacheKey({ sentence, language, variant, voiceId });
  const publicUrl = getPublicObjectUrl(key);
  if (publicUrl) {
    try {
      const head = await fetch(publicUrl, { method: "HEAD" });
      if (head.ok) return NextResponse.json({ url: publicUrl, cached: true });
    } catch {
      // Fall through to fresh generation if HEAD fails.
    }
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ElevenLabs not configured" }, { status: 500 });
  }

  const ttsResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      text: softenPunctuationForTts(sentence),
      model_id: "eleven_multilingual_v2",
      voice_settings: DEFAULT_VOICE_SETTINGS,
    }),
  });
  if (!ttsResponse.ok) {
    const errText = await ttsResponse.text().catch(() => "");
    return NextResponse.json(
      { error: "TTS failed", details: errText.slice(0, 200) },
      { status: 502 }
    );
  }
  const buffer = Buffer.from(await ttsResponse.arrayBuffer());

  const uploaded = await uploadPublicObject({
    key,
    body: buffer,
    contentType: "audio/mpeg",
  });
  if (!uploaded?.url) {
    return NextResponse.json({ error: "Upload failed" }, { status: 502 });
  }
  return NextResponse.json({ url: uploaded.url, cached: false });
}
