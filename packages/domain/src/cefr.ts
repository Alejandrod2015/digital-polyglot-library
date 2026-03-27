import { CEFR_LEVEL_LABELS, type CefrLevel, type Level } from "./types/books";

const BROAD_TO_CEFR_FALLBACK: Record<Level, CefrLevel> = {
  beginner: "a1",
  intermediate: "b1",
  advanced: "c1",
};

const CEFR_TO_BROAD_LEVEL: Record<CefrLevel, Level> = {
  a1: "beginner",
  a2: "beginner",
  b1: "intermediate",
  b2: "intermediate",
  c1: "advanced",
  c2: "advanced",
};

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
