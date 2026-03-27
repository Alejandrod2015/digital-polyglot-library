import { normalizeToken, splitWordTokens } from "@/lib/vocabSelection";

type LowValueArgs = {
  word: string;
  language?: string;
  level?: string;
  cefrLevel?: string;
  type?: string;
};

const FUNCTION_WORDS_BY_LANGUAGE: Record<string, Set<string>> = {
  spanish: new Set([
    "el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del", "al", "y", "o", "u",
    "que", "en", "con", "sin", "por", "para", "como", "pero", "porque", "si", "no", "ya",
    "muy", "mas", "más", "se", "me", "te", "le", "les", "lo", "su", "sus", "mi", "mis",
  ]),
  german: new Set([
    "der", "die", "das", "den", "dem", "des", "ein", "eine", "einen", "einem", "einer",
    "und", "oder", "aber", "nicht", "mit", "ohne", "für", "fur", "von", "vom", "zum", "zur",
    "bei", "als", "auch", "noch", "schon", "weil", "wenn", "dann", "hier", "dort", "im",
    "am", "an", "auf", "in", "aus", "zu", "sich", "selbst", "sein", "seine", "seiner",
    "seinen", "ihr", "ihre", "ihren",
  ]),
  english: new Set([
    "the", "a", "an", "and", "or", "but", "with", "without", "for", "from", "into", "onto",
    "of", "to", "in", "on", "at", "by", "as", "is", "are", "was", "were", "be", "been",
    "being", "that", "this", "these", "those", "their", "there", "have", "has", "had",
  ]),
  french: new Set([
    "le", "la", "les", "un", "une", "des", "du", "de", "et", "ou", "avec", "sans", "pour",
    "par", "dans", "sur", "sous", "mais", "que", "qui", "comme", "est", "sont", "etre",
    "être", "avoir", "son", "sa", "ses", "se",
  ]),
  italian: new Set([
    "il", "lo", "la", "i", "gli", "le", "un", "una", "e", "o", "con", "senza", "per", "da",
    "di", "del", "della", "dello", "nel", "nella", "sul", "sulla", "che", "come", "ma",
    "essere", "avere", "si", "suo", "sua", "suoi", "sue",
  ]),
  portuguese: new Set([
    "o", "a", "os", "as", "um", "uma", "uns", "umas", "e", "ou", "com", "sem", "por", "para",
    "de", "do", "da", "dos", "das", "que", "como", "mas", "ser", "estar", "se", "seu",
    "sua", "seus", "suas",
  ]),
};

const CORE_VERBS_BY_LANGUAGE: Record<string, Set<string>> = {
  spanish: new Set(["ser", "estar", "tener", "hacer", "ir", "decir", "dar", "ver"]),
  german: new Set(["sein", "haben", "machen", "gehen", "kommen", "sagen", "nehmen", "finden"]),
  english: new Set(["be", "have", "make", "go", "come", "say", "take", "find"]),
  french: new Set(["etre", "être", "avoir", "faire", "aller", "dire", "prendre", "venir"]),
  italian: new Set(["essere", "avere", "fare", "andare", "dire", "prendere", "venire"]),
  portuguese: new Set(["ser", "estar", "ter", "fazer", "ir", "dizer", "dar", "ver"]),
};

function isIntermediateOrHigher(level?: string, cefrLevel?: string): boolean {
  const normalizedCefr = normalizeToken(cefrLevel ?? "");
  if (normalizedCefr) {
    return !["a1", "a2"].includes(normalizedCefr);
  }
  const normalizedLevel = normalizeToken(level ?? "");
  return normalizedLevel === "intermediate" || normalizedLevel === "advanced";
}

function lemmaCandidates(word: string, language?: string): string[] {
  const normalized = normalizeToken(word);
  if (!normalized) return [];

  const candidates = new Set<string>([normalized]);
  const normalizedLanguage = normalizeToken(language ?? "");

  if (normalizedLanguage === "german") {
    if (normalized.length > 3 && /(te|test|tet|ten)$/i.test(normalized)) {
      candidates.add(normalized.replace(/(te|test|tet|ten)$/i, "en"));
    }
    if (normalized.length > 3 && /(e|st|t)$/i.test(normalized)) {
      candidates.add(normalized.replace(/(e|st|t)$/i, "en"));
    }
  }

  if (normalizedLanguage === "english") {
    if (normalized.length > 4 && /ing$/i.test(normalized)) {
      candidates.add(normalized.replace(/ing$/i, ""));
      candidates.add(`${normalized.replace(/ing$/i, "")}e`);
    }
    if (normalized.length > 3 && /ed$/i.test(normalized)) {
      candidates.add(normalized.replace(/ed$/i, ""));
      candidates.add(`${normalized.replace(/ed$/i, "")}e`);
    }
    if (normalized.length > 3 && /es$/i.test(normalized)) {
      candidates.add(normalized.replace(/es$/i, ""));
    }
    if (normalized.length > 2 && /s$/i.test(normalized)) {
      candidates.add(normalized.replace(/s$/i, ""));
    }
  }

  return [...candidates].filter(Boolean);
}

export function isLowValueStudyWord(args: LowValueArgs): boolean {
  const normalizedLanguage = normalizeToken(args.language ?? "");
  const functionWords = FUNCTION_WORDS_BY_LANGUAGE[normalizedLanguage] ?? new Set<string>();
  const coreVerbs = CORE_VERBS_BY_LANGUAGE[normalizedLanguage] ?? new Set<string>();
  const normalizedType = normalizeToken(args.type ?? "");
  const tokens = splitWordTokens(args.word);

  if (tokens.length === 0) return false;
  if (normalizedType === "expression") return false;

  if (tokens.every((token) => functionWords.has(token))) {
    return true;
  }

  if (tokens.length !== 1) return false;

  const token = tokens[0];
  if (functionWords.has(token)) {
    return true;
  }

  if (!isIntermediateOrHigher(args.level, args.cefrLevel)) {
    return false;
  }

  return lemmaCandidates(token, normalizedLanguage).some((candidate) => coreVerbs.has(candidate));
}
