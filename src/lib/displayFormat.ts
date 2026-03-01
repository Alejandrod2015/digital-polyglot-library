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
