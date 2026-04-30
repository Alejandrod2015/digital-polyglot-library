import type { JourneyFocus } from "../../../../src/lib/onboarding";

/**
 * A single learning journey: a (language, variant, focus) tuple plus
 * its level + creation timestamp. The user can have multiple journeys
 * per language — e.g. "Spanish · Travelers" + "Spanish · Business"
 * — each tracking its own progress, streak, and active topic.
 *
 * Schema-stable design notes:
 *   - `id` is deterministic (`<language>:<variant?>:<focus>`) so the
 *     server can't desync ids by re-emitting the list. Comparing two
 *     journey arrays for equality is safe by id.
 *   - `level` mirrors the legacy `preferences.preferredLevel` but lives
 *     here so two journeys in the same language can hold different
 *     levels (a B1 traveler vs. an A2 business learner is realistic).
 *   - We never persist `JOURNEY_FOCUS_OPTIONS` literals to the chip;
 *     `focusShortLabel()` produces the user-facing copy.
 */
export type Journey = {
  /** Deterministic id, see `journeyId()`. */
  id: string;
  /** Canonical language name (e.g. "Spanish", "English"). */
  language: string;
  /** Lower-case regional code when the language has variants:
   *  "us" / "uk" for English, etc. null for languages with one flag. */
  variant: string | null;
  /** One of JOURNEY_FOCUS_OPTIONS — same domain enum used everywhere
   *  else; we only swap the display label at the chrome layer. */
  focus: JourneyFocus;
  /** Coarse self-reported level: "Beginner" | "Intermediate" | etc.
   *  Same alphabet as `MobilePreferences.preferredLevel`. */
  level: string | null;
  /** ISO timestamp; used to sort the panel by recency and to break
   *  ties between journeys created in the same minute. */
  createdAt: string;
};

/**
 * Build the deterministic id for a journey. Centralized so the
 * lower-casing rules can't drift between callers.
 */
export function journeyId(
  language: string,
  variant: string | null | undefined,
  focus: JourneyFocus
): string {
  const v = variant ? `:${variant.toLowerCase()}` : "";
  // `:` is the separator and `focus` already contains spaces+ampersands;
  // the comparison is exact-string so we don't normalize beyond casing.
  return `${language.toLowerCase()}${v}:${focus.toLowerCase()}`;
}

/**
 * Shorter, more direct label for the focus shown on chips, sheet rows,
 * and the panel cards. The dominant copy convention in mockups is
 * "Spanish · Travelers" rather than "Spanish · Travel & Local Life",
 * so we expose this helper rather than reusing the enum value.
 */
export function focusShortLabel(focus: JourneyFocus): string {
  switch (focus) {
    case "Travel & Local Life":
      return "Travelers";
    case "Work & Career":
      return "Business";
    case "Culture & Belonging":
      return "Culture";
    case "General":
      return "Everyday";
    default:
      return focus;
  }
}

/** A small icon hint for the focus, rendered as a Feather glyph name
 *  (or as an emoji in card subtitles). Kept here so the rest of the UI
 *  doesn't have to switch on focus values. */
export function focusIcon(focus: JourneyFocus): {
  feather: "send" | "briefcase" | "star" | "coffee";
  emoji: string;
} {
  switch (focus) {
    case "Travel & Local Life":
      return { feather: "send", emoji: "✈" };
    case "Work & Career":
      return { feather: "briefcase", emoji: "💼" };
    case "Culture & Belonging":
      return { feather: "star", emoji: "🎭" };
    case "General":
    default:
      return { feather: "coffee", emoji: "☕" };
  }
}

/**
 * Long-form "Spanish · Travelers" used in sheet rows + panel cards.
 * The middle-dot separator matches `journeyChipLabel` so the language
 * + focus pairing reads consistently across surfaces (cards, sheets,
 * header chip), and avoids the previous Spanish-for-X / Spanish—Everyday
 * inconsistency where General had to be hand-cased to read naturally.
 */
export function journeyDisplayName(journey: Journey): string {
  const focusLabel = focusShortLabel(journey.focus);
  return `${journey.language} · ${focusLabel}`;
}

/**
 * Compact form for the journey-screen header chip. The flag carries
 * language identity, so the chip text only needs to disambiguate the
 * journey within the language: "Travelers · B1". When level is null
 * we drop the divider entirely.
 */
export function journeyChipLabel(journey: Journey): string {
  const focusLabel = focusShortLabel(journey.focus);
  const level = journey.level?.trim();
  if (!level) return focusLabel;
  return `${focusLabel} · ${level}`;
}

/**
 * Two-letter country / language code shown in the journey header chip
 * next to the flag (Duolingo-style). Country codes are favored over
 * strict ISO 639-1 because they pair more intuitively with the flag
 * art (people associate "JP" with Japan, not "JA").
 */
export function languageShortCode(language: string | null | undefined): string {
  if (!language) return "";
  switch (language) {
    case "Spanish":
      return "ES";
    case "German":
      return "DE";
    case "French":
      return "FR";
    case "Italian":
      return "IT";
    case "Portuguese":
      return "PT";
    case "Japanese":
      return "JP";
    case "Korean":
      return "KR";
    case "Chinese":
      return "CN";
    case "English":
      return "EN";
    default:
      return language.slice(0, 2).toUpperCase();
  }
}

