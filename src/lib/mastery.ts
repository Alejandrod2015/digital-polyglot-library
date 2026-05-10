// Maps a favorite's FSRS state to a 0-5 mastery level for visual display.
// Signal is the days between lastReviewedAt and nextReviewAt: the FSRS
// scheduler outputs longer intervals when its confidence in retention is
// higher, so interval IS the dominance metric (streak is a side-effect
// counter that doesn't reflect spacing). Shared across web and mobile so
// the badge means the same thing everywhere.

export type MasteryInput = {
  lastReviewedAt?: Date | string | number | null;
  nextReviewAt?: Date | string | number | null;
  streak?: number | null;
};

export type MasteryLevel = 0 | 1 | 2 | 3 | 4 | 5;

export type MasteryInfo = {
  level: MasteryLevel;
  label: string;
  // Hex colors so consumers in both Tailwind (web) and React Native (mobile)
  // can use them without parsing class strings.
  color: string;
  // Soft background tint for pill bg in light/dark agnostic UIs.
  bgColor: string;
  borderColor: string;
};

const MASTERY_BY_LEVEL: Record<MasteryLevel, MasteryInfo> = {
  0: {
    level: 0,
    label: "Nueva",
    color: "#94a3b8", // slate-400
    bgColor: "rgba(148,163,184,0.16)",
    borderColor: "rgba(148,163,184,0.40)",
  },
  1: {
    level: 1,
    label: "Repasar ya",
    color: "#ef4444", // red-500
    bgColor: "rgba(239,68,68,0.16)",
    borderColor: "rgba(239,68,68,0.40)",
  },
  2: {
    level: 2,
    label: "Aprendiendo",
    color: "#f97316", // orange-500
    bgColor: "rgba(249,115,22,0.16)",
    borderColor: "rgba(249,115,22,0.40)",
  },
  3: {
    level: 3,
    label: "La reconoce",
    color: "#eab308", // yellow-500
    bgColor: "rgba(234,179,8,0.18)",
    borderColor: "rgba(234,179,8,0.45)",
  },
  4: {
    level: 4,
    label: "Firme",
    color: "#84cc16", // lime-500
    bgColor: "rgba(132,204,22,0.16)",
    borderColor: "rgba(132,204,22,0.40)",
  },
  5: {
    level: 5,
    label: "Dominada",
    color: "#10b981", // emerald-500
    bgColor: "rgba(16,185,129,0.18)",
    borderColor: "rgba(16,185,129,0.45)",
  },
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toMs(value: Date | string | number | null | undefined): number | null {
  if (value == null) return null;
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isFinite(t) ? t : null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

// Map FSRS interval (days) to a 1-5 level. Thresholds aligned with common
// SRS conventions: < 1d = relearning, 1-3d = learning, 4-14d = young,
// 15-45d = mature, 46d+ = mastered.
function levelFromIntervalDays(days: number): MasteryLevel {
  if (days < 1) return 1;
  if (days < 4) return 2;
  if (days < 15) return 3;
  if (days < 46) return 4;
  return 5;
}

export function getMasteryLevel(input: MasteryInput): MasteryInfo {
  const lastMs = toMs(input.lastReviewedAt);
  const nextMs = toMs(input.nextReviewAt);
  const streak = typeof input.streak === "number" ? input.streak : 0;

  // Never practiced: gray "Nueva" state.
  if (lastMs == null && (!streak || streak <= 0)) {
    return MASTERY_BY_LEVEL[0];
  }

  // Practiced but the scheduler didn't write a future date (legacy data or
  // first review interrupted): fall back to streak as a coarse proxy.
  if (lastMs == null || nextMs == null || nextMs <= lastMs) {
    if (streak <= 0) return MASTERY_BY_LEVEL[1];
    if (streak === 1) return MASTERY_BY_LEVEL[2];
    if (streak <= 3) return MASTERY_BY_LEVEL[3];
    if (streak <= 6) return MASTERY_BY_LEVEL[4];
    return MASTERY_BY_LEVEL[5];
  }

  const intervalDays = (nextMs - lastMs) / MS_PER_DAY;
  return MASTERY_BY_LEVEL[levelFromIntervalDays(intervalDays)];
}

// For consumers that just want all five non-zero swatches (e.g., a legend).
export function listMasteryLevels(): MasteryInfo[] {
  return [1, 2, 3, 4, 5].map((lvl) => MASTERY_BY_LEVEL[lvl as MasteryLevel]);
}
