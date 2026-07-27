export type LanguageVariant =
  | "latam"
  | "spain"
  | "mexico"
  | "colombia"
  | "argentina"
  | "peru"
  | "chile"
  | "us"
  | "uk"
  | "brazil"
  | "portugal"
  | "germany"
  | "austria"
  | "france"
  | "canada-fr"
  | "italy"
  | "south-korea";

export const VARIANT_LABELS: Record<LanguageVariant, string> = {
  latam: "LATAM",
  spain: "Spain",
  mexico: "Mexico",
  colombia: "Colombia",
  argentina: "Argentina",
  peru: "Peru",
  chile: "Chile",
  us: "US",
  uk: "UK",
  brazil: "Brazil",
  portugal: "Portugal",
  germany: "Germany",
  austria: "Austria",
  france: "France",
  "canada-fr": "Canada",
  italy: "Italy",
  "south-korea": "South Korea",
};

export const VARIANT_OPTIONS_BY_LANGUAGE: Record<string, Array<{ value: LanguageVariant; label: string }>> = {
  spanish: [
    { value: "latam", label: "LATAM" },
    { value: "spain", label: "Spain" },
  ],
  english: [
    { value: "us", label: "US" },
    { value: "uk", label: "UK" },
  ],
  portuguese: [
    { value: "brazil", label: "Brazil" },
    { value: "portugal", label: "Portugal" },
  ],
  german: [
    { value: "germany", label: "Germany" },
    { value: "austria", label: "Austria" },
  ],
  french: [
    { value: "france", label: "France" },
    { value: "canada-fr", label: "Canada" },
  ],
  italian: [{ value: "italy", label: "Italy" }],
  korean: [{ value: "south-korea", label: "South Korea" }],
};

export function normalizeVariant(value?: string | null): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  return normalized;
}

export function formatVariantLabel(value?: string | null): string | null {
  const normalized = normalizeVariant(value);
  if (!normalized) return null;
  return VARIANT_LABELS[normalized as LanguageVariant] ?? normalized.toUpperCase();
}

// ── Per-topic country for pan-regional (LATAM) journeys ─────────────────────
// The two `latam` Spanish journeys are a "tour" of Latin America: every topic
// is set wholly in one country (Traveler by explicit place, Friends by the
// dialect/slang of its stories). When that's the case the topic panel shows
// that country as a LABEL. Country-specific journeys (mexico/colombia/…) don't
// need this — every topic is already that country. Keyed by topic slug; only
// consulted for `variant === "latam"`, and the 14 slugs are unique across the
// two journeys. (Confirmed with the user 2026-07-27; see the story content.)
const LATAM_TOPIC_COUNTRY: Record<string, LanguageVariant> = {
  // Friends (C1) — by dialect
  "el-cotorreo": "mexico",
  "la-carrilla": "mexico",
  "el-chisme": "colombia",
  "la-vacilada": "colombia",
  "el-desahogo": "argentina",
  "la-jerga": "peru",
  "el-weveo": "chile",
  // Traveler (A0) — by explicit setting
  "food-everyday-life": "mexico",
  "home-family": "colombia", // Cartagena setting; the uncle in Argentina is only referenced
  "meeting-new-people": "argentina",
  "places-getting-around": "peru",
  "community-celebrations": "colombia",
  "nature-adventure": "chile",
  "legends-folklore": "mexico",
};

/**
 * The specific country a topic is wholly set in, for pan-regional LATAM
 * journeys. Returns a variant code (e.g. "colombia") or null when the journey
 * isn't `latam` or the topic isn't country-specific.
 */
export function topicCountryVariant(
  journeyVariant?: string | null,
  topicSlug?: string | null
): LanguageVariant | null {
  if ((journeyVariant ?? "").trim().toLowerCase() !== "latam") return null;
  const key = (topicSlug ?? "").trim().toLowerCase();
  return LATAM_TOPIC_COUNTRY[key] ?? null;
}

/** Display label ("Colombia", "Peru", …) for a topic's country, or null. */
export function topicCountryLabel(
  journeyVariant?: string | null,
  topicSlug?: string | null
): string | null {
  const variant = topicCountryVariant(journeyVariant, topicSlug);
  return variant ? VARIANT_LABELS[variant] : null;
}

export function buildVariantPromptClause(language?: string | null, variant?: string | null): string {
  const normalizedVariant = normalizeVariant(variant);
  if (!normalizedVariant) return "";

  const label = formatVariantLabel(normalizedVariant);
  if (!label) return "";

  const normalizedLanguage = (language ?? "").trim().toLowerCase();
  if (normalizedLanguage === "spanish" || normalizedLanguage === "español") {
    if (normalizedVariant === "latam") {
      return "Use a Latin American Spanish baseline unless the region implies something more specific.";
    }
    if (normalizedVariant === "spain") {
      return "Use Peninsular Spanish as the default variety.";
    }
  }

  return `Use the ${label} variety as the default language baseline.`;
}

export function inferVariantFromRegion(language?: string | null, region?: string | null): string | null {
  const normalizedLanguage = (language ?? "").trim().toLowerCase();
  const normalizedRegion = (region ?? "").trim().toLowerCase();
  if (!normalizedLanguage || !normalizedRegion) return null;

  if (normalizedLanguage === "spanish" || normalizedLanguage === "español") {
    if (normalizedRegion === "spain" || normalizedRegion === "españa") return "spain";
    return "latam";
  }

  if (normalizedLanguage === "english") {
    if (["us", "usa", "united states", "canada"].includes(normalizedRegion)) return "us";
    if (["uk", "united kingdom", "england", "scotland", "ireland", "wales", "australia"].includes(normalizedRegion)) return "uk";
  }

  if (normalizedLanguage === "portuguese" || normalizedLanguage === "portugués") {
    if (normalizedRegion === "brazil" || normalizedRegion === "brasil") return "brazil";
    if (normalizedRegion === "portugal") return "portugal";
  }

  if (normalizedLanguage === "german" || normalizedLanguage === "alemán") {
    if (normalizedRegion === "austria") return "austria";
    if (["germany", "deutschland", "switzerland", "suiza"].includes(normalizedRegion)) return "germany";
  }

  if (normalizedLanguage === "french" || normalizedLanguage === "francés") {
    if (normalizedRegion === "canada") return "canada-fr";
    if (["france", "belgium", "belgica", "switzerland", "suiza"].includes(normalizedRegion)) return "france";
  }

  if (normalizedLanguage === "italian" || normalizedLanguage === "italiano") {
    return "italy";
  }

  if (normalizedLanguage === "korean" || normalizedLanguage === "coreano") {
    return "south-korea";
  }

  return null;
}

export function resolveContentVariant(args: {
  language?: string | null;
  variant?: string | null;
  region?: string | null;
}): string | null {
  return normalizeVariant(args.variant) ?? inferVariantFromRegion(args.language, args.region);
}
