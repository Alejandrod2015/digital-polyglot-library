import { isInvalidMultiwordVocab, normalizeToken, splitWordTokens } from "@/lib/vocabSelection";
import { resolveCanonicalVocabEntry } from "@/lib/vocabWordNormalization";
import { isLowValueStudyWord } from "@/lib/vocabPedagogy";

export type VocabItem = {
  word: string;
  surface?: string;
  definition: string;
  type?: string;
};

export type VocabValidationIssueCode =
  | "missing_word"
  | "missing_definition"
  | "word_too_long"
  | "unsupported_characters"
  | "too_many_tokens"
  | "missing_in_text"
  | "duplicate"
  | "transparent_word"
  | "invalid_multiword"
  | "weak_definition"
  | "too_basic_for_level";

export type VocabValidationIssue = {
  word: string;
  code: VocabValidationIssueCode;
  reason: string;
};

const DISCOURAGED_VOCAB_BY_LANGUAGE: Record<string, Set<string>> = {
  spanish: new Set([
    "importante",
    "normal",
    "general",
    "social",
    "natural",
    "especial",
    "popular",
    "formal",
    "local",
    "real",
    "personal",
  ]),
  german: new Set([
    "wichtig",
    "normal",
    "allgemein",
    "sozial",
    "naturlich",
    "speziell",
    "lokal",
    "real",
    "personlich",
  ]),
};

export function wordCount(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export function computeDynamicVocabRange(text: string): { minItems: number; maxItems: number } {
  const words = wordCount(text);
  const target = Math.max(14, Math.min(28, Math.round(words / 24)));
  const minItems = Math.max(12, Math.min(24, target));
  const maxItems = Math.max(minItems, Math.min(32, target + 4));
  return { minItems, maxItems };
}

export function computeSoftMinimum(minItems: number): number {
  return Math.max(10, minItems - 3);
}

export function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function appearsInText(text: string, phrase: string): boolean {
  const clean = phrase.trim();
  if (!clean) return false;
  const pattern = new RegExp(
    `(^|[^\\p{L}\\p{N}_])${escapeRegex(clean)}(?=$|[^\\p{L}\\p{N}_])`,
    "iu"
  );
  return pattern.test(text);
}

export function normalizeDefinition(definition: string): string {
  const compact = definition
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([.!?])(?:\s*[.!?]){1,}$/g, "$1")
    .trim();
  if (!compact) return compact;
  return compact[0].toUpperCase() + compact.slice(1);
}

// Hard UI constraint: definiciones se muestran en chips de match/
// meaning que no pueden wrap. Tope 50 chars, mínimo 3 palabras para
// que no quede una traducción literal pelada ("Idea"). Antes el rango
// era 6-18 palabras lo que generaba paráfrasis tipo "An idea or
// concept about something abstract that..." que rompían el layout.
export const DEFINITION_MAX_CHARS = 50;
export const DEFINITION_MIN_WORDS = 3;
export const DEFINITION_MAX_WORDS = 7;

export function hasDetailedDefinition(definition: string): boolean {
  const trimmed = definition.trim();
  if (trimmed.length > DEFINITION_MAX_CHARS) return false;
  const wc = wordCount(trimmed);
  return wc >= DEFINITION_MIN_WORDS && wc <= DEFINITION_MAX_WORDS;
}

