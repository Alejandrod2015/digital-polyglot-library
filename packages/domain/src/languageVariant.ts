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

// ── Content pools ──────────────────────────────────────────────────────────
// Which content a learner should be OFFERED, given the variant they asked for.
// Only Spanish has a pan-regional pool: a `latam` journey tours the region and
// the country-specific ones (mexico, colombia, ...) read as the same Spanish to
// a LATAM learner. Spain sits alone, which is the entire reason the question is
// asked at signup. Every other language matches its own variant exactly.
//
// WHY (2026-08-20): `targetVariant` was collected at signup and then used
// nowhere. A beta tester who asked for Spain because he has a holiday home
// there was offered the LATAM C1 Friends journey in the same list as his A0
// Spain one, opened two of its stories, and wrote in: "I had a bit too much
// Mexican Spanish including slang [...] I don't want to be misunderstood by
// Spanish locals when I try to converse."
function poolOf(pool: string, spellings: readonly string[]): Record<string, string> {
  return Object.fromEntries(spellings.map((spelling) => [spelling, pool]));
}

const SPANISH_LATAM_POOL = [
  "latam",
  "mexico",
  "colombia",
  "argentina",
  "peru",
  "chile",
  "puerto-rico",
  "panama",
  "ecuador",
  "dominican-republic",
  "venezuela",
  "cuba",
  "bolivia",
  "uruguay",
  "paraguay",
  "costa-rica",
  "guatemala",
  "honduras",
  "el-salvador",
  "nicaragua",
] as const;

// The same pool reached by every spelling that is already persisted somewhere:
// Studio writes country names ("spain", "brazil"), the mobile picker writes
// short codes ("es", "br"), and legacy rows hold locale tags. A spelling missing
// from here matches nothing and the content disappears in silence, which is
// exactly how Brazil broke once before (see LanguageFlag.regionFamily).
const VARIANT_POOL: Record<string, string> = {
  ...poolOf("spanish-spain", ["spain", "es", "espana", "españa"]),
  ...poolOf("spanish-latam", [
    ...SPANISH_LATAM_POOL,
    "es-la",
    "es-419",
    "mx",
    "co",
    "ar",
    "pe",
    "cl",
    "ec",
    "ve",
    "uy",
    "py",
    "bo",
    "cr",
    "pa",
    "do",
    "cu",
    "gt",
    "hn",
    "sv",
    "ni",
    "pr",
  ]),
  ...poolOf("english-us", ["us", "usa", "en-us"]),
  ...poolOf("english-uk", ["uk", "gb", "england", "britain", "united-kingdom", "en-gb"]),
  ...poolOf("portuguese-brazil", ["brazil", "brasil", "br", "pt-br"]),
  ...poolOf("portuguese-portugal", ["portugal", "pt", "pt-pt"]),
  ...poolOf("german-germany", ["germany", "de", "deutschland"]),
  ...poolOf("german-austria", ["austria", "at"]),
  ...poolOf("french-france", ["france", "fr"]),
  ...poolOf("french-canada", ["canada-fr", "ca-fr", "fr-ca"]),
  ...poolOf("italian-italy", ["italy", "it", "italia"]),
  ...poolOf("korean-south-korea", ["south-korea", "kr", "ko-kr"]),
};

/**
 * The content pool a variant belongs to, or null for values we do not model
 * ("other", "unsure", a free-typed country). A null pool means "no preference
 * we can act on", never "show nothing".
 */
export function variantPool(value?: string | null): string | null {
  const normalized = normalizeVariant(value);
  if (!normalized) return null;
  return VARIANT_POOL[normalized] ?? null;
}

/**
 * Does this piece of content belong to the pool the learner asked for?
 * Returns true whenever the preference is unknown or unmodelled, so an
 * unrecognised value can never empty somebody's library.
 */
export function variantMatchesPreference(
  preference?: string | null,
  contentVariant?: string | null
): boolean {
  const wanted = variantPool(preference);
  if (!wanted) return true;
  const got = variantPool(contentVariant);
  if (!got) return true;
  return wanted === got;
}

/**
 * The language a variant belongs to ("spanish", "german", ...), so a stale
 * preference from another language is ignored instead of filtering everything
 * out. Returns null for unmodelled values.
 */
export function languageOfVariant(value?: string | null): string | null {
  const pool = variantPool(value);
  if (!pool) return null;
  return pool.slice(0, pool.indexOf("-"));
}