/**
 * Backfill a journey list from the legacy single-language-focus
 * preferences. Used when the server returns `targetLanguages` but no
 * `journeys` field — i.e. existing accounts that predate this model.
 *
 *   - One journey per language in `targetLanguages`.
 *   - The first language inherits the prefs' `journeyFocus` (or
 *     "General" if missing). Other languages default to "General"
 *     since the legacy schema only stored one focus globally.
 *   - `variant` is taken from `preferredVariant` for the first language
 *     only. Other languages get null — same constraint as today.
 *   - `activeJourneyId` is the first journey, mirroring
 *     `targetLanguages[0]` being the active one in the legacy UI.
 */
export function synthesizeJourneysFromLegacy(input: {
  targetLanguages: string[];
  preferredVariant: string | null;
  preferredLevel: string | null;
  journeyFocus: JourneyFocus | null;
}): { journeys: Journey[]; activeJourneyId: string | null } {
  const focus: JourneyFocus = input.journeyFocus ?? "General";
  const createdAt = new Date().toISOString();
  const journeys: Journey[] = input.targetLanguages.map((language, index) => {
    const variant = index === 0 ? input.preferredVariant : null;
    const journeyFocus: JourneyFocus = index === 0 ? focus : "General";
    return {
      id: journeyId(language, variant, journeyFocus),
      language,
      variant,
      focus: journeyFocus,
      level: input.preferredLevel,
      createdAt,
    };
  });
  return {
    journeys,
    activeJourneyId: journeys[0]?.id ?? null,
  };
}

/**
 * Find a journey by id with a stable fallback (first journey, or null).
 * Most call sites want "the journey for this id, OR a sensible default,
 * but never crash"; centralizing avoids `!` non-null assertions.
 */
export function findActiveJourney(
  journeys: Journey[],
  activeJourneyId: string | null
): Journey | null {
  if (activeJourneyId) {
    const match = journeys.find((j) => j.id === activeJourneyId);
    if (match) return match;
  }
  return journeys[0] ?? null;
}

/**
 * Stable deep-equality on a journey list — used by
 * `arePreferencesEqual()` so we don't fire spurious re-renders when
 * the server replays the same payload.
 */
export function areJourneysEqual(a: Journey[], b: Journey[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i];
    const y = b[i];
    if (
      x.id !== y.id ||
      x.language !== y.language ||
      x.variant !== y.variant ||
      x.focus !== y.focus ||
      x.level !== y.level ||
      x.createdAt !== y.createdAt
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Derive `targetLanguages` (deduped, order-preserving) from a journey
 * list. Lets the rest of the codebase keep reading
 * `preferences.targetLanguages` until the call sites are migrated.
 */
export function targetLanguagesFromJourneys(journeys: Journey[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const journey of journeys) {
    if (!seen.has(journey.language)) {
      seen.add(journey.language);
      out.push(journey.language);
    }
  }
  return out;
}

/**
 * The set of (language, variant, focus) triplets that already have a
 * journey. The "Add journey" picker uses this to disable already-
 * existing combinations so we never create duplicate ids.
 */
export function existingJourneyKeys(journeys: Journey[]): Set<string> {
  return new Set(journeys.map((j) => j.id));
}

/**
 * Collapse any accidental duplicates in a journey list down to a
 * single entry per `id`. Always preferred — two journeys with the
 * same `(language, variant, focus)` triplet are semantically
 * impossible (it's the user's same learning path).
 *
 * Tie-break rule: keep the **earliest** `createdAt` so the original
 * journey (with its accumulated stats: streak, XP, progress in the
 * user's mind) wins over a duplicate that was accidentally appended
 * later. Order is preserved relative to the surviving entries.
 *
 * Centralized so every path that produces a `journeys[]`
 * (onboarding commit, manual create, disk restore, server hydrate)
 * can pass through a single guard. The previous setup had three
 * independent paths and any one of them could leak duplicates.
 */
export function dedupeJourneysById(journeys: Journey[]): Journey[] {
  const earliestById = new Map<string, Journey>();
  for (const journey of journeys) {
    const existing = earliestById.get(journey.id);
    if (!existing) {
      earliestById.set(journey.id, journey);
      continue;
    }
    // Keep whichever has the earlier createdAt; if either is missing
    // a parseable date we fall back to keeping the existing entry
    // (first-wins) so the order in the input array is preserved.
    const existingTs = Date.parse(existing.createdAt);
    const candidateTs = Date.parse(journey.createdAt);
    if (Number.isFinite(candidateTs) && Number.isFinite(existingTs) && candidateTs < existingTs) {
      earliestById.set(journey.id, journey);
    }
  }
  // Rebuild output preserving the FIRST appearance order in the
  // input — keeps the panel layout stable for the user.
  const seen = new Set<string>();
  const out: Journey[] = [];
  for (const journey of journeys) {
    if (seen.has(journey.id)) continue;
    seen.add(journey.id);
    const winner = earliestById.get(journey.id);
    if (winner) out.push(winner);
  }
  return out;
}
