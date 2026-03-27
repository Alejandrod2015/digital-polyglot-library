export const VOCAB_TYPE_ORDER = [
  "verb",
  "noun",
  "adjective",
  "adverb",
  "expression",
  "other",
] as const;

export type VocabTypeKey = (typeof VOCAB_TYPE_ORDER)[number];

const VOCAB_TYPE_ALIASES: Record<string, VocabTypeKey> = {
  verb: "verb",
  verbs: "verb",
  verbo: "verb",
  verbos: "verb",
  noun: "noun",
  nouns: "noun",
  sustantivo: "noun",
  sustantivos: "noun",
  adjective: "adjective",
  adjectives: "adjective",
  adjetivo: "adjective",
  adjetivos: "adjective",
  adverb: "adverb",
  adverbs: "adverb",
  adverbio: "adverb",
  adverbios: "adverb",
  expression: "expression",
  expressions: "expression",
  phrase: "expression",
  phrases: "expression",
  idiom: "expression",
  idioms: "expression",
  collocation: "expression",
  collocations: "expression",
  expresion: "expression",
  expresiones: "expression",
  other: "other",
  unknown: "other",
  misc: "other",
  vocabulary: "other",
};

const VOCAB_TYPE_LABELS: Record<VocabTypeKey, string> = {
  verb: "Verb",
  noun: "Noun",
  adjective: "Adjective",
  adverb: "Adverb",
  expression: "Expression",
  other: "Other",
};

function compact(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function inferVocabTypeFromWordAndDefinition(word?: string, definition?: string): VocabTypeKey | null {
  const normalizedWord = typeof word === "string" ? compact(word).toLowerCase() : "";
  const normalizedDef = typeof definition === "string" ? compact(definition).toLowerCase() : "";

  if (normalizedWord.includes(" ") || normalizedWord.includes("-")) return "expression";
  if (normalizedDef.startsWith("to ")) return "verb";
  if (/^(a|an|the)\s+/.test(normalizedDef)) return "noun";
  if (normalizedWord.endsWith("ly")) return "adverb";

  return null;
}

export function normalizeVocabType(raw?: string | null, context?: { word?: string; definition?: string }): VocabTypeKey | null {
  const value = typeof raw === "string" ? compact(raw).toLowerCase() : "";
  if (value) {
    const mapped = VOCAB_TYPE_ALIASES[value];
    if (mapped) return mapped;
  }

  return inferVocabTypeFromWordAndDefinition(context?.word, context?.definition);
}

export function getVocabTypeLabel(type?: string | null): string {
  const normalized = normalizeVocabType(type) ?? "other";
  return VOCAB_TYPE_LABELS[normalized];
}
