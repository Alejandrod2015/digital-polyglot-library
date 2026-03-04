import { LEVEL_LABELS, type Level } from "@/types/books";

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
  return toTitleCase(value);
}

export function formatLanguageCode(value?: string): string {
  const normalized = (value ?? "").toLowerCase().trim();
  if (!normalized) return "—";

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

export function formatLevel(value?: string): string {
  if (!value) return FALLBACK;
  const key = value.toLowerCase() as Level;
  if (key in LEVEL_LABELS) {
    return LEVEL_LABELS[key];
  }
  return toTitleCase(value);
}
