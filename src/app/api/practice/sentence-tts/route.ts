/**
 * High-quality TTS for a single practice sentence. Generates with our
 * licence-clean local engines on Modal (Kokoro for Spanish, Piper for
 * Portuguese/Italian) and caches the MP3 in R2 so repeat plays are free.
 *
 * Voice selection (all Piper, all Apache-2.0 / CC0):
 *   - spanish    → piper/es_ES-sharvard-medium (Apache-2.0, ES M)
 *   - portuguese → piper/pt_BR-cadu-medium     (CC0, BR M)
 *   - italian    → piper/it_IT-paola-medium    (CC0, IT F)
 *
 * Kokoro and Bark were considered (for ES warmth and DE coverage
 * respectively) but neither image built cleanly inside Modal: Kokoro
 * stalled on the GitHub Releases asset download from the container,
 * Bark dragged ~6 GB of torch+transformers and blocked the whole app
 * deploy. We ship Piper-only for now; DE returns 404 and falls back to
 * expo-speech on the client.
 *
 * The endpoint is engine-agnostic at the wire level: every voice goes to
 * Modal's `polyglot-audio-studio` app on a different fastapi_endpoint
 * (`synthesize` for Piper, `synthesize_kokoro` for Kokoro). The URLs are
 * derived from `STUDIO_AUDIO_URL` by swapping the trailing path segment,
 * which is the same convention used for `align`.
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

// Bark cold-starts on GPU can take ~30-60 s; the rest of the engines
// respond in 5-10 s. Set the route's max duration high enough to cover
// the worst case. Hobby Vercel plans are capped at 60 s and will simply
// time out a Bark cold start — the mobile client falls back to
// expo-speech on timeout, so the cap is not catastrophic but does mean
// the first DE clip after a long idle period will sound robotic.
export const maxDuration = 300;

type Body = {
  sentence?: string;
  language?: string;
  variant?: string;
  /** Hint: voice the source story was narrated with. Honoured only
   *  if it's a Piper voice the Modal app knows how to synthesize. */
  voiceId?: string;
};

// Voices the Modal Piper endpoint accepts. Kept in sync with
// PIPER_VOICES in modal_app/audio_studio.py.
const SUPPORTED_PIPER_VOICES = new Set<string>([
  "piper/es_ES-sharvard-medium",
  "piper/es_MX-claude-high",
  "piper/pt_BR-cadu-medium",
  "piper/it_IT-paola-medium",
  "kokoro/ef_dora",
  "kokoro/em_alex",
  "kokoro/em_santa",
]);

// Default per-language voice for practice clips. These are the engines
// the user explicitly approved as licence-clean for production. Keep
// the strings in sync with PRACTICE_VOICE_TO_MODAL_PATH below and with
// modal_app/audio_studio.py's PIPER_VOICES / KOKORO_VOICES maps.
const PRACTICE_VOICES: Record<string, string> = {
  spanish: "kokoro/ef_dora",
  portuguese: "piper/pt_BR-cadu-medium",
  italian: "piper/it_IT-paola-medium",
};

// Engine prefix → Modal endpoint subdomain segment. Modal renders the
// function name `synthesize_kokoro` as `synthesize-kokoro` in the public
// URL (underscores become dashes); the key here MUST be the URL form,
// not the Python identifier, or the request 404s.
const ENGINE_TO_MODAL_FN: Record<string, string> = {
  piper: "synthesize",
  kokoro: "synthesize-kokoro",
};

function pickVoice(language: string): string | null {
  return PRACTICE_VOICES[language.toLowerCase()] ?? null;
}

function modalEndpointFor(voiceId: string): string | null {
  const base = process.env.STUDIO_AUDIO_URL;
  if (!base) return null;
  const engine = voiceId.split("/", 1)[0];
  const fn = ENGINE_TO_MODAL_FN[engine];
  if (!fn) return null;
  // STUDIO_AUDIO_URL points at `…-synthesize.modal.run`. Swap the trailing
  // function name. Same idea as STUDIO_AUDIO_ALIGN_URL derivation.
  return base.replace(/-synthesize(?=\.modal\.run\/?$)/, `-${fn}`);
}

// Bumping CACHE_VERSION invalidates every previously cached R2 path
// without needing to delete the bucket. Use whenever the rendering
// engine changes in a way that should force a regeneration (e.g. we
// swap a default voice — old voices still cached under v1 are now
// unreachable because every lookup goes through v2's hashes).
// v4: append 150 ms trailing silence to every Modal-rendered mp3 so the
// last fonema decays naturally instead of cutting on the final sample.
// Piper does not insert tail silence when the input ends with `.` or
// `!`/`?` — the audio terminates abruptly at audible volume and the ear
// reads it as "iba a decir una letra más". Padding kills that artifact.
// v5: also slow tempo to 0.80 (matches narration default per
// project_audio_defaults memory). Piper Paola defaults are too fast for
// A1 learners practicing words; the 20% slowdown is barely perceptible
// in quality (atempo WSOLA stays in [0.5,2]) but materially improves
// comprehension of individual word boundaries.
// v7: drop the server-side atempo entirely. The mobile client already
// passes `rate: 0.65/0.75` to expo-av at playback time and expo-av
// applies AVPlayer's pitch-corrected WSOLA — much higher quality than
// our ffmpeg pass. Both layers compounded (0.80 × 0.65 = 0.52) was
// stretching vowels into a "possessed voice" timbre on isolated words
// and short expressions. The server now stores native-rate audio; the
// client owns the listening tempo. Trailing silence (apad) stays so
// the last phoneme decays naturally.
const CACHE_VERSION = "v7";
const PRACTICE_TEMPO = 1.0; // No server-side slowdown — client controls rate.

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

