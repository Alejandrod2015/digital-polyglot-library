import { alignStorySentencesToSegments, splitStoryTextIntoSentences, type AudioSegment } from "@/lib/audioSegments";

export type AudioQaStatus = "pass" | "warning" | "fail" | "unavailable";

export type AudioQaResult = {
  status: AudioQaStatus;
  score: number | null;
  transcript: string | null;
  notes: string[];
};

function normalizeForComparison(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toWords(value: string): string[] {
  const normalized = normalizeForComparison(value);
  return normalized ? normalized.split(" ") : [];
}

function levenshteinDistance(a: string[], b: string[]): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const previous = new Array<number>(b.length + 1);
  const current = new Array<number>(b.length + 1);

  for (let j = 0; j <= b.length; j += 1) previous[j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + cost
      );
    }

    for (let j = 0; j <= b.length; j += 1) previous[j] = current[j];
  }

  return previous[b.length];
}

export function analyzeTranscriptQuality(
  expectedText: string,
  transcriptText: string | null | undefined
): AudioQaResult {
  const cleanTranscript = typeof transcriptText === "string" ? transcriptText.trim() : "";
  if (!cleanTranscript) {
    return {
      status: "unavailable",
      score: null,
      transcript: null,
      notes: ["Transcript was not available for QA."],
    };
  }

  const expectedWords = toWords(expectedText);
  const transcriptWords = toWords(cleanTranscript);

  if (expectedWords.length === 0 || transcriptWords.length === 0) {
    return {
      status: "unavailable",
      score: null,
      transcript: cleanTranscript,
      notes: ["Expected text or transcript could not be normalized for QA."],
    };
  }

  const distance = levenshteinDistance(expectedWords, transcriptWords);
  const maxLength = Math.max(expectedWords.length, transcriptWords.length, 1);
  const similarity = Math.max(0, 1 - distance / maxLength);

  const omittedWords = Math.max(0, expectedWords.length - transcriptWords.length);
  const extraWords = Math.max(0, transcriptWords.length - expectedWords.length);
  const percent = Math.round(similarity * 1000) / 10;

  let status: AudioQaStatus = "pass";
  if (similarity < 0.88) status = "fail";
  else if (similarity < 0.96) status = "warning";

  const notes = [
    `Transcript similarity: ${percent}%`,
    `Expected words: ${expectedWords.length}`,
    `Transcript words: ${transcriptWords.length}`,
  ];

  if (omittedWords > 0) notes.push(`Possible omitted words: ${omittedWords}`);
  if (extraWords > 0) notes.push(`Possible extra words: ${extraWords}`);
  if (status === "fail") notes.push("Large mismatch detected. Regeneration is recommended.");
  if (status === "warning") notes.push("Small mismatch detected. Review before publishing.");

  return {
    status,
    score: Math.round(similarity * 1000) / 1000,
    transcript: cleanTranscript,
    notes,
  };
}

export function analyzeDeliveryQuality(expectedText: string, transcriptSegments: AudioSegment[]): AudioQaResult {
  if (!Array.isArray(transcriptSegments) || transcriptSegments.length === 0) {
    return {
      status: "unavailable",
      score: null,
      transcript: null,
      notes: ["Timing segments were not available for delivery QA."],
    };
  }

  const expectedSentences = splitStoryTextIntoSentences(expectedText);
  if (expectedSentences.length < 2) {
    return {
      status: "unavailable",
      score: null,
      transcript: null,
      notes: ["Not enough sentence boundaries were found for delivery QA."],
    };
  }

  const alignedSentences = alignStorySentencesToSegments(expectedText, transcriptSegments);
  if (alignedSentences.length < 2) {
    return {
      status: "unavailable",
      score: null,
      transcript: null,
      notes: ["Could not align sentence timing for delivery QA."],
    };
  }

  const notes: string[] = [];
  let warningCount = 0;
  let failCount = 0;
  let checkedBoundaries = 0;

  for (let index = 0; index < alignedSentences.length - 1; index += 1) {
    const current = alignedSentences[index];
    const next = alignedSentences[index + 1];
    const sentence = current.text.trim();
    const lastChar = sentence.slice(-1);
    const gap = Math.max(0, next.startSec - current.endSec);

    let requiredPause = 0;
    if (/[.!?]/.test(lastChar)) requiredPause = 0.22;
    else if (lastChar === ":") requiredPause = 0.18;
    else if (lastChar === ",") requiredPause = 0.08;
    else continue;

    checkedBoundaries += 1;
    const gapMs = Math.round(gap * 1000);
    const sentencePreview =
      sentence.length > 72 ? `${sentence.slice(0, 72).trimEnd()}...` : sentence;

    if (gap < requiredPause * 0.55) {
      failCount += 1;
      notes.push(`Sentence ending may sound unfinished after "${sentencePreview}" (${gapMs}ms pause).`);
    } else if (gap < requiredPause) {
      warningCount += 1;
      notes.push(`Sentence pause may be too tight after "${sentencePreview}" (${gapMs}ms pause).`);
    }
  }

  if (checkedBoundaries === 0) {
    return {
      status: "unavailable",
      score: null,
      transcript: null,
      notes: ["No punctuation boundaries could be evaluated for delivery QA."],
    };
  }

  const penalties = failCount * 0.22 + warningCount * 0.08;
  const score = Math.max(0, 1 - penalties / checkedBoundaries);

  let status: AudioQaStatus = "pass";
  if (failCount > 0 || score < 0.8) status = "fail";
  else if (warningCount > 0 || score < 0.92) status = "warning";

  const summary = [
    `Delivery score: ${Math.round(score * 1000) / 10}%`,
    `Checked sentence boundaries: ${checkedBoundaries}`,
  ];

  if (failCount > 0) summary.push(`Hard pause issues: ${failCount}`);
  if (warningCount > 0) summary.push(`Tight pause warnings: ${warningCount}`);

  return {
    status,
    score: Math.round(score * 1000) / 1000,
    transcript: null,
    notes: [...summary, ...notes],
  };
}
