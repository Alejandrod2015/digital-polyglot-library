// Multi-anchor drift correction for aeneas alignments.
//
// aeneas distributes tokens **linearly** inside each alignment block,
// so any long pause in the narration (after the title, between
// paragraphs, between sentences, dramatic pauses) shows up as drift:
// aeneas places the post-pause tokens earlier than the narrator
// actually speaks them. Linear distribution can't recover those
// non-uniform gaps on its own.
//
// We post-process aeneas's output by running ffmpeg silencedetect to
// find every meaningful pause in the audio, then walking the tokens
// in order and "anchoring" the first token after each detected
// silence to `silence.end`. The shift propagates forward as a running
// offset that only ever grows (we never push tokens backward, since
// that would over-correct when aeneas was already late or accurate).
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

export type DriftAnchor = {
  /** Index of the token that was anchored to silence.end. */
  tokenIndex: number;
  /** ffmpeg silence span end (in seconds from start of audio). */
  silenceEnd: number;
  /** Drift applied at this anchor (added to the running offset). */
  driftAdded: number;
  /** Running offset AFTER this anchor was applied. */
  cumulativeOffset: number;
};

/**
 * Multi-anchor drift correction.
 *
 * Algorithm:
 *   1. Detect every silence ≥ `minSilenceSec` (default 0.5 s) in the audio.
 *   2. Walk the tokens in order with a running `currentOffset` (starts 0).
 *   3. Whenever we cross a silence (i.e. aeneas's original start for the
 *      current token is later than the silence's start, and the previous
 *      token's original start was earlier than the silence's start), check
 *      whether the current token + currentOffset still lands BEFORE
 *      `silence.end - minDriftSec`. If so, push currentOffset forward so
 *      this token lands exactly at `silence.end`. The bump propagates to
 *      every subsequent token.
 *
 * Returns the corrected tokens plus a list of every anchor that fired,
 * which is useful for telemetry and debugging individual stories.
 *
 * Notes:
 *   - currentOffset only ever grows. We never apply a negative shift
 *     because aeneas being "late" is rare and a negative push could
 *     over-correct in ways that are hard to recover from.
 *   - `minSilenceSec` defaults to 0.5 s, conservative enough to skip
 *     intra-word breaths (typically 200-400 ms) but still catch the
 *     post-title and inter-paragraph gaps we actually care about.
 */
export async function correctAlignmentDrift(args: {
  audioUrl: string;
  tokens: StoryWordToken[];
  /** Minimum drift (s) before an anchor fires. Default 0.25. */
  minDriftSec?: number;
  /** Minimum silence duration (s) to consider as an anchor. Default 0.5. */
  minSilenceSec?: number;
  /** ffmpeg silencedetect noise threshold in dB. Default -35. */
  thresholdDb?: number;
}): Promise<{
  tokens: StoryWordToken[];
  anchors: DriftAnchor[];
  /** Final cumulative offset applied to the tail of the story. */
  totalOffsetApplied: number;
}> {
  const { audioUrl, tokens } = args;
  const minDriftSec = args.minDriftSec ?? 0.25;
  const minSilenceSec = args.minSilenceSec ?? 0.5;
  const thresholdDb = args.thresholdDb ?? -35;

  if (tokens.length === 0) {
    return { tokens, anchors: [], totalOffsetApplied: 0 };
  }

  const silences = await detectSilences(audioUrl, {
    thresholdDb,
    minDurationSec: minSilenceSec,
  });
  // ffmpeg returns silences in chronological order; keep that invariant.
  silences.sort((a, b) => a.start - b.start);

  if (silences.length === 0) {
    return { tokens, anchors: [], totalOffsetApplied: 0 };
  }

  const corrected: StoryWordToken[] = [];
  const anchors: DriftAnchor[] = [];
  let currentOffset = 0;
  let silIdx = 0;
  let prevOriginalStart: number | null = null;

  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i];
    if (t.startSec === null) {
      corrected.push({ ...t });
      continue;
    }
    const originalStart = t.startSec;

    // Advance past any silences whose start is before this token's
    // original start AND were not yet considered. For each such
    // silence we ask: "Is this token the first one after the silence?"
    // — true when the previous token's original start was before the
    // silence's start (or there is no previous token).
    while (silIdx < silences.length && silences[silIdx].start < originalStart) {
      const sil = silences[silIdx];
      const isFirstAfter =
        prevOriginalStart === null || prevOriginalStart < sil.start;
      if (isFirstAfter) {
        const positionWithOffset = originalStart + currentOffset;
        const gap = sil.end - positionWithOffset;
        if (gap >= minDriftSec) {
          // Aeneas was ahead of the narrator at this silence —
          // push every remaining token forward so this one starts
          // exactly at silence.end.
          currentOffset += gap;
          anchors.push({
            tokenIndex: i,
            silenceEnd: sil.end,
            driftAdded: gap,
            cumulativeOffset: currentOffset,
          });
        } else if (gap <= -minDriftSec) {
          // Aeneas was BEHIND the narrator (token marked after the
          // silence already ended). Pulling tokens back is safe as
          // long as the previous corrected token still ends before
          // the silence — otherwise we'd invert the order. Cap the
          // pullback to preserve the invariant prev.endSec ≤ sil.end.
          const lastCorrected = corrected[corrected.length - 1];
          const prevEnd =
            lastCorrected && lastCorrected.endSec !== null
              ? lastCorrected.endSec
              : lastCorrected && lastCorrected.startSec !== null
                ? lastCorrected.startSec
                : -Infinity;
          // Headroom before we would overlap the previous token.
          const maxBackwardShift = sil.end - prevEnd;
          const desiredShift = gap; // negative
          const appliedShift = Math.max(desiredShift, -Math.max(0, maxBackwardShift));
          if (appliedShift <= -minDriftSec) {
            currentOffset += appliedShift;
            anchors.push({
              tokenIndex: i,
              silenceEnd: sil.end,
              driftAdded: appliedShift,
              cumulativeOffset: currentOffset,
            });
          }
        }
      }
      silIdx += 1;
    }

    corrected.push({
      ...t,
      startSec: originalStart + currentOffset,
      endSec: t.endSec !== null ? t.endSec + currentOffset : null,
    });
    prevOriginalStart = originalStart;
  }

  return { tokens: corrected, anchors, totalOffsetApplied: currentOffset };
}
