import { CEFR_LEVEL_LABELS, type CefrLevel, type Level } from "./types/books";

const BROAD_TO_CEFR_FALLBACK: Record<Level, CefrLevel> = {
  beginner: "a1",
  intermediate: "b1",
  advanced: "c1",
};

const CEFR_TO_BROAD_LEVEL: Record<CefrLevel, Level> = {
  a0: "beginner",
  a1: "beginner",
  a2: "beginner",
  b1: "intermediate",
  b2: "intermediate",
  c1: "advanced",
  c2: "advanced",
};

// User-facing friendly level names. The internal code (a0..c2) NEVER
// changes; only the label the learner sees. NEVER show raw CEFR codes
// ("A0", "Pre-A1", "Level 0") as the primary label; the codes are an
// optional secondary annotation and are omitted entirely for a0.
export const CEFR_DISPLAY_LABELS: Record<CefrLevel, string> = {
  a0: "Beginner",
  a1: "Elementary",
  a2: "Pre-Intermediate",
  b1: "Intermediate",
  b2: "Upper-Intermediate",
  c1: "Advanced",
  c2: "Mastery",
};

// Optional secondary CEFR annotation shown beside the friendly label.
// a0 has no CEFR code (A0 is not a real CEFR level) so it is null.
export const CEFR_CODE_ANNOTATION: Record<CefrLevel, string | null> = {
  a0: null,
  a1: "A1",
  a2: "A2",
  b1: "B1",
  b2: "B2",
  c1: "C1",
  c2: "C2",
};

// Framing subtitle for the zero-contact tier so "Beginner" doesn't imply
// prior exposure is expected.
export const CEFR_A0_FRAMING_SUBTITLE = "Start from zero; no experience needed";

/** Friendly user-facing label for a level code (e.g. "a1" → "Elementary"). */
export function cefrDisplayLabel(value?: string | null): string | null {
  const cefr = normalizeCefrLevel(value);
  return cefr ? CEFR_DISPLAY_LABELS[cefr] : null;
}

/** Optional secondary CEFR code annotation (null for a0 / unknown). */
export function cefrCodeAnnotation(value?: string | null): string | null {
  const cefr = normalizeCefrLevel(value);
  return cefr ? CEFR_CODE_ANNOTATION[cefr] : null;
}

/**
 * Single-string display combining the friendly label with the optional
 * CEFR code in parentheses, e.g. "Elementary (A1)". For a0 the code is
 * omitted → "Beginner". Falls back to the uppercased raw value when the
 * level isn't a known CEFR code.
 */
export function formatCefrDisplay(value?: string | null): string {
  const cefr = normalizeCefrLevel(value);
  if (!cefr) return (value ?? "").toUpperCase();
  const label = CEFR_DISPLAY_LABELS[cefr];
  const code = CEFR_CODE_ANNOTATION[cefr];
  return code ? `${label} (${code})` : label;
}

export function normalizeCefrLevel(value?: string | null): CefrLevel | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized in CEFR_LEVEL_LABELS) return normalized as CefrLevel;
  return null;
}

export function normalizeBroadLevel(value?: string | null): Level | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "basic" || normalized === "elementary" || normalized === "beginner") {
    return "beginner";
  }
  if (normalized === "intermediate") return "intermediate";
  if (normalized === "advanced") return "advanced";
  return null;
}

export function broadLevelFromCefr(value?: string | null): Level | null {
  const cefrLevel = normalizeCefrLevel(value);
  return cefrLevel ? CEFR_TO_BROAD_LEVEL[cefrLevel] : null;
}

export function resolveCefrLevel(value?: string | null, broadLevel?: string | null): CefrLevel | null {
  const explicit = normalizeCefrLevel(value);
  if (explicit) return explicit;
  const normalizedBroad = normalizeBroadLevel(broadLevel);
  return normalizedBroad ? BROAD_TO_CEFR_FALLBACK[normalizedBroad] : null;
}

export function cefrPromptLabel(value?: string | null, broadLevel?: string | null): string {
  const cefrLevel = resolveCefrLevel(value, broadLevel);
  if (cefrLevel) return `CEFR ${CEFR_LEVEL_LABELS[cefrLevel]}`;

  const normalizedBroad = normalizeBroadLevel(broadLevel);
  if (normalizedBroad) return normalizedBroad;

  return "intermediate";
}
