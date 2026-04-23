import { formatVariantLabel, VARIANT_OPTIONS_BY_LANGUAGE } from "./languageVariant";
import { CEFR_LEVEL_LABELS, LEVEL_LABELS, type CefrLevel, type Level } from "./types/books";

const FALLBACK = "—";

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function toTitleCase(value?: string, fallback = FALLBACK): string {
  if (!value) return fallback;
  const trimmed = normalizeWhitespace(value);
  if (!trimmed) return fallback;

  const lower = trimmed.toLowerCase();
  return lower.replace(/(^|[\s/-])([a-zà-ÿ])/g, (match) => match.toUpperCase());
}

export function formatLanguage(value?: string): string {
  if (!value) return FALLBACK;
  const normalized = normalizeWhitespace(value).toLowerCase();

  const table: Record<string, string> = {
    english: "English",
    ingles: "English",
    "inglés": "English",
    spanish: "Spanish",
    espanol: "Spanish",
    "español": "Spanish",
    french: "French",
    frances: "French",
    "francés": "French",
    german: "German",
    aleman: "German",
    "alemán": "German",
    italian: "Italian",
    italiano: "Italian",
    portuguese: "Portuguese",
    portugues: "Portuguese",
    "portugués": "Portuguese",
    japanese: "Japanese",
    japones: "Japanese",
    "japonés": "Japanese",
    korean: "Korean",
    chinese: "Chinese",
    russian: "Russian",
    arabic: "Arabic",
    dutch: "Dutch",
    polish: "Polish",
    turkish: "Turkish",
  };

  return table[normalized] ?? toTitleCase(value);
}

export function formatLanguageCode(value?: string): string {
  const normalized = (value ?? "").toLowerCase().trim();
  if (!normalized) return FALLBACK;

  const table: Record<string, string> = {
    spanish: "ES",
    espanol: "ES",
    "español": "ES",
    english: "EN",
    ingles: "EN",
    "inglés": "EN",
    italian: "IT",
    italiano: "IT",
    german: "DE",
    aleman: "DE",
    "alemán": "DE",
    french: "FR",
    frances: "FR",
    "francés": "FR",
    portuguese: "PT",
    portugues: "PT",
    "portugués": "PT",
    japanese: "JA",
    japones: "JA",
    "japonés": "JA",
    korean: "KO",
    chinese: "ZH",
    russian: "RU",
    arabic: "AR",
    dutch: "NL",
    polish: "PL",
    turkish: "TR",
  };

  if (table[normalized]) return table[normalized];
  if (normalized.length >= 2) return normalized.slice(0, 2).toUpperCase();
  return normalized.toUpperCase();
}

export function formatTopic(value?: string): string {
  return toTitleCase(value);
}

export function formatRegion(value?: string): string {
  return toTitleCase(value);
}

/**
 * Formats a language/region pair for display, skipping the region half when
 * the language has only one variant configured (e.g. Italian → Italy, Korean
 * → South Korea). For those we show just the language name to avoid the
 * redundant-looking "Italian · Italy" / "Korean · South Korea".
 */
export function formatLanguageAndRegion(language?: string, region?: string): string {
  const lang = formatLanguage(language);
  if (!language) return lang;
  // Route through formatLanguage() first so Spanish/English aliases like
  // "italiano" or "alemán" still resolve to the canonical key.
  const canonicalKey = lang.toLowerCase();
  const variants = VARIANT_OPTIONS_BY_LANGUAGE[canonicalKey];
  const isSingleVariant = Array.isArray(variants) && variants.length <= 1;
  if (isSingleVariant) return lang;
  const regionLabel = formatRegion(region);
  if (!region || regionLabel === FALLBACK) return lang;
  return `${lang} · ${regionLabel}`;
}

export function formatVariant(value?: string): string {
  return formatVariantLabel(value) ?? FALLBACK;
}

export function formatLevel(value?: string): string {
  if (!value) return FALLBACK;
  const key = value.toLowerCase() as Level;
  if (key in LEVEL_LABELS) {
    return LEVEL_LABELS[key];
  }
  return toTitleCase(value);
}

export function formatCefrLevel(value?: string): string {
  if (!value) return FALLBACK;
  const key = value.toLowerCase() as CefrLevel;
  if (key in CEFR_LEVEL_LABELS) {
    return CEFR_LEVEL_LABELS[key];
  }
  return value.toUpperCase();
}
