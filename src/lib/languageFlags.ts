// Emoji flag mapping for the mobile language switcher. The mockup uses
// country-code flags ("de", "es-co"); the repo stores languages as full
// names ("German", "Spanish") and variants as our own enum ("germany",
// "spain", "latam"). We pick the flag from (language, variant) and fall
// back to the canonical country for the language if no variant is set.
//
// We intentionally keep this tiny — no flag library, no SVGs, just
// emoji. iOS/Android render them perfectly; desktop is not the target
// (the switcher is `md:hidden`).

import { VARIANT_OPTIONS_BY_LANGUAGE } from "@domain/languageVariant";

const DEFAULT_FLAG_BY_LANGUAGE: Record<string, string> = {
  English: "🇺🇸",
  Spanish: "🇪🇸",
  French: "🇫🇷",
  German: "🇩🇪",
  Italian: "🇮🇹",
  Portuguese: "🇵🇹",
  Japanese: "🇯🇵",
  Korean: "🇰🇷",
  Chinese: "🇨🇳",
};

const FLAG_BY_VARIANT: Record<string, string> = {
  latam: "🇲🇽",
  spain: "🇪🇸",
  us: "🇺🇸",
  uk: "🇬🇧",
  brazil: "🇧🇷",
  portugal: "🇵🇹",
  germany: "🇩🇪",
  austria: "🇦🇹",
  france: "🇫🇷",
  "canada-fr": "🇨🇦",
  italy: "🇮🇹",
  "south-korea": "🇰🇷",
};

/**
 * Best-effort flag for a (language, variant) pair. Variant wins when set;
 * otherwise we use the canonical flag for the language. Unknown pairs get
 * a globe so the row always renders something.
 */
export function getLanguageFlag(language: string, variant?: string | null): string {
  if (variant) {
    const byVariant = FLAG_BY_VARIANT[variant];
    if (byVariant) return byVariant;
  }
  const byLanguage = DEFAULT_FLAG_BY_LANGUAGE[language];
  if (byLanguage) return byLanguage;
  return "🌐";
}

/**
 * Returns true if the given variant is a valid pairing with the language
 * according to the canonical domain mapping. Used at switch-time to
 * decide whether to keep or clear `preferredVariant` in Clerk metadata.
 */
export function isVariantValidForLanguage(
  variant: string | null | undefined,
  language: string
): boolean {
  if (!variant) return true; // no variant set = always valid
  const options = VARIANT_OPTIONS_BY_LANGUAGE[language.toLowerCase()];
  if (!options) return false;
  return options.some((option) => option.value === variant);
}

// ISO 639-1 two-letter codes used by the editorial Studio surfaces
// (Journey Manager, Catalog Books) as compact lang tags. Maps both the
// canonical full name ("Spanish") and the slug form ("spanish") that the
// DB stores. NEVER use slice(0, 3) on the full name — produces nonsense
// like "SPA", "ITA", "POR".
const ISO_BY_LANGUAGE: Record<string, string> = {
  english: "EN",
  spanish: "ES",
  french: "FR",
  german: "DE",
  italian: "IT",
  portuguese: "PT",
  japanese: "JA",
  korean: "KO",
  chinese: "ZH",
};

/**
 * Compact ISO 639-1 two-letter tag for a language name or slug.
 * Returns "??" for unknown languages so callers never crash.
 */
export function getIsoLanguageTag(language: string | null | undefined): string {
  if (!language) return "??";
  const key = language.toLowerCase().trim();
  return ISO_BY_LANGUAGE[key] ?? language.slice(0, 2).toUpperCase();
}
