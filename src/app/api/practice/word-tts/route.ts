/**
 * High-quality TTS for a SINGLE practice word, rendered with ElevenLabs in
 * the SAME voice the story line was narrated with, so the isolated-word play
 * button in a meaning exercise matches the example-sentence audio (which plays
 * the authentic story fragment). Unlike the sentence-tts endpoint (Modal
 * Piper/Kokoro, licence-clean, language-default voice), this one honours the
 * exact ElevenLabs voiceId of the speaker, which is the whole point: hearing
 * "casi" in Renata's voice right after hearing her line.
 *
 * The MP3 is cached in R2 keyed by (voiceId, word), so each unique pair costs
 * exactly one ElevenLabs call ever; repeat plays are free.
 */
import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getMobileSessionFromRequest } from "@/lib/mobileSession";
import { DEFAULT_VOICE_SETTINGS, softenPunctuationForTts } from "@/lib/elevenlabs";
import { getPublicObjectUrl, uploadPublicObject } from "@/lib/objectStorage";

export const maxDuration = 120;

// v2: switch from eleven_multilingual_v2 (auto-detect language, which renders
// lone words in the wrong language — Brazilian Portuguese accent on "fácil",
// "casi") to eleven_turbo_v2_5 with language_code forced to Spanish. The forced
// language kills the wrong-accent problem entirely. Bumping the version
// invalidates the v1 (mis-accented) clips.
const CACHE_VERSION = "v3"; // v3: dropped dynaudnorm (start-volume ramp)
const WORD_MODEL = "eleven_turbo_v2_5";
// 2026-07-07: idioma parametrizado (antes hardcodeado a "es", lo que habría
// pronunciado las palabras alemanas/francesas con fonética española). El
// caller manda el language del ejercicio; default "es" mantiene el
// comportamiento y las cache keys existentes de LATAM intactas.
const WORD_LANGUAGE_CODES: Record<string, string> = {
  spanish: "es", german: "de", french: "fr", italian: "it", portuguese: "pt", english: "en",
};
const DEFAULT_WORD_LANGUAGE = "es";

// El cliente (mobile + web) manda una voz FALLBACK fija cuando la palabra
// guardada no trae voz propia: "Narrator CO - Hernando" (español colombiano).
// Para palabras de OTRO idioma eso es incorrecto (voz española diciendo alemán)
// y en la práctica ni sonaba. Cuando llega ESA voz genérica y el idioma tiene
// una voz aprobada propia, la sustituimos por la del idioma. Las voces con voz
// propia (ejercicios) no se tocan. (2026-07-23)
const CLIENT_FALLBACK_VOICE = "yHD4CsKkghm19ToGLJEC";
const WORD_LANGUAGE_DEFAULT_VOICE: Record<string, string> = {
  de: "Ww7Sq9tx9CCOiNOwWgsx", // narrador Expat/Friends DE (aprobado)
  it: "gfKKsLN1k0oYYN9n2dXX", // Violetta IT (aprobado)
  // es se queda con Hernando/otras; fr/pt no tienen voz aprobada aún.
};

