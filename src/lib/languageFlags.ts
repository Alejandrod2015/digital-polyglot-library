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
  latam: "🇨🇴",
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
  // Variant only wins when it belongs to this language (see getLanguageCountry).
  if (variant && isVariantValidForLanguage(variant, language)) {
    const byVariant = FLAG_BY_VARIANT[variant];
    if (byVariant) return byVariant;
  }
  const key = Object.keys(DEFAULT_FLAG_BY_LANGUAGE).find(
    (k) => k.toLowerCase() === language.toLowerCase(),
  );
  if (key) return DEFAULT_FLAG_BY_LANGUAGE[key];
  return "🌐";
}

// ISO 3166-1 alpha-2 COUNTRY codes for the inline-SVG <Flag/> component.
// Parallel to the emoji maps above, but returns a country code instead of an
// emoji so flags render on every device (emoji flags break on Windows etc.).
const COUNTRY_BY_VARIANT: Record<string, string> = {
  latam: "CO", spain: "ES", us: "US", uk: "GB", brazil: "BR", portugal: "PT",
  germany: "DE", austria: "AT", france: "FR", "canada-fr": "CA", italy: "IT",
  "south-korea": "KR",
};
const DEFAULT_COUNTRY_BY_LANGUAGE: Record<string, string> = {
  English: "US", Spanish: "ES", French: "FR", German: "DE", Italian: "IT",
  Portuguese: "PT", Japanese: "JP", Korean: "KR", Chinese: "CN",
};

/**
 * Best-effort ISO 3166-1 alpha-2 country code for a (language, variant) pair,
 * for feeding the inline-SVG <Flag/> component. Variant wins; otherwise the
 * canonical country for the language. Returns "" when unknown (Flag then
 * renders nothing / a code fallback).
 */
export function getLanguageCountry(language: string, variant?: string | null): string {
  // Only honor the variant if it actually belongs to this language. A stale
  // cross-language variant (e.g. preferredVariant="latam" left over from
  // Spanish while the active language is German) must NOT pick the flag —
  // that produced a Colombia flag next to a "DE" code. Fall back to the
  // language's canonical country instead.
  if (variant && isVariantValidForLanguage(variant, language)) {
    const byVariant = COUNTRY_BY_VARIANT[variant];
    if (byVariant) return byVariant;
  }
  const key = Object.keys(DEFAULT_COUNTRY_BY_LANGUAGE).find(
    (k) => k.toLowerCase() === language.toLowerCase(),
  );
  return key ? DEFAULT_COUNTRY_BY_LANGUAGE[key] : "";
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
// DB stores.
//
// CRITICAL: NEVER derive the ISO code by slicing the full word. The
// slice approach silently produces wrong codes for the languages where
// ISO 639-1 doesn't match the English name's first letters:
//   "spanish".slice(0,2)    → "sp"  (should be ES)
//   "german".slice(0,2)     → "ge"  (should be DE)
//   "portuguese".slice(0,2) → "po"  (should be PT)
//   "chinese".slice(0,2)    → "ch"  (should be ZH)
//   "japanese".slice(0,2)   → "ja"  ✓ accidentally correct
// Always use the lookup table below. If a new language is added,
// extend the table — don't fall back to slicing.
const ISO_BY_LANGUAGE: Record<string, string> = {
  // English keys (catalog / app surface)
  english: "EN",
  spanish: "ES",
  french: "FR",
  german: "DE",
  italian: "IT",
  portuguese: "PT",
  japanese: "JA",
  korean: "KO",
  chinese: "ZH",
  // Spanish-localized aliases. Studio DB `Language.label` stores names
  // in Spanish ("Italiano", "Alemán", …) and JourneyManager passes that
  // label directly. Without these the tag falls to "??".
  inglés: "EN",
  ingles: "EN",
  español: "ES",
  espanol: "ES",
  francés: "FR",
  frances: "FR",
  alemán: "DE",
  aleman: "DE",
  italiano: "IT",
  portugués: "PT",
  portugues: "PT",
  japonés: "JA",
  japones: "JA",
  coreano: "KO",
  chino: "ZH",
};

/**
 * Compact ISO 639-1 two-letter tag for a language name or slug.
 * Returns "??" for unknown languages so a future "SP" doesn't sneak in
 * via string slicing — extend ISO_BY_LANGUAGE explicitly when adding a
 * new language to the catalog.
 */
export function getIsoLanguageTag(language: string | null | undefined): string {
  if (!language) return "??";
  const key = language.toLowerCase().trim();
  return ISO_BY_LANGUAGE[key] ?? "??";
}
