/**
 * Computes exact audio start/end ranges for a vocab word and its
 * containing sentence from a story's `audioWordTimings` (aeneas
 * word-level alignment). The result is embedded in practice items so
 * the mobile player skips fuzzy segment matching and plays the exact
 * range from the story mp3.
 *
 * Falls back to nulls when:
 *   - the timings payload is missing,
 *   - the surface form doesn't appear as a literal token in
 *     `storyPlainText`,
 *   - or the aligned tokens have no valid sec values.
 *
 * Caller treats nulls as "no precise range available" and routes to
 * HQ TTS fallback.
 */
import type { AudioWordTimingsPayload, StoryWordToken } from "@digital-polyglot/domain";

const SENTENCE_BOUNDARY = /[.!?…]/;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findSentenceBounds(text: string, hitStart: number, hitEnd: number): { start: number; end: number } {
  let start = 0;
  for (let i = hitStart - 1; i >= 0; i -= 1) {
    if (SENTENCE_BOUNDARY.test(text[i] ?? "")) {
      start = i + 1;
      break;
    }
  }
  while (start < hitStart && /\s/.test(text[start] ?? "")) start += 1;

  let end = text.length;
  for (let i = hitEnd; i < text.length; i += 1) {
    if (SENTENCE_BOUNDARY.test(text[i] ?? "")) {
      end = i + 1;
      break;
    }
  }
  while (end > hitEnd && /\s/.test(text[end - 1] ?? "")) end -= 1;

  return { start, end };
}

function pickStartSec(words: StoryWordToken[], rangeStart: number, rangeEnd: number): number | null {
  for (const token of words) {
    if (token.charEnd <= rangeStart) continue;
    if (token.charStart >= rangeEnd) break;
    if (typeof token.startSec === "number" && Number.isFinite(token.startSec)) {
      return token.startSec;
    }
  }
  return null;
}

function pickEndSec(words: StoryWordToken[], rangeStart: number, rangeEnd: number): number | null {
  for (let i = words.length - 1; i >= 0; i -= 1) {
    const token = words[i];
    if (token.charStart >= rangeEnd) continue;
    if (token.charEnd <= rangeStart) break;
    if (typeof token.endSec === "number" && Number.isFinite(token.endSec)) {
      return token.endSec;
    }
  }
  return null;
}

export type PracticeAudioRanges = {
  audioWordStartSec: number | null;
  audioWordEndSec: number | null;
  audioSentenceStartSec: number | null;
  audioSentenceEndSec: number | null;
};

const EMPTY: PracticeAudioRanges = {
  audioWordStartSec: null,
  audioWordEndSec: null,
  audioSentenceStartSec: null,
  audioSentenceEndSec: null,
};

/**
 * Resolve exact audio timings for a target word against a story's
 * aeneas alignment. Pass `preferredContext` (e.g. the vocab item's
 * `note` or the example sentence) to disambiguate when the word
 * appears multiple times in the story.
 */
export function computePracticeAudioRanges(args: {
  targetWord: string | null | undefined;
  timings: AudioWordTimingsPayload | null | undefined;
  preferredContext?: string | null;
}): PracticeAudioRanges {
  const word = (args.targetWord ?? "").trim();
  if (!word) return EMPTY;
  const timings = args.timings;
  if (!timings || !Array.isArray(timings.words) || timings.words.length === 0) return EMPTY;
  const plainText = typeof timings.storyPlainText === "string" ? timings.storyPlainText : "";
  if (!plainText) return EMPTY;

  // Match the surface form as a whole token, case-insensitive.
  const matcher = new RegExp(`\\b${escapeRegExp(word)}\\b`, "giu");
  const matches: Array<{ start: number; end: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = matcher.exec(plainText)) !== null) {
    matches.push({ start: m.index, end: m.index + m[0].length });
    if (m.index === matcher.lastIndex) matcher.lastIndex += 1; // safety
  }
  if (matches.length === 0) return EMPTY;

  // Disambiguate by closest substring overlap with preferredContext, if
  // provided. Otherwise take the first occurrence.
  const ctx = (args.preferredContext ?? "").trim();
  let chosen = matches[0];
  if (ctx && matches.length > 1) {
    const ctxLower = ctx.toLowerCase();
    let bestScore = -1;
    for (const hit of matches) {
      // Score = length of the longest prefix/suffix overlap between the
      // sentence containing `hit` and `ctxLower`. Cheap heuristic; works
      // well when `preferredContext` is the exact example sentence.
      const { start, end } = findSentenceBounds(plainText, hit.start, hit.end);
      const sentence = plainText.slice(start, end).toLowerCase();
      let score = 0;
      const limit = Math.min(sentence.length, ctxLower.length);
      for (let i = 0; i < limit; i += 1) {
        if (sentence[i] === ctxLower[i]) score += 1;
        else break;
      }
      if (score > bestScore) { bestScore = score; chosen = hit; }
    }
  }

  const audioWordStartSec = pickStartSec(timings.words, chosen.start, chosen.end);
  const audioWordEndSec = pickEndSec(timings.words, chosen.start, chosen.end);
  if (audioWordStartSec === null || audioWordEndSec === null || audioWordEndSec <= audioWordStartSec) {
    return EMPTY;
  }

  const { start: sentStart, end: sentEnd } = findSentenceBounds(plainText, chosen.start, chosen.end);
  const audioSentenceStartSec = pickStartSec(timings.words, sentStart, sentEnd);
  const audioSentenceEndSec = pickEndSec(timings.words, sentStart, sentEnd);
  if (
    audioSentenceStartSec === null ||
    audioSentenceEndSec === null ||
    audioSentenceEndSec <= audioSentenceStartSec
  ) {
    // Word range is valid but sentence couldn't be resolved (unusual).
    // Return word-only ranges so the mobile can still play the word.
    return {
      audioWordStartSec,
      audioWordEndSec,
      audioSentenceStartSec: null,
      audioSentenceEndSec: null,
    };
  }

  return {
    audioWordStartSec,
    audioWordEndSec,
    audioSentenceStartSec,
    audioSentenceEndSec,
  };
}
