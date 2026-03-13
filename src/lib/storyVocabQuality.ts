import { normalizeToken, splitWordTokens } from "@/lib/vocabSelection";

export type StoryVocabQuality = {
  status: "good" | "usable" | "weak";
  candidateCount: number;
  lexicalDiversity: number;
  expressionCandidateCount: number;
  suggestedMinItems: number;
  reason: string;
};

const STOPWORDS_BY_LANGUAGE: Record<string, Set<string>> = {
  spanish: new Set([
    "el",
    "la",
    "los",
    "las",
    "un",
    "una",
    "unos",
    "unas",
    "de",
    "del",
    "y",
    "o",
    "a",
    "en",
    "que",
    "se",
    "es",
    "era",
    "fue",
    "por",
    "con",
    "para",
    "al",
    "como",
    "su",
    "sus",
    "lo",
    "le",
    "les",
    "ya",
    "muy",
    "más",
    "pero",
    "cuando",
    "porque",
  ]),
  german: new Set(["der", "die", "das", "und", "oder", "ein", "eine", "in", "zu", "mit", "auf", "von"]),
};

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function wordCount(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function countExpressionCandidates(text: string): number {
  const quoted = text.match(/“[^”]{3,40}”|"[^"]{3,40}"/g) ?? [];
  const commaPatterns = text.match(/\b(?:de repente|por fin|al menos|por ahora|de una vez|poco a poco|al final)\b/giu) ?? [];
  return quoted.length + commaPatterns.length;
}

export function assessStoryVocabQuality(text: string, language?: string): StoryVocabQuality {
  const cleanText = stripHtml(text);
  const words = cleanText.match(/[\p{L}][\p{L}\p{M}'-]*/gu) ?? [];
  const stopwords = STOPWORDS_BY_LANGUAGE[normalizeToken(language ?? "")] ?? new Set<string>();
  const normalized = words
    .map((token) => normalizeToken(token))
    .filter(Boolean);
  const contentWords = normalized.filter((token) => token.length >= 4 && !stopwords.has(token));
  const unique = new Set(contentWords);
  const candidateWords = [...unique].filter((token) => {
    const parts = splitWordTokens(token);
    return parts.length === 1 && token.length >= 4;
  });
  const lexicalDiversity = contentWords.length > 0 ? unique.size / contentWords.length : 0;
  const expressionCandidateCount = countExpressionCandidates(cleanText);
  const candidateCount = candidateWords.length + expressionCandidateCount;
  const totalWords = wordCount(cleanText);

  let status: StoryVocabQuality["status"] = "weak";
  let reason = "The story does not yet show enough varied, reusable vocabulary.";

  if (totalWords >= 220 && candidateCount >= 20 && lexicalDiversity >= 0.38) {
    status = "good";
    reason = "The story has enough lexical range to support strong vocabulary generation.";
  } else if (totalWords >= 170 && candidateCount >= 14 && lexicalDiversity >= 0.3) {
    status = "usable";
    reason = "The story can generate vocabulary, but richer wording would improve the result.";
  }

  return {
    status,
    candidateCount,
    lexicalDiversity: Number(lexicalDiversity.toFixed(2)),
    expressionCandidateCount,
    suggestedMinItems: Math.max(10, Math.min(24, Math.round(candidateCount * 0.55))),
    reason,
  };
}