export function isLikelyDirectTranslation(definition: string): boolean {
  // Con el nuevo formato corto, defs como "An idea or concept" (4
  // palabras, 18 chars) son válidas aunque parezcan "traducción
  // directa". Sólo rechazamos casos puramente pelados: una palabra
  // sin contexto, o "to <verb>" / "<article> <noun>" sin nada más.
  const normalized = definition.trim().toLowerCase();
  if (!normalized) return true;
  const wc = wordCount(normalized);
  if (wc === 1) return true;
  if (/^to\s+[a-z][a-z'\-]*$/i.test(normalized)) return true;
  if (/^(a|an|the)\s+[a-z][a-z'\-]*$/i.test(normalized)) return true;
  return false;
}

export function hasPedagogicalDefinition(definition: string): boolean {
  return hasDetailedDefinition(definition) && !isLikelyDirectTranslation(definition);
}

export function isDiscouragedTransparentWord(word: string, language: string): boolean {
  const discouraged = DISCOURAGED_VOCAB_BY_LANGUAGE[normalizeToken(language)];
  if (!discouraged) return false;
  const tokens = splitWordTokens(word);
  return tokens.length > 0 && tokens.every((token) => discouraged.has(token));
}

export function validateAndNormalizeVocab(args: {
  rawVocab: unknown;
  text: string;
  language?: string;
  level?: string;
  cefrLevel?: string;
  maxWordLength?: number;
  maxWordTokens?: number;
}): { vocab: VocabItem[]; issues: VocabValidationIssue[] } {
  const rows = Array.isArray(args.rawVocab) ? args.rawVocab : [];
  const normalizedText = stripHtml(args.text);
  const language = args.language ?? "";
  const maxWordLength = args.maxWordLength ?? 48;
  const maxWordTokens = args.maxWordTokens ?? 4;
  const seen = new Set<string>();
  const vocab: VocabItem[] = [];
  const issues: VocabValidationIssue[] = [];

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    const rawWord = typeof record.word === "string" ? record.word : "";
    const type = typeof record.type === "string" ? record.type.trim() : undefined;
    const { word, surface } = resolveCanonicalVocabEntry({
      word: rawWord,
      surface: typeof record.surface === "string" ? record.surface : rawWord,
      type,
      language,
    });
    const rawDefinition =
      typeof record.definition === "string"
        ? record.definition.trim()
        : typeof record.meaning === "string"
          ? record.meaning.trim()
          : "";
    const definition = normalizeDefinition(rawDefinition);
    if (!word) {
      issues.push({ word: "", code: "missing_word", reason: 'Missing "word".' });
      continue;
    }
    if (!definition) {
      issues.push({ word, code: "missing_definition", reason: 'Missing "definition".' });
      continue;
    }
    if (word.length > maxWordLength) {
      issues.push({
        word,
        code: "word_too_long",
        reason: `Word is too long (max ${maxWordLength} chars).`,
      });
      continue;
    }
    if (/[<>[\]{}]/.test(word)) {
      issues.push({ word, code: "unsupported_characters", reason: "Contains unsupported characters." });
      continue;
    }
    const tokenCount = word.split(/\s+/).filter(Boolean).length;
    if (tokenCount > maxWordTokens) {
      issues.push({
        word,
        code: "too_many_tokens",
        reason: `Too many tokens (max ${maxWordTokens}).`,
      });
      continue;
    }
    if (!appearsInText(normalizedText, surface || word)) {
      issues.push({ word, code: "missing_in_text", reason: "Word does not appear in the story text." });
      continue;
    }
    const key = word.toLowerCase();
    if (seen.has(key)) {
      issues.push({ word, code: "duplicate", reason: "Duplicate vocabulary item." });
      continue;
    }
    if (language && isDiscouragedTransparentWord(word, language)) {
      issues.push({
        word,
        code: "transparent_word",
        reason: "Too transparent or generic to be high-value study vocabulary.",
      });
      continue;
    }
    if (
      isLowValueStudyWord({
        word,
        language,
        level: args.level,
        cefrLevel: args.cefrLevel,
        type,
      })
    ) {
      issues.push({
        word,
        code: "too_basic_for_level",
        reason: "Too basic or too low-information for the target study level.",
      });
      continue;
    }
    if (isInvalidMultiwordVocab(word, { type, storyText: normalizedText })) {
      issues.push({
        word,
        code: "invalid_multiword",
        reason: "Multi-word item is not a short lexicalized expression.",
      });
      continue;
    }
    if (!hasPedagogicalDefinition(definition)) {
      issues.push({
        word,
        code: "weak_definition",
        reason: "Definition is too short, too literal, or lacks usage nuance.",
      });
      continue;
    }

    seen.add(key);
    vocab.push({ word, ...(surface && surface !== word ? { surface } : {}), definition, ...(type ? { type } : {}) });
  }

  return { vocab, issues };
}
