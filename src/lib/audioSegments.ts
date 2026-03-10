export type AudioSegment = {
  id: string;
  text: string;
  normalizedText: string;
  startSec: number;
  endSec: number;
  index: number;
};

export type TranscriptSegment = {
  text?: string;
  start?: number;
  end?: number;
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

export function findBestAudioSegment(
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