type Body = {
  word?: string;
  voiceId?: string;
  language?: string;
};

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args);
    let stderr = "";
    proc.stderr.on("data", (c) => {
      stderr += c.toString();
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exit ${code}: ${stderr.slice(0, 300)}`));
    });
  });
}

// Light loudness normalisation + a short tail pad so the last phoneme decays
// naturally instead of cutting on the final sample. No tempo change: the
// client owns playback rate.
async function normalizeWord(rawMp3: Buffer): Promise<Buffer> {
  const workDir = mkdtempSync(join(tmpdir(), "word-tts-"));
  const inPath = join(workDir, "in.mp3");
  const outPath = join(workDir, "out.mp3");
  try {
    writeFileSync(inPath, rawMp3);
    await runFfmpeg([
      "-y",
      "-loglevel",
      "error",
      "-i",
      inPath,
      "-af",
      // No dynaudnorm: its ~1s adaptive window ramped the volume up over the
      // clip start (audible "quiet then normal"). Plain loudnorm is constant.
      "loudnorm=I=-16:LRA=11:TP=-1.5,apad=pad_dur=0.15",
      "-codec:a",
      "libmp3lame",
      "-b:a",
      "128k",
      outPath,
    ]);
    return readFileSync(outPath);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

function cacheKey(voiceId: string, word: string, langCode: string): string {
  // Las keys legacy (es) no llevan sufijo para no invalidar los clips LATAM
  // ya pagados; los demás idiomas llevan su código.
  const langSuffix = langCode === "es" ? "" : `|${langCode}`;
  const payload = `${CACHE_VERSION}|${voiceId}|${word.toLowerCase()}${langSuffix}`;
  const hash = crypto.createHash("sha256").update(payload).digest("hex").slice(0, 24);
  return `media/practice/word-tts/${hash}.mp3`;
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

  const word = typeof body.word === "string" ? body.word.trim() : "";
  const rawVoiceId = typeof body.voiceId === "string" ? body.voiceId.trim() : "";
  if (!word || !rawVoiceId) {
    return NextResponse.json({ error: "word and voiceId required" }, { status: 400 });
  }
  if (word.length > 60) {
    return NextResponse.json({ error: "word too long (max 60 chars)" }, { status: 400 });
  }

  // The fragment stores the voice as a raw ElevenLabs id or with an
  // `elevenlabs/` prefix; this endpoint only renders ElevenLabs voices.
  const elVoiceId = rawVoiceId.startsWith("elevenlabs/")
    ? rawVoiceId.slice("elevenlabs/".length).trim()
    : rawVoiceId;
  if (!elVoiceId || elVoiceId.includes("/")) {
    return NextResponse.json(
      { error: "voiceId is not an ElevenLabs voice", code: "UNSUPPORTED_VOICE" },
      { status: 400 }
    );
  }

  const langCode = WORD_LANGUAGE_CODES[(body.language ?? "").toLowerCase()] ?? DEFAULT_WORD_LANGUAGE;

  // Si llega la voz fallback genérica (español CO) para una palabra de otro
  // idioma con voz aprobada propia, usar la del idioma. Evita "voz española
  // diciendo alemán" y el silencio que producía en la práctica.
  const renderVoiceId =
    elVoiceId === CLIENT_FALLBACK_VOICE && WORD_LANGUAGE_DEFAULT_VOICE[langCode]
      ? WORD_LANGUAGE_DEFAULT_VOICE[langCode]
      : elVoiceId;

  const key = cacheKey(renderVoiceId, word, langCode);
  const publicUrl = getPublicObjectUrl(key);
  if (publicUrl) {
    try {
      const head = await fetch(publicUrl, { method: "HEAD" });
      if (head.ok) return NextResponse.json({ url: publicUrl, cached: true });
    } catch {
      // Fall through to generation.
    }
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ELEVENLABS_API_KEY missing" }, { status: 500 });
  }

  try {
    const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${renderVoiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: softenPunctuationForTts(word),
        model_id: WORD_MODEL,
        language_code: langCode,
        voice_settings: DEFAULT_VOICE_SETTINGS,
        // next_text=" " suppresses the trailing breath/exhale ElevenLabs adds
        // when a clip ends, same boundary trick the master pipeline uses.
        next_text: " ",
      }),
    });
    if (!ttsRes.ok) {
      const detail = await ttsRes.text().catch(() => "");
      return NextResponse.json(
        { error: `ElevenLabs ${ttsRes.status}: ${detail.slice(0, 200)}` },
        { status: 502 }
      );
    }
    const normalized = await normalizeWord(Buffer.from(await ttsRes.arrayBuffer()));
    const uploaded = await uploadPublicObject({
      key,
      body: normalized,
      contentType: "audio/mpeg",
    });
    if (!uploaded?.url) {
      return NextResponse.json({ error: "R2 upload failed" }, { status: 500 });
    }
    return NextResponse.json({ url: uploaded.url, cached: false });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "word-tts failed" },
      { status: 500 }
    );
  }
}
