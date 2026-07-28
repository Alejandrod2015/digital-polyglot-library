// Turns raw word timings into the strictly increasing windows the karaoke
// highlight steps through.
//
// Why this exists (measured 2026-07-28 over 60 stories / 13.133 words):
// aeneas hands adjacent tokens the SAME startSec fairly often (944 cases,
// 7.2% of all words; up to 14% in one story). The reader used to pick "the
// first token whose window contains currentTime", so within a group of tied
// tokens only the first one could ever win: the rest were unreachable at any
// playback position and simply never lit up. The words were not mistimed,
// they had no window at all.
//
// The fix keeps every group inside the exact span it already occupied. The
// first token of a tie keeps its original start to the millisecond, and the
// others share the remainder of that same span, weighted by how long they
// are. Nothing moves earlier, nothing crosses into a neighbouring word's
// span, so the synchronisation that was verified stays untouched.

import type { StoryWordToken } from "./audioWordTimingsTypes";

export type WordWindow = {
  /** Index into the original `words` array. */
  index: number;
  /** Start of this word's highlight window. Strictly increasing. */
  startSec: number;
};

/** Fallback slot width when a tie runs to the end with no duration known. */
const TAIL_SLOT_SEC = 0.12;

export function buildWordWindows(
  words: StoryWordToken[],
  audioDurationSec?: number | null
): WordWindow[] {
  const timed: WordWindow[] = [];
  for (let i = 0; i < words.length; i += 1) {
    const startSec = words[i].startSec;
    if (typeof startSec === "number" && Number.isFinite(startSec)) {
      timed.push({ index: i, startSec });
    }
  }
  if (timed.length === 0) return [];

  const out: WordWindow[] = [];
  let i = 0;
  while (i < timed.length) {
    // Maximal run of tokens sharing one start.
    let j = i;
    while (j + 1 < timed.length && timed[j + 1].startSec === timed[i].startSec) j += 1;

    if (j === i) {
      out.push(timed[i]);
      i += 1;
      continue;
    }

    const start = timed[i].startSec;
    const runLength = j - i + 1;
    const following =
      j + 1 < timed.length
        ? timed[j + 1].startSec
        : typeof audioDurationSec === "number" && audioDurationSec > start
          ? audioDurationSec
          : start + runLength * TAIL_SLOT_SEC;
    const width =
      following > start ? following - start : runLength * TAIL_SLOT_SEC;

    // Longer words get a longer slice; a one-letter token should not hold the
    // highlight as long as a nine-letter one.
    const weights: number[] = [];
    let total = 0;
    for (let k = i; k <= j; k += 1) {
      const weight = Math.max(1, words[timed[k].index].text.trim().length);
      weights.push(weight);
      total += weight;
    }

    let acc = 0;
    for (let k = i; k <= j; k += 1) {
      out.push({ index: timed[k].index, startSec: start + (width * acc) / total });
      acc += weights[k - i];
    }
    i = j + 1;
  }

  // Ties inside a run are resolved above, but guard the invariant the lookup
  // relies on: strictly increasing starts.
  for (let k = 1; k < out.length; k += 1) {
    if (out[k].startSec <= out[k - 1].startSec) {
      out[k] = { index: out[k].index, startSec: out[k - 1].startSec + 0.001 };
    }
  }

  return out;
}

/** Shortest time a word may hold the highlight, in ms. */
export const MIN_DWELL_MS = 45;
/** Being this far behind means a seek or a rate change, not a narrow window. */
const CATCHUP_JUMP = 3;

/**
 * Guarantees every word is actually SEEN.
 *
 * Splitting a tie gives each word a window, but some of those windows come out
 * shorter than the sampling period (measured over 210 stories: 139 windows
 * under one 60 fps frame, 251 under the app's 25 ms interval), so the clock
 * can step straight over a word that does have a window. That showed up as 35
 * words skipped on web and 70 on mobile even after the tie fix.
 *
 * So the highlight advances one word at a time and holds each for at least
 * MIN_DWELL_MS, catching up on the next tick. It only binds on those narrow
 * windows, since narrated words are ~300 ms apart; a real seek (or falling
 * more than CATCHUP_JUMP words behind) snaps straight to the target instead of
 * crawling.
 */
export function createHighlightStepper(minDwellMs: number = MIN_DWELL_MS) {
  let display: number | null = null;
  let lastAdvanceMs = -Infinity;

  return function step(target: number | null, nowMs: number): number | null {
    if (target === null) {
      display = null;
      return null;
    }
    if (
      display === null ||
      target < display ||
      target - display >= CATCHUP_JUMP
    ) {
      display = target;
      lastAdvanceMs = nowMs;
      return display;
    }
    if (target > display && nowMs - lastAdvanceMs >= minDwellMs) {
      display += 1;
      lastAdvanceMs = nowMs;
    }
    return display;
  };
}

/**
 * Index (into the original words array) of the word being spoken at
 * `currentTime`, or null before the first one starts.
 *
 * Binary search over the precomputed windows; the previous implementation
 * rescanned the token list on every animation frame.
 */
export function findActiveWordIndex(
  windows: WordWindow[],
  currentTime: number
): number | null {
  if (windows.length === 0) return null;
  if (currentTime < windows[0].startSec) return null;

  let lo = 0;
  let hi = windows.length - 1;
  let ans = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (windows[mid].startSec <= currentTime) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return windows[ans].index;
}
