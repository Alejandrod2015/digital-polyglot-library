// Parallel pipeline for word-level audio highlight ("karaoke" reader).
// Lives next to existing audio/transcript helpers WITHOUT touching them.
// The legacy sentence-level path in lib/elevenlabs.ts and lib/audioSegments.ts
// keeps working unchanged for every story that does not opt into this feature.

import OpenAI from "openai";
import { prisma } from "@/lib/prisma";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export const AUDIO_WORD_TIMINGS_VERSION = 1 as const;

export type StoryWordToken = {
  text: string;
  charStart: number;
  charEnd: number;
  startSec: number | null;
  endSec: number | null;
};

export type AudioWordTimingsPayload = {
  version: typeof AUDIO_WORD_TIMINGS_VERSION;
  audioDurationSec: number | null;
  storyPlainText: string;
  words: StoryWordToken[];
};

type WhisperWord = { word?: string; start?: number; end?: number };

const WORD_TOKEN_REGEX = /[\p{L}\p{N}][\p{L}\p{M}\p{N}'’-]*/gu;

function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

export function extractStoryPlainText(rawText: string): string {
  const stripped = rawText
    .replace(/<\/blockquote>\s*<blockquote>/gi, "\n")
    .replace(/<\/p>\s*<p>/gi, "\n")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\r\n?/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return stripped;
}

export type StoryTokenSpan = {
  text: string;
  charStart: number;
  charEnd: number;
  normalized: string;
};

export function tokenizeStoryWithSpans(plainText: string): StoryTokenSpan[] {
  const out: StoryTokenSpan[] = [];
  const matches = plainText.matchAll(WORD_TOKEN_REGEX);
  for (const match of matches) {
    const text = match[0];
    const charStart = match.index ?? 0;
    const charEnd = charStart + text.length;
    const normalized = normalizeForMatch(text);
    if (!normalized) continue;
    out.push({ text, charStart, charEnd, normalized });
  }
  return out;
}

function normalizeWhisperWords(raw: WhisperWord[]): Array<{
  normalized: string;
  startSec: number;
  endSec: number;
}> {
  const out: Array<{ normalized: string; startSec: number; endSec: number }> = [];
  for (const w of raw) {
    const startSec =
      typeof w.start === "number" && Number.isFinite(w.start) ? Math.max(0, w.start) : NaN;
    const endSec =
      typeof w.end === "number" && Number.isFinite(w.end) ? Math.max(0, w.end) : NaN;
    if (!Number.isFinite(startSec) || !Number.isFinite(endSec) || endSec <= startSec) continue;
    const text = typeof w.word === "string" ? w.word : "";
    const normalized = normalizeForMatch(text);
    if (!normalized) continue;
    out.push({ normalized, startSec, endSec });
  }
  return out;
}

// Longest-common-subsequence DP, mirrors the approach used in
// audioSegments.ts:alignStorySentencesToWords but emits a per-token alignment.
function alignTokensLCS(
  storyTokens: StoryTokenSpan[],
  whisperTokens: Array<{ normalized: string; startSec: number; endSec: number }>
): Map<number, number> {
  const rows = storyTokens.length;
  const cols = whisperTokens.length;
  if (rows === 0 || cols === 0) return new Map();

  const dp: number[][] = Array.from({ length: rows + 1 }, () => Array<number>(cols + 1).fill(0));

  for (let i = rows - 1; i >= 0; i -= 1) {
    for (let j = cols - 1; j >= 0; j -= 1) {
      dp[i][j] =
        storyTokens[i].normalized === whisperTokens[j].normalized
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const map = new Map<number, number>();
  let i = 0;
  let j = 0;
  while (i < rows && j < cols) {
    if (storyTokens[i].normalized === whisperTokens[j].normalized) {
      map.set(i, j);
      i += 1;
      j += 1;
      continue;
    }
    if (dp[i + 1][j] >= dp[i][j + 1]) {
      i += 1;
    } else {
      j += 1;
    }
  }
  return map;
}

// Tokens that did not match (proper nouns Whisper heard differently, etc.)
// get linearly interpolated timings between their nearest matched neighbors.
function fillGaps(
  storyTokens: StoryTokenSpan[],
  matched: Map<number, number>,
  whisperTokens: Array<{ normalized: string; startSec: number; endSec: number }>
): Array<{ startSec: number | null; endSec: number | null }> {
  const slots: Array<{ startSec: number | null; endSec: number | null }> = storyTokens.map(() => ({
    startSec: null,
    endSec: null,
  }));

  for (const [storyIdx, whisperIdx] of matched.entries()) {
    const w = whisperTokens[whisperIdx];
    slots[storyIdx] = { startSec: w.startSec, endSec: w.endSec };
  }

  for (let i = 0; i < slots.length; i += 1) {
    if (slots[i].startSec !== null) continue;
    let prev = i - 1;
    while (prev >= 0 && slots[prev].endSec === null) prev -= 1;
    let next = i + 1;
    while (next < slots.length && slots[next].startSec === null) next += 1;

    const prevEnd = prev >= 0 ? slots[prev].endSec : null;
    const nextStart = next < slots.length ? slots[next].startSec : null;

    let runEnd = i;
    while (runEnd + 1 < slots.length && slots[runEnd + 1].startSec === null && runEnd + 1 < next) {
      runEnd += 1;
    }
    const runLength = runEnd - i + 1;

    if (prevEnd !== null && nextStart !== null && nextStart > prevEnd) {
      const span = nextStart - prevEnd;
      const step = span / (runLength + 1);
      for (let k = 0; k < runLength; k += 1) {
        const start = prevEnd + step * k;
        const end = prevEnd + step * (k + 1);
        slots[i + k] = { startSec: start, endSec: end };
      }
    } else if (prevEnd !== null) {
      for (let k = 0; k < runLength; k += 1) {
        const start = prevEnd + 0.001 * (k + 1);
        slots[i + k] = { startSec: start, endSec: start + 0.05 };
      }
    } else if (nextStart !== null) {
      for (let k = 0; k < runLength; k += 1) {
        const start = Math.max(0, nextStart - 0.05 * (runLength - k));
        slots[i + k] = { startSec: start, endSec: start + 0.05 };
      }
    }
    i = runEnd;
  }

  return slots;
}

export function alignStoryToWhisperWords(
  storyPlainText: string,
  whisperWords: WhisperWord[]
): StoryWordToken[] {
  const storyTokens = tokenizeStoryWithSpans(storyPlainText);
  if (storyTokens.length === 0) return [];

  const whisperTokens = normalizeWhisperWords(whisperWords);
  if (whisperTokens.length === 0) {
    return storyTokens.map((t) => ({
      text: t.text,
      charStart: t.charStart,
      charEnd: t.charEnd,
      startSec: null,
      endSec: null,
    }));
  }

  const matched = alignTokensLCS(storyTokens, whisperTokens);
  const filled = fillGaps(storyTokens, matched, whisperTokens);

  return storyTokens.map((t, i) => ({
    text: t.text,
    charStart: t.charStart,
    charEnd: t.charEnd,
    startSec: filled[i].startSec,
    endSec: filled[i].endSec,
  }));
}

async function fetchAudioBuffer(audioUrl: string): Promise<{
  buffer: Buffer;
  filename: string;
}> {
  const res = await fetch(audioUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch audio (${res.status}): ${audioUrl}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const guessedName = audioUrl.split("/").pop()?.split("?")[0] || "audio.mp3";
  return { buffer, filename: guessedName };
}

export async function transcribeWithWordTimings(
  audioBuffer: Buffer,
  filename: string,
  narrationText: string
): Promise<{ words: WhisperWord[]; durationSec: number | null }> {
  if (!openai) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  const fileBytes = new Uint8Array(audioBuffer);
  const file = new File([fileBytes], filename, { type: "audio/mpeg" });

  const transcript = await openai.audio.transcriptions.create({
    file,
    model: "whisper-1",
    response_format: "verbose_json",
    timestamp_granularities: ["word"],
    prompt: narrationText.slice(0, 800),
  });

  const words =
    "words" in transcript && Array.isArray(transcript.words)
      ? (transcript.words as WhisperWord[])
      : [];
  const duration =
    "duration" in transcript && typeof transcript.duration === "number"
      ? transcript.duration
      : null;

  return {
    words,
    durationSec: duration !== null && Number.isFinite(duration) ? duration : null,
  };
}

export async function generateWordTimingsForStory(
  storyId: string
): Promise<AudioWordTimingsPayload> {
  const story = await prisma.journeyStory.findUnique({
    where: { id: storyId },
    select: { id: true, text: true, audioUrl: true, title: true },
  });

  if (!story) throw new Error(`JourneyStory ${storyId} not found`);
  if (!story.text) throw new Error(`JourneyStory ${storyId} has no text`);
  if (!story.audioUrl) throw new Error(`JourneyStory ${storyId} has no audioUrl`);

  const storyPlainText = extractStoryPlainText(story.text);
  if (!storyPlainText) throw new Error(`Story ${storyId} plain text is empty after stripping`);

  const { buffer, filename } = await fetchAudioBuffer(story.audioUrl);
  const { words, durationSec } = await transcribeWithWordTimings(
    buffer,
    filename,
    storyPlainText
  );

  const aligned = alignStoryToWhisperWords(storyPlainText, words);

  const payload: AudioWordTimingsPayload = {
    version: AUDIO_WORD_TIMINGS_VERSION,
    audioDurationSec: durationSec,
    storyPlainText,
    words: aligned,
  };

  await prisma.journeyStory.update({
    where: { id: storyId },
    data: { audioWordTimings: payload as unknown as object },
  });

  return payload;
}

export function coerceAudioWordTimings(raw: unknown): AudioWordTimingsPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  if (record.version !== AUDIO_WORD_TIMINGS_VERSION) return null;
  if (typeof record.storyPlainText !== "string") return null;
  if (!Array.isArray(record.words)) return null;

  const words: StoryWordToken[] = [];
  for (const item of record.words) {
    if (!item || typeof item !== "object") continue;
    const w = item as Record<string, unknown>;
    if (typeof w.text !== "string") continue;
    if (typeof w.charStart !== "number" || typeof w.charEnd !== "number") continue;
    const startSec =
      typeof w.startSec === "number" && Number.isFinite(w.startSec) ? w.startSec : null;
    const endSec = typeof w.endSec === "number" && Number.isFinite(w.endSec) ? w.endSec : null;
    words.push({
      text: w.text,
      charStart: w.charStart,
      charEnd: w.charEnd,
      startSec,
      endSec,
    });
  }
  if (words.length === 0) return null;

  const audioDurationSec =
    typeof record.audioDurationSec === "number" && Number.isFinite(record.audioDurationSec)
      ? record.audioDurationSec
      : null;

  return {
    version: AUDIO_WORD_TIMINGS_VERSION,
    audioDurationSec,
    storyPlainText: record.storyPlainText,
    words,
  };
}
