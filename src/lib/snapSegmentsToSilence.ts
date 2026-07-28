// Snap SENTENCE segment boundaries to the real pauses in the audio.
//
// This replaces what `correctAlignmentDrift` was originally introduced for:
// aeneas marks the end of a sentence a little before the narrator has
// finished it (e.g. it ended "importante" at 28.56 s when the real pause runs
// 28.96 → 29.72 s), so a per-sentence practice clip cut mid-word. The old fix
// moved every WORD token forward, which wrecked the karaoke highlight for the
// whole rest of the story. Segment ends are the only thing that ever needed
// fixing, so only segment ends are touched here; word timings stay raw.
//
// Server-only module: shells out to ffmpeg.

import type { AudioSegment } from "./audioSegments";
import { detectSilences } from "./detectSilences";

/** How far past a segment's end we will look for the pause that really ends
 * it. Longer than this and the "pause" belongs to a later sentence. */
const LOOK_AHEAD_SEC = 0.8;
/** How far BEFORE the segment end a pause may start and still be its true
 * end (aeneas overshooting into the pause). */
const LOOK_BEHIND_SEC = 0.25;
/** Keep a hair of margin before the next sentence starts. */
const NEXT_SEGMENT_GUARD_SEC = 0.02;

export async function snapSegmentEndsToSilence(args: {
  audioUrl: string;
  segments: AudioSegment[];
  thresholdDb?: number;
  minSilenceSec?: number;
}): Promise<{ segments: AudioSegment[]; snapped: number; reason?: string }> {
  if (args.segments.length === 0) return { segments: args.segments, snapped: 0 };

  let silences;
  try {
    silences = await detectSilences(args.audioUrl, {
      thresholdDb: args.thresholdDb ?? -35,
      // Sentence gaps are shorter than the phrase pauses we look for
      // elsewhere; 0.15 s is enough to be a real boundary and not a plosive.
      minDurationSec: args.minSilenceSec ?? 0.15,
    });
  } catch (err) {
    return {
      segments: args.segments,
      snapped: 0,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
  if (silences.length === 0) return { segments: args.segments, snapped: 0 };

  let snapped = 0;
  const out = args.segments.map((segment, index) => {
    const next = args.segments[index + 1];
    const ceiling = next ? next.startSec - NEXT_SEGMENT_GUARD_SEC : Infinity;

    let best: number | null = null;
    for (const silence of silences) {
      if (silence.start < segment.endSec - LOOK_BEHIND_SEC) continue;
      if (silence.start > segment.endSec + LOOK_AHEAD_SEC) break;
      if (silence.start <= segment.startSec) continue;
      best = silence.start;
      break;
    }
    if (best === null) return segment;

    const endSec = Math.min(best, ceiling);
    if (!Number.isFinite(endSec) || endSec <= segment.startSec) return segment;
    if (Math.abs(endSec - segment.endSec) < 0.01) return segment;
    snapped += 1;
    return { ...segment, endSec };
  });

  return { segments: out, snapped };
}
