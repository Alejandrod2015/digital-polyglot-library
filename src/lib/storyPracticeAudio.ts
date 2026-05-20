/**
 * Pre-render the practice-clip mp3 for a StoryPracticeExercise.
 *
 * Same pipeline the mobile end-of-story flow falls back to when the
 * exercise has no `audioUrl` on disk: hit Modal (Piper) with the
 * exercise's sentence + the story's voiceId (defaults to a Piper voice
 * for the language when the story is a legacy row without one), then
 * append 150 ms of trailing silence so the last fonema decays naturally
 * instead of cutting on the final sample. Cached in R2 under a hash
 * key so repeat generations re-use the same URL.
 */
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { uploadPublicObject, getPublicObjectUrl } from "@/lib/objectStorage";

const CACHE_VERSION = "v4";

const SUPPORTED_PIPER_VOICES = new Set<string>([
  "piper/es_ES-sharvard-medium",
  "piper/pt_BR-cadu-medium",
  "piper/it_IT-paola-medium",
  "kokoro/ef_dora",
  "kokoro/em_alex",
]);

const DEFAULT_VOICE_BY_LANGUAGE: Record<string, string> = {
  spanish: "piper/es_ES-sharvard-medium",
  italian: "piper/it_IT-paola-medium",
  portuguese: "piper/pt_BR-cadu-medium",
  english: "kokoro/em_alex",
};

const ENGINE_TO_MODAL_FN: Record<string, string> = {
  piper: "synthesize",
  kokoro: "synthesize-kokoro",
};

function modalEndpointFor(voiceId: string): string | null {
  const base = process.env.STUDIO_AUDIO_URL;
  if (!base) return null;
  const engine = voiceId.split("/", 1)[0];
  const fn = ENGINE_TO_MODAL_FN[engine];
  if (!fn) return null;
  return base.replace(/-synthesize(?=\.modal\.run\/?$)/, `-${fn}`);
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn("ffmpeg", args);
    let err = "";
    p.stderr.on("data", (c) => { err += c.toString(); });
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}: ${err.slice(0, 200)}`))));
  });
}

async function appendTrailingSilence(sourceUrl: string, padSec: number): Promise<Buffer> {
  const work = mkdtempSync(join(tmpdir(), "ex-audio-"));
  const inp = join(work, "in.mp3");
  const out = join(work, "out.mp3");
  try {
    const r = await fetch(sourceUrl);
    if (!r.ok) throw new Error(`download ${r.status}`);
    writeFileSync(inp, Buffer.from(await r.arrayBuffer()));
    await runFfmpeg([
      "-y", "-loglevel", "error",
      "-i", inp,
      "-af", `apad=pad_dur=${padSec}`,
      "-codec:a", "libmp3lame", "-b:a", "128k",
      out,
    ]);
    return readFileSync(out);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

export type GenerateExerciseAudioArgs = {
  sentence: string;
  language: string;
  voiceId?: string | null;
  variant?: string;
  /** When true, skip the R2 cache lookup AND mix a per-call nonce into
   *  the cache key so the resulting URL is always fresh. Use this from
   *  the "Regenerate audio" button in Studio so the editor's <audio>
   *  tag actually swaps to a new file (a `src` that stays the same
   *  string makes the browser keep the old buffer). */
  force?: boolean;
};

/**
 * Render `sentence` with the story's voice (or the language default
 * when none is set), pad with 150ms of silence, upload to R2, return
 * the public URL. Returns null when Modal is not configured or the
 * sentence is empty.
 */
export async function generateExerciseAudio(args: GenerateExerciseAudioArgs): Promise<string | null> {
  const sentence = args.sentence.trim();
  if (!sentence) return null;

  const language = args.language.trim().toLowerCase();
  const hinted = (args.voiceId ?? "").trim();
  const voiceId =
    hinted && SUPPORTED_PIPER_VOICES.has(hinted)
      ? hinted
      : DEFAULT_VOICE_BY_LANGUAGE[language] ?? null;
  if (!voiceId) return null;

  const modalUrl = modalEndpointFor(voiceId);
  const token = process.env.STUDIO_AUDIO_TOKEN;
  if (!modalUrl || !token) return null;

  const variant = args.variant ?? "";
  const nonce = args.force ? `|n${Date.now()}` : "";
  const key = `media/generated/audio/practice-${crypto
    .createHash("sha256")
    .update(`${CACHE_VERSION}|${language}|${variant}|${voiceId}|${sentence}${nonce}`)
    .digest("hex")
    .slice(0, 24)}.mp3`;

  // Skip cache when forced — editor wants a fresh take regardless of
  // whether the text changed.
  if (!args.force) {
    const cachedUrl = getPublicObjectUrl(key);
    if (cachedUrl) {
      try {
        const head = await fetch(cachedUrl, { method: "HEAD" });
        if (head.ok) return cachedUrl;
      } catch { /* fall through to regen */ }
    }
  }

  const filename = key.split("/").pop()!.replace(/\.mp3$/, "");
  let modalResp: { url: string };
  try {
    const res = await fetch(modalUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ _token: token, text: sentence, voiceId, filename }),
    });
    if (!res.ok) throw new Error(`modal ${res.status}`);
    modalResp = (await res.json()) as { url: string };
  } catch (err) {
    console.warn(
      `[storyPracticeAudio] modal synth failed for "${sentence.slice(0, 30)}": ${err instanceof Error ? err.message : err}`
    );
    return null;
  }

  // Post-process: pad with 150 ms silence and re-upload at the
  // cache-key location. If padding fails, fall back to the raw mp3.
  try {
    const padded = await appendTrailingSilence(modalResp.url, 0.15);
    const uploaded = await uploadPublicObject({
      key,
      body: padded,
      contentType: "audio/mpeg",
    });
    if (uploaded?.url) return uploaded.url;
  } catch (err) {
    console.warn(
      `[storyPracticeAudio] padding failed, using raw mp3: ${err instanceof Error ? err.message : err}`
    );
  }
  return modalResp.url;
}
