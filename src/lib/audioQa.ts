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
