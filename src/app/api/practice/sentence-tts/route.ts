/**
 * High-quality TTS for a single practice sentence — ElevenLabs ONLY.
 *
 * POLICY (2026-07-24, user directive): NOTHING in the app may sound unless it
 * is ElevenLabs. The previous Modal/Piper/Kokoro path (local engines for
 * es/pt/it) was REMOVED. A sentence renders only if the language has an
 * approved ElevenLabs voice (`src/lib/approvedVoices.ts`); otherwise the route
 * returns 404 and the client stays silent (no fallback engine, by design).
 *
 * Language coverage today (approved EL voices only):
 *   - es → Hernando (CO) unless the caller supplies an approved EL voice
 *   - it → Violetta
 *   - de → Expat/Friends DE narrator
 *   - pt / fr → NO approved voice → 404 (silent) until the user approves one
 *
 * The MP3 is cached in R2 keyed by (version|language|variant|voice|sentence),
 * so each unique tuple costs exactly one ElevenLabs call ever.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getMobileSessionFromRequest } from "@/lib/mobileSession";
import { getPublicObjectUrl, uploadPublicObject } from "@/lib/objectStorage";
import { DEFAULT_VOICE_SETTINGS, softenPunctuationForTts } from "@/lib/elevenlabs";
import { assertVoiceApproved, isVoiceApproved } from "@/lib/approvedVoices";

export const maxDuration = 120;

type Body = {
  sentence?: string;
  language?: string;
  variant?: string;
  /** Hint: the voice the source story was narrated with. Honoured only if it
   *  is an approved ElevenLabs voice; otherwise the language default is used. */
  voiceId?: string;
};

const ELEVEN_SENTENCE_MODEL = "eleven_multilingual_v2";

// Default per-language ElevenLabs voice for practice sentences. Every id here
// MUST be on the approved allowlist (assertVoiceApproved enforces it at render).
// Languages absent from this map (pt, fr, …) have no approved voice → the route
// returns 404 and the sentence stays silent, per the ElevenLabs-only policy.
const ELEVEN_SENTENCE_VOICE: Record<string, string> = {
  spanish: "yHD4CsKkghm19ToGLJEC", // Narrator CO - Hernando (approved)
  italian: "gfKKsLN1k0oYYN9n2dXX", // Violetta IT (approved)
  german: "Ww7Sq9tx9CCOiNOwWgsx", // Expat/Friends DE narrator (approved)
};

// Bumping CACHE_VERSION invalidates every previously cached R2 path without
// deleting the bucket. v8: the ElevenLabs-only cutover — es/it clips that were
// previously served by Modal/Piper under v7 are unreachable under v8, so a play
// re-renders them with the approved EL voice.
const CACHE_VERSION = "v8";

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args);
    let stderr = "";
    proc.stderr.on("data", (c) => { stderr += c.toString(); });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(0, 300)}`));
    });
  });
}

// Render a sentence with ElevenLabs. Cache in R2 by (version|language|variant|
// voice|sentence). Returns the same {url} shape the client already expects.
async function renderSentenceWithElevenLabs(
  sentence: string,
  language: string,
  variant: string,
  voiceId: string
): Promise<NextResponse> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ELEVENLABS_API_KEY missing" }, { status: 500 });
  }
  assertVoiceApproved(voiceId, `sentence-tts:${language}`);
  const key = `media/practice/tts/el-${crypto
    .createHash("sha256")
    .update(`${CACHE_VERSION}|el|${language}|${variant}|${voiceId}|${sentence}`)
    .digest("hex")
    .slice(0, 24)}.mp3`;
  const cachedUrl = getPublicObjectUrl(key);
  if (cachedUrl) {
    try {
      const head = await fetch(cachedUrl, { method: "HEAD" });
      if (head.ok) return NextResponse.json({ url: cachedUrl, cached: true, voiceId });
    } catch {
      // Fall through to generation.
    }
  }
  let raw: Buffer;
  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        text: softenPunctuationForTts(sentence),
        model_id: ELEVEN_SENTENCE_MODEL,
        voice_settings: DEFAULT_VOICE_SETTINGS,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `ElevenLabs ${res.status}: ${detail.slice(0, 200)}` },
        { status: 502 }
      );
    }
    raw = Buffer.from(await res.arrayBuffer());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "eleven sentence failed" },
      { status: 502 }
    );
  }
  // Loudness normalisation + trailing-silence pad so the last phoneme decays
  // naturally. If ffmpeg fails, upload the raw mp3.
  const workDir = mkdtempSync(join(tmpdir(), "el-sent-"));
  const inPath = join(workDir, "in.mp3");
  const outPath = join(workDir, "out.mp3");
  try {
    writeFileSync(inPath, raw);
    await runFfmpeg([
      "-y", "-loglevel", "error", "-i", inPath,
      "-af", "loudnorm=I=-16:LRA=11:TP=-1.5,apad=pad_dur=0.15",
      "-codec:a", "libmp3lame", "-b:a", "128k", outPath,
    ]);
    const uploaded = await uploadPublicObject({ key, body: readFileSync(outPath), contentType: "audio/mpeg" });
    if (uploaded?.url) return NextResponse.json({ url: uploaded.url, cached: false, voiceId });
    return NextResponse.json({ error: "R2 upload failed" }, { status: 500 });
  } catch {
    const uploaded = await uploadPublicObject({ key, body: raw, contentType: "audio/mpeg" });
    if (uploaded?.url) return NextResponse.json({ url: uploaded.url, cached: false, voiceId });
    return NextResponse.json({ error: "R2 upload failed" }, { status: 500 });
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

export async function POST(request: NextRequest) {
  const { userId: clerkUserId } = await auth();
  const mobileSession = getMobileSessionFromRequest(request);
  const userId = clerkUserId ?? mobileSession?.sub ?? null;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const sentence = typeof body.sentence === "string" ? body.sentence.trim() : "";
  const language = typeof body.language === "string" ? body.language.trim() : "";
  const variant = typeof body.variant === "string" ? body.variant.trim() : "";
  const hintedVoiceId = typeof body.voiceId === "string" ? body.voiceId.trim() : "";
  if (!sentence || !language) {
    return NextResponse.json({ error: "sentence and language required" }, { status: 400 });
  }
  if (sentence.length > 500) {
    return NextResponse.json({ error: "sentence too long (max 500 chars)" }, { status: 400 });
  }

  // ElevenLabs-only voice resolution: prefer the story's own voice when it is an
  // APPROVED ElevenLabs voice; otherwise the approved language default. A Piper/
  // Kokoro hint (contains "/") is never approved → ignored. Languages with no
  // approved voice (pt/fr) get no audio (404), by policy.
  const voiceId = isVoiceApproved(hintedVoiceId)
    ? hintedVoiceId
    : ELEVEN_SENTENCE_VOICE[language.toLowerCase()] ?? null;
  if (!voiceId) {
    return NextResponse.json(
      { error: "No approved ElevenLabs voice for this language", code: "UNSUPPORTED_LANGUAGE" },
      { status: 404 }
    );
  }

  return await renderSentenceWithElevenLabs(sentence, language, variant, voiceId);
}
