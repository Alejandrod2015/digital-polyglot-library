// Detect & correct aeneas drift caused by long pauses between title
// and body that aeneas underweights when distributing tokens linearly.
//
// Symptom: aeneas marks the first body token several hundred ms BEFORE
// the narrator actually starts the body. Every subsequent timestamp
// inherits that bias, so the karaoke cursor runs ahead of the voice
// for the entire story.
//
// Heuristic: find the first long silence in the audio (using
// ffmpeg silencedetect) that ends roughly where the title narration
// finishes. If aeneas placed the first body token BEFORE that
// silence ends, shift all tokens forward by the gap. Only applies
// when the drift is meaningful (>= 0.25 s) to avoid touching stories
// that aeneas already aligned correctly.
//
// Server-only module: uses child_process / ffmpeg. Do NOT import from
// the mobile bundle. The mobile reader consumes the corrected payload
// via the catalog endpoint; it never runs ffmpeg itself.

import { spawn } from "child_process";
import type { StoryWordToken } from "./audioWordTimings";

type SilenceSpan = { start: number; end: number; duration: number };

/**
 * Run ffmpeg silencedetect on the given audio URL (or local path) and
 * return every detected silence span. The filter logs to stderr, so
 * we collect stderr and parse the `silence_start` / `silence_end`
 * pairs.
 */
async function detectSilences(
  audioUrl: string,
  options: { thresholdDb?: number; minDurationSec?: number } = {}
): Promise<SilenceSpan[]> {
  const thresholdDb = options.thresholdDb ?? -35;
  const minDurationSec = options.minDurationSec ?? 0.3;

  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", [
      "-hide_banner",
      "-nostats",
      "-i",
      audioUrl,
      "-af",
      `silencedetect=noise=${thresholdDb}dB:duration=${minDurationSec}`,
      "-f",
      "null",
      "-",
    ]);

    let stderr = "";
    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf-8");
    });

    proc.on("error", (err) => reject(err));
    proc.on("close", (code) => {
      if (code !== 0 && code !== null) {
        reject(new Error(`ffmpeg exited with code ${code}`));
        return;
      }
      const spans: SilenceSpan[] = [];
      const startRe = /silence_start:\s*([\d.]+)/g;
      const endRe = /silence_end:\s*([\d.]+)\s*\|\s*silence_duration:\s*([\d.]+)/g;
      const starts: number[] = [];
      let m: RegExpExecArray | null;
      while ((m = startRe.exec(stderr)) !== null) {
        starts.push(parseFloat(m[1]));
      }
      let i = 0;
      while ((m = endRe.exec(stderr)) !== null) {
        const end = parseFloat(m[1]);
        const duration = parseFloat(m[2]);
        const start = starts[i] ?? end - duration;
        spans.push({ start, end, duration });
        i += 1;
      }
      resolve(spans);
    });
  });
}

/**
 * Apply drift correction to a token array given the audio URL. Returns
 * an object with the corrected tokens and the offset that was applied
 * (positive when aeneas was ahead of the voice). When no correction
 * was needed, `offsetApplied` is 0 and the tokens are returned
 * untouched.
 *
 * Strategy:
 *   1. Find the first body token startSec.
 *   2. Find the first silence span in the audio whose `end` is within
 *      [firstToken.startSec - 3s, firstToken.startSec + 6s]. That
 *      window covers the title-to-body transition for any realistic
 *      title length (1-10 s).
 *   3. If the silence ends AFTER the first token's startSec by at
 *      least 0.25 s, shift every token by (silence.end - firstToken).
 */
export async function correctAlignmentDrift(args: {
  audioUrl: string;
  tokens: StoryWordToken[];
  // Minimum drift (in seconds) before we apply a correction. Below
  // this threshold the alignment is considered good enough and we
  // skip the adjustment.
  minDriftSec?: number;
}): Promise<{ tokens: StoryWordToken[]; offsetApplied: number; detectedSilenceEnd: number | null }> {
  const { audioUrl, tokens } = args;
  const minDriftSec = args.minDriftSec ?? 0.25;
  if (tokens.length === 0) return { tokens, offsetApplied: 0, detectedSilenceEnd: null };

  const firstToken = tokens.find((t) => t.startSec !== null);
  if (!firstToken || firstToken.startSec === null) {
    return { tokens, offsetApplied: 0, detectedSilenceEnd: null };
  }
  const firstTokenStartSec: number = firstToken.startSec;

  // Detect silences with a strict minimum duration so we skip the
  // tiny pauses (200-350 ms) that exist between words inside the
  // title narration. The post-title pause that we care about is
  // typically 400-1500 ms long.
  const silences = await detectSilences(audioUrl, { thresholdDb: -35, minDurationSec: 0.4 });
  // We only care about the silence that separates the title from the
  // body — i.e. the LAST long silence that begins before (or right
  // around) the first body token's startSec. Earlier versions of this
  // helper looked at any silence within a wide window and would pick
  // a silence AFTER the first sentence instead, applying a 5 s shift
  // that wrecked the alignment. The pause that matters always starts
  // before aeneas's first body token; if there is no such silence,
  // there is no measurable title-to-body drift to correct.
  const candidate = silences
    .filter((s) => s.start < firstTokenStartSec + 1)
    .slice(-1)[0] ?? null;

  if (!candidate) {
    return { tokens, offsetApplied: 0, detectedSilenceEnd: null };
  }

  // Drift is positive when the silence ends AFTER aeneas's first
  // token (aeneas placed the word too early). Negative or near-zero
  // means alignment is already good.
  const drift = candidate.end - firstTokenStartSec;
  if (drift < minDriftSec) {
    return { tokens, offsetApplied: 0, detectedSilenceEnd: candidate.end };
  }

  // Aeneas placed the first body word BEFORE the narrator actually
  // started speaking it. Push every token forward by `drift`.
  const corrected = tokens.map((t) => ({
    ...t,
    startSec: t.startSec !== null ? t.startSec + drift : null,
    endSec: t.endSec !== null ? t.endSec + drift : null,
  }));
  return { tokens: corrected, offsetApplied: drift, detectedSilenceEnd: candidate.end };
}
