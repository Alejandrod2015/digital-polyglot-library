export type LanguageVariant =
  | "latam"
  | "spain"
  | "us"
  | "uk"
  | "brazil"
  | "portugal"
  | "germany"
  | "austria"
  | "france"
  | "canada-fr"
  | "italy";

export const VARIANT_LABELS: Record<LanguageVariant, string> = {
  latam: "LATAM",
  spain: "Spain",
  us: "US",
  uk: "UK",
  brazil: "Brazil",
  portugal: "Portugal",
  germany: "Germany",
  austria: "Austria",
  france: "France",
  "canada-fr": "Canada",
  italy: "Italy",
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

  return null;
}

export function resolveContentVariant(args: {
  language?: string | null;
  variant?: string | null;
  region?: string | null;
}): string | null {
  return normalizeVariant(args.variant) ?? inferVariantFromRegion(args.language, args.region);
}
