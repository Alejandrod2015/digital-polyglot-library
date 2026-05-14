import type { AudioWordTimingsPayload, StoryWordToken } from "@digital-polyglot/domain";

import {
  normalizeSegmentText,
  type AudioSegment,
} from "../../../../src/lib/audioSegments";

const SENTENCE_BOUNDARY = /[.!?…]/;

type VocabLike = { word: string | null | undefined };

function normalizeText(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

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
  while (start < hitStart && /\s/.test(text[start] ?? "")) {
    start += 1;
  }

  let end = text.length;
  for (let i = hitEnd; i < text.length; i += 1) {
    if (SENTENCE_BOUNDARY.test(text[i] ?? "")) {
      end = i + 1;
      break;
    }
  }
  while (end > hitEnd && /\s/.test(text[end - 1] ?? "")) {
    end -= 1;
  }

  return { start, end };
}

function pickStartSec(words: StoryWordToken[], sentenceStart: number, sentenceEnd: number): number | null {
  for (const token of words) {
    if (token.charEnd <= sentenceStart) continue;
    if (token.charStart >= sentenceEnd) break;
    if (typeof token.startSec === "number" && Number.isFinite(token.startSec)) {
      return token.startSec;
    }
  }
  return null;
}

function pickEndSec(words: StoryWordToken[], sentenceStart: number, sentenceEnd: number): number | null {
  for (let i = words.length - 1; i >= 0; i -= 1) {
    const token = words[i];
    if (token.charStart >= sentenceEnd) continue;
    if (token.charEnd <= sentenceStart) break;
    if (typeof token.endSec === "number" && Number.isFinite(token.endSec)) {
      return token.endSec;
    }
  }
  return null;
}

/**
 * Build sentence-level `AudioSegment`s for a vocab list from word timings,
 * fully client-side. Mirrors what `audioSegments` (aeneas) provides via
 * `/api/standalone-stories`, so offline practice can resolve clip start/end
 * boundaries the same way `findSegmentForClip` does online.
 */
export function buildOfflineAudioClipsForVocab(params: {
  vocab: VocabLike[];
  audioWordTimings: AudioWordTimingsPayload | null | undefined;
  storyPlainText?: string | null;
}): AudioSegment[] {
  const timings = params.audioWordTimings;
  if (!timings || !Array.isArray(timings.words) || timings.words.length === 0) return [];

  const plainText = normalizeText(params.storyPlainText) || normalizeText(timings.storyPlainText);
  if (!plainText) return [];

  const seen = new Map<string, AudioSegment>();
  let nextIndex = 0;

  for (const item of params.vocab) {
    const word = normalizeText(item?.word);
    if (!word) continue;

    const matcher = new RegExp(`\\b${escapeRegExp(word)}\\b`, "iu");
    const match = matcher.exec(plainText);
    if (!match || match.index < 0) continue;

    const hitStart = match.index;
    const hitEnd = hitStart + match[0].length;
    const { start, end } = findSentenceBounds(plainText, hitStart, hitEnd);
    if (end <= start) continue;

    const key = `${start}-${end}`;
    if (seen.has(key)) continue;

    const startSec = pickStartSec(timings.words, start, end);
    const endSec = pickEndSec(timings.words, start, end);
    if (
      startSec === null ||
      endSec === null ||
      !Number.isFinite(startSec) ||
      !Number.isFinite(endSec) ||
      endSec <= startSec
    ) {
      continue;
    }

    const sentenceText = plainText.slice(start, end).trim();
    if (!sentenceText) continue;

    seen.set(key, {
      id: `offline-segment-${nextIndex}`,
      text: sentenceText,
      normalizedText: normalizeSegmentText(sentenceText),
      startSec,
      endSec,
      index: nextIndex,
    });
    nextIndex += 1;
  }

  return Array.from(seen.values()).sort((a, b) => a.startSec - b.startSec);
}