async function postProcessPracticeAudio(
  sourceUrl: string,
  padSec: number,
  tempo: number
): Promise<Buffer> {
  const workDir = mkdtempSync(join(tmpdir(), "tts-pp-"));
  const inPath = join(workDir, "in.mp3");
  const outPath = join(workDir, "out.mp3");
  try {
    const r = await fetch(sourceUrl);
    if (!r.ok) throw new Error(`download ${r.status}`);
    writeFileSync(inPath, Buffer.from(await r.arrayBuffer()));
    // Filter chain: slow first, then pad. apad on a slowed-down clip
    // gives the same audible silence regardless of tempo. atempo stays
    // in [0.5, 2] which is the WSOLA-safe range (no pitch shift, no
    // audible artifacts on speech).
    const filters = [`atempo=${tempo}`, `apad=pad_dur=${padSec}`].join(",");
    await runFfmpeg([
      "-y", "-loglevel", "error",
      "-i", inPath,
      "-af", filters,
      "-codec:a", "libmp3lame", "-b:a", "128k",
      outPath,
    ]);
    return readFileSync(outPath);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

function cacheKey(args: { sentence: string; language: string; variant: string; voiceId: string }): string {
  const payload = `${CACHE_VERSION}|${args.language}|${args.variant}|${args.voiceId}|${args.sentence}`;
  const hash = crypto.createHash("sha256").update(payload).digest("hex").slice(0, 24);
  return `media/practice/tts/${hash}.mp3`;
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

  // Prefer the story's actual narration voice when the client supplies
  // one AND the Modal Piper endpoint can render it. Otherwise fall back
  // to the language default. This keeps practice audio consistent with
  // the reader for Studio-generated journeys; catalog stories (no
  // voiceId in DB) just get the default voice.
  const voiceId = hintedVoiceId && SUPPORTED_PIPER_VOICES.has(hintedVoiceId)
    ? hintedVoiceId
    : pickVoice(language);
  if (!voiceId) {
    return NextResponse.json(
      { error: "No licence-clean voice for this language", code: "UNSUPPORTED_LANGUAGE" },
      { status: 404 }
    );
  }

  const key = cacheKey({ sentence, language, variant, voiceId });
  const publicUrl = getPublicObjectUrl(key);
  if (publicUrl) {
    try {
      const head = await fetch(publicUrl, { method: "HEAD" });
      if (head.ok) return NextResponse.json({ url: publicUrl, cached: true });
    } catch {
      // Fall through to the generation path.
    }
  }

  const modalUrl = modalEndpointFor(voiceId);
  const modalToken = process.env.STUDIO_AUDIO_TOKEN;
  if (!modalUrl || !modalToken) {
    return NextResponse.json(
      { error: "Studio audio not configured", code: "MODAL_NOT_CONFIGURED" },
      { status: 503 }
    );
  }

  // Filename: derived from the cache key so the upload from Modal lands
  // on the exact R2 path our `getPublicObjectUrl(key)` HEAD just probed.
  // The Modal endpoint stores under `media/generated/audio/<filename>`
  // but here we want `media/practice/tts/<hash>.mp3`; we override the
  // path on our side by re-uploading from the Modal response if the
  // hosted location differs. Simpler: rely on cacheKey-as-filename and
  // accept that practice clips live alongside generated story audio.
  // To keep things deterministic and skip the re-upload, we let the
  // Modal app place the file at `media/generated/audio/<hash>.mp3` and
  // record that URL — the cache HEAD on the next request still hits
  // because we re-derive the URL via getPublicObjectUrl(generatedKey).
  const generatedKey = `media/generated/audio/practice-${crypto
    .createHash("sha256")
    .update(`${CACHE_VERSION}|${language}|${variant}|${voiceId}|${sentence}`)
    .digest("hex")
    .slice(0, 24)}.mp3`;
  const generatedFilename = generatedKey.split("/").pop()!.replace(/\.mp3$/, "");

  const generatedPublicUrl = getPublicObjectUrl(generatedKey);
  if (generatedPublicUrl) {
    try {
      const head = await fetch(generatedPublicUrl, { method: "HEAD" });
      if (head.ok) return NextResponse.json({ url: generatedPublicUrl, cached: true });
    } catch {
      // Fall through to generation.
    }
  }

  let modalResp: { url: string; filename: string; bytes: number };
  try {
    const res = await fetch(modalUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        _token: modalToken,
        text: sentence,
        voiceId,
        filename: generatedFilename,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return NextResponse.json(
        { error: "Modal TTS failed", status: res.status, details: detail.slice(0, 300) },
        { status: 502 }
      );
    }
    modalResp = (await res.json()) as { url: string; filename: string; bytes: number };
  } catch (err) {
    return NextResponse.json(
      { error: "Modal TTS error", details: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }

  // Post-process: slow to PRACTICE_TEMPO + append trailing silence so
  // the audio ends with a natural decay instead of cutting on the last
  // sample. See CACHE_VERSION header for rationale. If ffmpeg fails, fall
  // back to the raw mp3 — a tail-clipped, native-tempo clip is still
  // better than no audio at all.
  try {
    const processed = await postProcessPracticeAudio(modalResp.url, 0.15, PRACTICE_TEMPO);
    const uploaded = await uploadPublicObject({
      key: generatedKey,
      body: processed,
      contentType: "audio/mpeg",
    });
    if (uploaded?.url) {
      return NextResponse.json({ url: uploaded.url, cached: false, voiceId });
    }
  } catch (err) {
    console.warn(
      `[practice/sentence-tts] post-process failed, returning raw: ${err instanceof Error ? err.message : err}`
    );
  }
  return NextResponse.json({ url: modalResp.url, cached: false, voiceId });
}
