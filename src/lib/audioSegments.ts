export type AudioSegment = {
  id: string;
  text: string;
  normalizedText: string;
  startSec: number;
  endSec: number;
  index: number;
  clipUrl?: string;
};

export type TranscriptSegment = {
  text?: string;
  start?: number;
  end?: number;
};

export type TranscriptWord = {
  word?: string;
  start?: number;
  end?: number;
};

type TranscriptToken = {
  token: string;
  startSec: number;
  endSec: number;
};

type StorySentenceTokenSpan = {
  sentence: string;
  normalizedText: string;
  tokenStart: number;
  tokenEnd: number;
};

export function normalizeSegmentText(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/[“”„«»"']/g, "")
    .replace(/[.,!?;:()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function coerceAudioSegments(raw: unknown): AudioSegment[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const text = typeof record.text === "string" ? record.text.trim() : "";
      const normalizedText =
        typeof record.normalizedText === "string" ? record.normalizedText.trim() : normalizeSegmentText(text);
      const startSec =
        typeof record.startSec === "number" && Number.isFinite(record.startSec) ? record.startSec : NaN;
      const endSec =
        typeof record.endSec === "number" && Number.isFinite(record.endSec) ? record.endSec : NaN;
      const id =
        typeof record.id === "string" && record.id.trim() ? record.id.trim() : `segment-${index + 1}`;

      if (!text || !normalizedText || !Number.isFinite(startSec) || !Number.isFinite(endSec) || endSec <= startSec) {
        return null;
      }

      return {
        id,
        text,
        normalizedText,
        startSec,
        endSec,
        index:
          typeof record.index === "number" && Number.isFinite(record.index) ? Math.max(0, Math.floor(record.index)) : index,
        ...(typeof record.clipUrl === "string" && record.clipUrl.trim() ? { clipUrl: record.clipUrl.trim() } : {}),
      };
    })
    .filter((item): item is AudioSegment => item !== null);
}

export function buildAudioSegmentsFromTranscript(rawSegments: TranscriptSegment[]): AudioSegment[] {
  return rawSegments
    .map((segment, index) => {
      const text = typeof segment.text === "string" ? segment.text.trim() : "";
      const normalizedText = normalizeSegmentText(text);
      const startSec =
        typeof segment.start === "number" && Number.isFinite(segment.start) ? Math.max(0, segment.start) : NaN;
      const endSec =
        typeof segment.end === "number" && Number.isFinite(segment.end) ? Math.max(0, segment.end) : NaN;

      if (!text || !normalizedText || !Number.isFinite(startSec) || !Number.isFinite(endSec) || endSec <= startSec) {
        return null;
      }

      return {
        id: `segment-${index + 1}`,
        text,
        normalizedText,
        startSec,
        endSec,
        index,
      };
    })
    .filter((item): item is AudioSegment => item !== null);
}

export function splitStoryTextIntoSentences(storyText: string): string[] {
  const normalized = storyText
    .replace(/<\/blockquote>\s*<blockquote>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return [];

  const matches = normalized.match(/[^.!?]+[.!?]+(?:["'”»]+)?|[^.!?]+$/g) ?? [];
  const rawUnits = matches
    .map((sentence) => sentence.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  return mergeNarrativeUnits(rawUnits);
}

function stripOuterQuotes(value: string): string {
  return value.trim().replace(/^[“"«]+/, "").replace(/[”"»]+$/, "").trim();
}

function isShortUnit(value: string): boolean {
  const tokens = tokenizeNormalized(value);
  return tokens.length > 0 && tokens.length <= 4;
}

function isLikelyOpenDialogue(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  const startsWithQuote = /^[“"«¿¡]/.test(trimmed);
  const endsWithClosingQuote = /[”"»]$/.test(trimmed);
  return startsWithQuote && !endsWithClosingQuote;
}

function isLikelyNarrativeTail(value: string): boolean {
  const normalized = stripOuterQuotes(value).toLowerCase();
  return /^(dijo|pregunt[oó]|respondi[oó]|exclam[oó]|pens[oó]|reflexion[oó]|señal[oó]|grit[oó]|murmur[oó])\b/.test(
    normalized
  );
}

function hasClosingQuote(value: string): boolean {
  return /[”"»]$/.test(value.trim());
}

function hasOpeningQuote(value: string): boolean {
  return /^[“"«]/.test(value.trim());
}

function mergeNarrativeUnits(units: string[]): string[] {
  const out: string[] = [];

  for (let index = 0; index < units.length; index += 1) {
    let current = units[index];
    if (!current) continue;

    while (index + 1 < units.length) {
      const next = units[index + 1];
      if (!next) {
        index += 1;
        continue;
      }

      const currentIsOpenDialogue = isLikelyOpenDialogue(current);
      const nextIsTail = isLikelyNarrativeTail(next);
      const currentIsShort = isShortUnit(current);
      const nextClosesDialogue = hasClosingQuote(next);
      const nextOpensDialogue = hasOpeningQuote(next);

      const shouldMerge =
        (currentIsOpenDialogue && nextIsTail) ||
        (currentIsOpenDialogue && nextClosesDialogue) ||
        (currentIsOpenDialogue && currentIsShort && !nextOpensDialogue && !nextIsTail);

      if (!shouldMerge) break;

      current = `${current} ${next}`.replace(/\s+/g, " ").trim();
      index += 1;
    }

    out.push(current);
  }

  return out;
}

function tokenizeNormalized(value: string): string[] {
  return normalizeSegmentText(value).split(" ").filter(Boolean);
}

function tokenizeStorySentences(storyText: string): StorySentenceTokenSpan[] {
  const sentences = splitStoryTextIntoSentences(storyText);
  const out: StorySentenceTokenSpan[] = [];
  let tokenCursor = 0;

  for (const sentence of sentences) {
    const tokens = tokenizeNormalized(sentence);
    if (tokens.length === 0) continue;
    out.push({
      sentence,
      normalizedText: normalizeSegmentText(sentence),
      tokenStart: tokenCursor,
      tokenEnd: tokenCursor + tokens.length - 1,
    });
    tokenCursor += tokens.length;
  }

  return out;
}

function buildTranscriptTokensFromSegments(segments: AudioSegment[]): TranscriptToken[] {
  const out: TranscriptToken[] = [];

  for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex += 1) {
    const tokens = tokenizeNormalized(segments[segmentIndex].text);
    const segmentTokenCount = tokens.length;
    if (segmentTokenCount === 0) continue;

    for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex += 1) {
      const segment = segments[segmentIndex];
      const duration = segment.endSec - segment.startSec;
      const startSec = segment.startSec + (duration * tokenIndex) / segmentTokenCount;
      const endSec = segment.startSec + (duration * (tokenIndex + 1)) / segmentTokenCount;
      out.push({
        token: tokens[tokenIndex],
        startSec,
        endSec,
      });
    }
  }

  return out;
}

function buildTranscriptTokensFromWords(words: TranscriptWord[]): TranscriptToken[] {
  const out: TranscriptToken[] = [];

  for (const word of words) {
    const startSec = typeof word.start === "number" && Number.isFinite(word.start) ? Math.max(0, word.start) : NaN;
    const endSec = typeof word.end === "number" && Number.isFinite(word.end) ? Math.max(0, word.end) : NaN;
    const parts = tokenizeNormalized(typeof word.word === "string" ? word.word : "");
    if (!Number.isFinite(startSec) || !Number.isFinite(endSec) || endSec <= startSec || parts.length === 0) continue;

    const duration = endSec - startSec;
    for (let index = 0; index < parts.length; index += 1) {
      out.push({
        token: parts[index],
        startSec: startSec + (duration * index) / parts.length,
        endSec: startSec + (duration * (index + 1)) / parts.length,
      });
    }
  }

  return out;
}

function trimLeadingTitleTokens(tokens: TranscriptToken[], storyTitle: string, firstSentence: string): TranscriptToken[] {
  const titleTokens = tokenizeNormalized(storyTitle);
  if (titleTokens.length === 0 || tokens.length < titleTokens.length) return tokens;

  const tokenPrefix = tokens.slice(0, titleTokens.length).map((item) => item.token);
  const firstSentenceTokens = tokenizeNormalized(firstSentence);
  const titleMatchesPrefix = titleTokens.every((token, index) => tokenPrefix[index] === token);
  const sentenceStartsWithTitle = titleTokens.every((token, index) => firstSentenceTokens[index] === token);

  if (titleMatchesPrefix && !sentenceStartsWithTitle) {
    return tokens.slice(titleTokens.length);
  }

  return tokens;
}

function findSentenceStartOffset(
  transcriptTokens: TranscriptToken[],
  sentenceTokens: string[],
  cursor: number
): number {
  const maxLookahead = Math.min(transcriptTokens.length - 1, cursor + 10);
  let bestOffset = cursor;
  let bestScore = -1;

  for (let start = cursor; start <= maxLookahead; start += 1) {
    let score = 0;
    const sampleSize = Math.min(sentenceTokens.length, 6);
    for (let i = 0; i < sampleSize && start + i < transcriptTokens.length; i += 1) {
      if (transcriptTokens[start + i].token === sentenceTokens[i]) {
        score += 1;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestOffset = start;
    }
  }

  return bestOffset;
}

function alignStorySentencesToTokens(
  storyText: string,
  transcriptTokensInput: TranscriptToken[],
  storyTitle = ""
): AudioSegment[] {
  const sentences = splitStoryTextIntoSentences(storyText);
  if (sentences.length === 0 || transcriptTokensInput.length === 0) return [];

  let transcriptTokens = transcriptTokensInput;
  transcriptTokens = trimLeadingTitleTokens(transcriptTokens, storyTitle, sentences[0]);
  if (transcriptTokens.length === 0) return [];

  const aligned: AudioSegment[] = [];
  let cursor = 0;

  for (let sentenceIndex = 0; sentenceIndex < sentences.length; sentenceIndex += 1) {
    const sentence = sentences[sentenceIndex];
    const sentenceTokens = tokenizeNormalized(sentence);
    if (sentenceTokens.length === 0 || cursor >= transcriptTokens.length) continue;

    const startOffset = findSentenceStartOffset(transcriptTokens, sentenceTokens, cursor);
    let sentenceTokenIndex = 0;
    let lastMatchedTokenIndex = startOffset;

    for (let i = startOffset; i < transcriptTokens.length; i += 1) {
      const transcriptToken = transcriptTokens[i].token;
      const expectedToken = sentenceTokens[sentenceTokenIndex];

      if (transcriptToken === expectedToken) {
        lastMatchedTokenIndex = i;
        sentenceTokenIndex += 1;
      } else if (
        sentenceTokenIndex + 1 < sentenceTokens.length &&
        transcriptToken === sentenceTokens[sentenceTokenIndex + 1]
      ) {
        lastMatchedTokenIndex = i;
        sentenceTokenIndex += 2;
      }

      if (sentenceTokenIndex >= sentenceTokens.length) {
        break;
      }
    }

    const startToken = transcriptTokens[startOffset];
    const endToken = transcriptTokens[Math.max(startOffset, lastMatchedTokenIndex)];
    const startSec = startToken.startSec;
    const endSec = endToken.endSec;

    aligned.push({
      id: `sentence-${sentenceIndex + 1}`,
      text: sentence,
      normalizedText: normalizeSegmentText(sentence),
      startSec,
      endSec: Math.max(endSec, startSec + 0.12),
      index: sentenceIndex,
    });

    cursor = Math.max(lastMatchedTokenIndex + 1, startOffset + 1);
  }

  return aligned;
}

export function alignStorySentencesToSegments(
  storyText: string,
  transcriptSegments: AudioSegment[],
  storyTitle = ""
): AudioSegment[] {
  return alignStorySentencesToTokens(
    storyText,
    buildTranscriptTokensFromSegments(transcriptSegments),
    storyTitle
  );
}

export function alignStorySentencesToWords(
  storyText: string,
  transcriptWords: TranscriptWord[],
  storyTitle = ""
): AudioSegment[] {
  const sentenceSpans = tokenizeStorySentences(storyText);
  if (sentenceSpans.length === 0) return [];

  let transcriptTokens = buildTranscriptTokensFromWords(transcriptWords);
  transcriptTokens = trimLeadingTitleTokens(transcriptTokens, storyTitle, sentenceSpans[0]?.sentence ?? "");
  if (transcriptTokens.length === 0) return [];

  const storyTokens = sentenceSpans.flatMap((span) => tokenizeNormalized(span.sentence));
  if (storyTokens.length === 0) return [];

  const rows = storyTokens.length;
  const cols = transcriptTokens.length;
  const dp: number[][] = Array.from({ length: rows + 1 }, () => Array<number>(cols + 1).fill(0));

  for (let i = rows - 1; i >= 0; i -= 1) {
    for (let j = cols - 1; j >= 0; j -= 1) {
      dp[i][j] =
        storyTokens[i] === transcriptTokens[j].token
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const storyToTranscript = new Map<number, number>();
  let i = 0;
  let j = 0;
  while (i < rows && j < cols) {
    if (storyTokens[i] === transcriptTokens[j].token) {
      storyToTranscript.set(i, j);
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

  const aligned: AudioSegment[] = [];
  for (let sentenceIndex = 0; sentenceIndex < sentenceSpans.length; sentenceIndex += 1) {
    const span = sentenceSpans[sentenceIndex];
    let firstMatch: number | null = null;
    let lastMatch: number | null = null;

    for (let tokenIndex = span.tokenStart; tokenIndex <= span.tokenEnd; tokenIndex += 1) {
      const transcriptIndex = storyToTranscript.get(tokenIndex);
      if (typeof transcriptIndex !== "number") continue;
      if (firstMatch === null) firstMatch = transcriptIndex;
      lastMatch = transcriptIndex;
    }

    if (firstMatch === null || lastMatch === null) continue;

    aligned.push({
      id: `sentence-${sentenceIndex + 1}`,
      text: span.sentence,
      normalizedText: span.normalizedText,
      startSec: transcriptTokens[firstMatch].startSec,
      endSec: Math.max(transcriptTokens[lastMatch].endSec, transcriptTokens[firstMatch].startSec + 0.12),
      index: sentenceIndex,
    });
  }

  return aligned;
}

export function findBestAudioSegment(
  segments: AudioSegment[],
  sentence: string,
  options?: { targetWord?: string | null; mode?: "strict" | "loose" }
): AudioSegment | null {
  const normalizedSentence = normalizeSegmentText(sentence);
  if (!normalizedSentence) return null;
  const normalizedTargetWord = normalizeSegmentText(options?.targetWord ?? "");
  const mode = options?.mode ?? "strict";
  const sentenceTokens = normalizedSentence.split(" ").filter(Boolean);
  if (sentenceTokens.length === 0) return null;

  const candidates: Array<{ segment: AudioSegment; score: number }> = [];

  const isTokenSubsequence = (needle: string[], haystack: string[]): boolean => {
    if (needle.length === 0 || haystack.length === 0 || needle.length > haystack.length) return false;
    for (let start = 0; start <= haystack.length - needle.length; start += 1) {
      let matches = true;
      for (let index = 0; index < needle.length; index += 1) {
        if (needle[index] !== haystack[start + index]) {
          matches = false;
          break;
        }
      }
      if (matches) return true;
    }
    return false;
  };

  for (const segment of segments) {
    const normalizedSegment = segment.normalizedText;
    if (!normalizedSegment) continue;
    const segmentTokens = normalizedSegment.split(" ").filter(Boolean);
    if (segmentTokens.length === 0) continue;
    if (
      normalizedTargetWord &&
      !segmentTokens.includes(normalizedTargetWord) &&
      !normalizedSegment.includes(normalizedTargetWord)
    ) {
      continue;
    }

    let score = -1;
    if (normalizedSegment === normalizedSentence) {
      score = 100;
    } else if (isTokenSubsequence(sentenceTokens, segmentTokens)) {
      score = 90 + sentenceTokens.length / Math.max(segmentTokens.length, sentenceTokens.length);
    } else if (isTokenSubsequence(segmentTokens, sentenceTokens)) {
      score = 80 + segmentTokens.length / sentenceTokens.length;
    }

    if (score >= 0) {
      candidates.push({ segment, score });
      continue;
    }

    if (mode === "loose") {
      const segmentTokenSet = new Set(segmentTokens);
      const overlapCount = sentenceTokens.filter((token) => segmentTokenSet.has(token)).length;
      const overlapRatio = overlapCount / sentenceTokens.length;
      if (overlapRatio >= 0.72) {
        candidates.push({
          segment,
          score: 60 + overlapRatio,
        });
      }
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((left, right) => right.score - left.score);

  const best = candidates[0];
  const secondBest = candidates[1];
  if (mode === "strict" && secondBest && best.score - secondBest.score < 5) {
    return null;
  }

  return best.score >= (mode === "strict" ? 80 : 60) ? best.segment : null;
}

export function findBestAudioSegmentLegacy(
  segments: AudioSegment[],
  sentence: string
): AudioSegment | null {
  const normalizedSentence = normalizeSegmentText(sentence);
  if (!normalizedSentence) return null;

  let best: AudioSegment | null = null;
  let bestScore = 0;

  for (const segment of segments) {
    const normalizedSegment = segment.normalizedText;
    if (!normalizedSegment) continue;

    let score = 0;
    if (normalizedSegment === normalizedSentence) {
      score = 4;
    } else if (
      normalizedSegment.includes(normalizedSentence) ||
      normalizedSentence.includes(normalizedSegment)
    ) {
      score = 3;
    } else {
      const sentenceTokens = normalizedSentence.split(" ").filter(Boolean);
      const segmentTokens = normalizedSegment.split(" ").filter(Boolean);
      if (sentenceTokens.length === 0 || segmentTokens.length === 0) continue;
      const segmentTokenSet = new Set(segmentTokens);
      const overlapCount = sentenceTokens.filter((token) => segmentTokenSet.has(token)).length;
      const overlapRatio = overlapCount / sentenceTokens.length;
      if (overlapRatio >= 0.72) {
        score = 2 + overlapRatio;
      }
    }

    if (score > bestScore) {
      best = segment;
      bestScore = score;
    }
  }

  return bestScore >= 2 ? best : null;
}
