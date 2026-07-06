export const VOCAB_TYPE_ORDER = [
  "verb",
  "noun",
  "adjective",
  "adverb",
  "pronoun",
  "preposition",
  "conjunction",
  "article",
  "number",
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
  slang: "expression",
  argot: "expression",
  jerga: "expression",
  pronoun: "pronoun",
  pronouns: "pronoun",
  pronombre: "pronoun",
  pronombres: "pronoun",
  preposition: "preposition",
  prepositions: "preposition",
  preposicion: "preposition",
  "preposición": "preposition",
  preposiciones: "preposition",
  conjunction: "conjunction",
  conjunctions: "conjunction",
  conjuncion: "conjunction",
  "conjunción": "conjunction",
  conjunciones: "conjunction",
  article: "article",
  articles: "article",
  artikel: "article",
  articulo: "article",
  "artículo": "article",
  articulos: "article",
  determiner: "article",
  determiners: "article",
  number: "number",
  numbers: "number",
  numeral: "number",
  numerals: "number",
  numero: "number",
  "número": "number",
  numeros: "number",
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
  pronoun: "Pronoun",
  preposition: "Preposition",
  conjunction: "Conjunction",
  article: "Article",
  number: "Number",
  expression: "Expression",
  other: "Other",
};

// Registro de uso (dimensión ortogonal al tipo gramatical, 2026-07-06):
// marca CUÁNDO usar la palabra, no qué es. "slang" dejó de ser un type
// (alias -> expression) y pasó a ser un register. Mantener la lista corta
// a propósito (regla del usuario: opciones simples).
export const VOCAB_REGISTER_ORDER = [
  "colloquial",
  "slang",
  "formal",
  "regional",
  "vulgar",
] as const;

export type VocabRegisterKey = (typeof VOCAB_REGISTER_ORDER)[number];

const VOCAB_REGISTER_ALIASES: Record<string, VocabRegisterKey> = {
  colloquial: "colloquial",
  coloquial: "colloquial",
  informal: "colloquial",
  umgangssprachlich: "colloquial",
  slang: "slang",
  argot: "slang",
  jerga: "slang",
  formal: "formal",
  official: "formal",
  amtsdeutsch: "formal",
  regional: "regional",
  dialect: "regional",
  vulgar: "vulgar",
  offensive: "vulgar",
};

const VOCAB_REGISTER_LABELS: Record<VocabRegisterKey, string> = {
  colloquial: "Colloquial",
  slang: "Slang",
  formal: "Formal",
  regional: "Regional",
  vulgar: "Vulgar",
};

export function normalizeVocabRegister(raw?: string | null): VocabRegisterKey | null {
  if (!raw) return null;
  return VOCAB_REGISTER_ALIASES[raw.trim().toLowerCase()] ?? null;
}

export function getVocabRegisterLabel(key: VocabRegisterKey): string {
  return VOCAB_REGISTER_LABELS[key];
}

function compact(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

// Sufijos españoles que identifican un tipo gramatical con alta
// confianza. Se evalúan después de los heurísticos de la definición
// (que tienen más señal cuando la definición empieza con "to" o un
// artículo).
const SPANISH_NOUN_SUFFIXES = [
  "ción", "sión", "dad", "tad", "tud", "aje", "anza", "encia", "ancia",
  "miento", "ismo", "ista", "ería", "ero", "era", "azo", "ote",
];
const SPANISH_ADJECTIVE_SUFFIXES = [
  "oso", "osa", "ivo", "iva", "able", "ible", "iento", "ienta",
];
const SPANISH_VERB_INFINITIVE = /(?:ar|er|ir)$/;

export function inferVocabTypeFromWordAndDefinition(word?: string, definition?: string): VocabTypeKey | null {
  const normalizedWord = typeof word === "string" ? compact(word).toLowerCase() : "";
  const normalizedDef = typeof definition === "string" ? compact(definition).toLowerCase() : "";

  // Multi-word entries are always expressions, sin importar la definición.
  if (normalizedWord.includes(" ") || normalizedWord.includes("-")) return "expression";

  // Señal por la forma de la definición (más confiable cuando existe).
  if (normalizedDef.startsWith("to ")) return "verb";
  if (/^(a|an|the)\s+/.test(normalizedDef)) return "noun";

  // Adverbios: -ly (inglés) / -mente (español).
  if (normalizedWord.endsWith("ly") || normalizedWord.endsWith("mente")) return "adverb";

  // Sufijos españoles inequívocos (alta precisión, sin ambigüedad).
  if (SPANISH_NOUN_SUFFIXES.some((s) => normalizedWord.endsWith(s))) return "noun";
  if (SPANISH_ADJECTIVE_SUFFIXES.some((s) => normalizedWord.endsWith(s))) return "adjective";

  // Verbos en infinitivo: -ar, -er, -ir con al menos 4 letras para evitar
  // falsos positivos en monosílabos comunes (sustantivos cortos como
  // "mar", "ver", "sur" caerían acá pero no son verbos en infinitivo).
  if (normalizedWord.length >= 4 && SPANISH_VERB_INFINITIVE.test(normalizedWord)) {
    return "verb";
  }

  // Si llegamos hasta acá y tenemos definición, la mayoría del vocab de
  // libros son sustantivos comunes (objetos, lugares, conceptos). Es
  // mejor adivinar "noun" que caer al gris genérico de "other". Para
  // entradas sin definición devolvemos null y dejamos que el caller
  // decida (ej. caer a "other").
  if (normalizedDef.length > 3) return "noun";

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
