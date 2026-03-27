import { normalizeToken } from "@/lib/vocabSelection";

type NormalizeVocabWordArgs = {
  word: string;
  surface?: string;
  type?: string;
  language?: string;
};

function capitalizeGermanToken(token: string): string {
  return token
    .split("-")
    .map((segment) => {
      const trimmed = segment.trim();
      if (!trimmed) return trimmed;
      return trimmed[0].toLocaleUpperCase("de-DE") + trimmed.slice(1).toLocaleLowerCase("de-DE");
    })
    .join("-");
}

function normalizeGermanNoun(word: string): string {
  return word
    .split(/\s+/)
    .filter(Boolean)
    .map(capitalizeGermanToken)
    .join(" ");
}

export function normalizeVocabSurface(args: NormalizeVocabWordArgs): string {
  return args.word.replace(/\s+/g, " ").trim();
}

function normalizeProposedLemma(args: NormalizeVocabWordArgs): string {
  const rawWord = normalizeVocabSurface(args);
  if (!rawWord) return rawWord;

  const language = normalizeToken(args.language ?? "");
  const type = normalizeToken(args.type ?? "");

  if (language === "german") {
    if (type === "noun") return normalizeGermanNoun(rawWord);
    return rawWord.toLocaleLowerCase("de-DE");
  }

  if (language === "english") {
    return rawWord.toLowerCase();
  }

  return rawWord;
}

function lemmatizeGermanVerb(word: string): string {
  const lower = word.toLocaleLowerCase("de-DE");
  if (lower.endsWith("en")) return lower;

  const candidates = new Set<string>();
  if (lower.length > 4 && /(te|test|tet|ten)$/i.test(lower)) {
    candidates.add(lower.replace(/(te|test|tet|ten)$/i, "en"));
  }
  if (lower.length > 4 && /(st|t)$/i.test(lower)) {
    candidates.add(lower.replace(/(st|t)$/i, "en"));
  }

  return [...candidates].find((candidate) => candidate.length >= 4) ?? lower;
}

function lemmatizeEnglishVerb(word: string): string {
  const lower = word.toLowerCase();
  if (lower.length > 4 && lower.endsWith("ing")) {
    const base = lower.slice(0, -3);
    return /[aeiou][^aeiou]$/.test(base) ? base.slice(0, -1) : `${base}e`;
  }
  if (lower.length > 3 && lower.endsWith("ied")) {
    return `${lower.slice(0, -3)}y`;
  }
  if (lower.length > 3 && lower.endsWith("ed")) {
    const base = lower.slice(0, -2);
    return `${base}e`;
  }
  if (lower.length > 3 && lower.endsWith("ies")) {
    return `${lower.slice(0, -3)}y`;
  }
  if (lower.length > 3 && lower.endsWith("es")) {
    return lower.slice(0, -2);
  }
  if (lower.length > 2 && lower.endsWith("s")) {
    return lower.slice(0, -1);
  }
  return lower;
}

function inferLemmaFromSurface(args: NormalizeVocabWordArgs): string {
  const rawWord = normalizeVocabSurface({ word: args.surface ?? args.word });
  if (!rawWord) return rawWord;

  const language = normalizeToken(args.language ?? "");
  const type = normalizeToken(args.type ?? "");

  if (language === "german") {
    if (type === "noun") {
      return normalizeGermanNoun(rawWord);
    }

    if (type === "verb") {
      return lemmatizeGermanVerb(rawWord);
    }

    return rawWord.toLocaleLowerCase("de-DE");
  }

  if (language === "english" && type === "verb") {
    return lemmatizeEnglishVerb(rawWord);
  }

  return rawWord;
}

function looksLikeValidToken(word: string): boolean {
  return /^[\p{L}\p{M}][\p{L}\p{M}\s'’-]*$/u.test(word);
}

function looksLikeCanonicalVerb(lemma: string, language: string): boolean {
  const normalizedLanguage = normalizeToken(language);
  const lower = normalizedLanguage === "german" ? lemma.toLocaleLowerCase("de-DE") : lemma.toLowerCase();

  switch (normalizedLanguage) {
    case "german":
      return /(en|n)$/.test(lower) || ["sein", "haben", "werden", "tun"].includes(lower);
    case "spanish":
      return /(ar|er|ir)$/.test(lower);
    case "french":
      return /(er|ir|re|oir)$/.test(lower);
    case "italian":
      return /(are|ere|ire)$/.test(lower);
    case "portuguese":
      return /(ar|er|ir)$/.test(lower);
    case "english":
      return !/(ing|ed|ies)$/.test(lower) && !(lower.endsWith("s") && lower.length > 4);
    default:
      return true;
  }
}

function isPlausibleModelLemma(args: {
  proposedWord: string;
  surface: string;
  type?: string;
  language?: string;
}): boolean {
  const proposed = args.proposedWord.trim();
  const surface = args.surface.trim();
  const type = normalizeToken(args.type ?? "");
  const language = normalizeToken(args.language ?? "");

  if (!proposed || !surface) return false;
  if (!looksLikeValidToken(proposed)) return false;
  if (proposed.split(/\s+/).filter(Boolean).length !== surface.split(/\s+/).filter(Boolean).length) return false;

  if (type === "verb") {
    return looksLikeCanonicalVerb(proposed, language);
  }

  if (type === "expression") {
    return true;
  }

  return true;
}

export function resolveCanonicalVocabEntry(args: NormalizeVocabWordArgs): {
  word: string;
  surface: string;
} {
  const surface = normalizeVocabSurface({ word: args.surface ?? args.word });
  const proposedWord = normalizeProposedLemma({ word: args.word, type: args.type, language: args.language });

  if (!surface && !proposedWord) {
    return { word: "", surface: "" };
  }

  const fallbackWord = inferLemmaFromSurface({
    word: surface || proposedWord,
    surface,
    type: args.type,
    language: args.language,
  });

  const word = isPlausibleModelLemma({
    proposedWord,
    surface: surface || proposedWord,
    type: args.type,
    language: args.language,
  })
    ? proposedWord
    : fallbackWord;

  return { word, surface: surface || proposedWord };
}

export function normalizeVocabWord(args: NormalizeVocabWordArgs): string {
  return resolveCanonicalVocabEntry(args).word;
}
