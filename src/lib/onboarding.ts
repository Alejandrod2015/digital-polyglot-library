export const ONBOARDING_GOAL_OPTIONS = [
  "Travel",
  "Daily life",
  "Work",
  "Culture",
  "Fluency",
] as const;

export const JOURNEY_FOCUS_OPTIONS = [
  "General",
  "Travel & Local Life",
  "Work & Career",
  "Culture & Belonging",
] as const;

export const ONBOARDING_DAILY_MINUTES_OPTIONS = [5, 10, 15, 20] as const;
export const ONBOARDING_LEVEL_OPTIONS = ["Beginner", "Intermediate", "Advanced"] as const;
export const ONBOARDING_INTEREST_OPTIONS = [
  "Coffee",
  "Sustainability",
  "Food",
  "Travel",
  "Business",
  "Technology",
  "Health",
  "Art",
  "Nature",
  "History",
  "Music",
  "Sports",
] as const;

export type OnboardingGoal = (typeof ONBOARDING_GOAL_OPTIONS)[number];
export type OnboardingDailyMinutes = (typeof ONBOARDING_DAILY_MINUTES_OPTIONS)[number];
export type JourneyFocus = (typeof JOURNEY_FOCUS_OPTIONS)[number];

export type SharedOnboardingState = {
  learningGoal: OnboardingGoal | null;
  journeyFocus: JourneyFocus | null;
  dailyMinutes: OnboardingDailyMinutes | null;
  onboardingSurveyCompletedAt: string | null;
  onboardingTourCompletedAt: string | null;
};

export type OnboardingPracticePrefs = {
  interests: readonly string[];
  learningGoal: OnboardingGoal | null;
  dailyMinutes: number | null;
};

const GOAL_TOPIC_HINTS: Record<OnboardingGoal, string[]> = {
  Travel: ["travel", "getting around", "places", "city", "services", "plans"],
  "Daily life": ["daily life", "food", "home", "family", "community", "relationships"],
  Work: ["work", "study", "technology", "business", "money", "career"],
  Culture: ["culture", "traditions", "history", "art", "music", "identity", "folklore"],
  Fluency: ["opinions", "society", "media", "relationships", "daily life", "work"],
};

const JOURNEY_FOCUS_TO_GOAL: Record<Exclude<JourneyFocus, "General">, OnboardingGoal> = {
  "Travel & Local Life": "Travel",
  "Work & Career": "Work",
  "Culture & Belonging": "Culture",
};

function normalizeTerm(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s&-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeJourneyFocus(value: unknown): JourneyFocus | null {
  if (typeof value !== "string") return null;
  const normalized = normalizeTerm(value);
  return (
    JOURNEY_FOCUS_OPTIONS.find((option) => normalizeTerm(option) === normalized) ?? null
  );
}

export function getJourneyFocusFromLearningGoal(learningGoal: string | null): JourneyFocus {
  if (learningGoal === "Travel" || learningGoal === "Daily life") return "Travel & Local Life";
  if (learningGoal === "Work") return "Work & Career";
  if (learningGoal === "Culture") return "Culture & Belonging";
  return "General";
}

export function getLearningGoalFromJourneyFocus(journeyFocus: JourneyFocus | null): OnboardingGoal | null {
  if (!journeyFocus || journeyFocus === "General") return null;
  return JOURNEY_FOCUS_TO_GOAL[journeyFocus];
}

export function getOnboardingTopicHints(
  interests: readonly string[],
  learningGoal: OnboardingGoal | null
): string[] {
  const seen = new Set<string>();
  const next: string[] = [];

  for (const raw of interests) {
    const normalized = normalizeTerm(raw);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    next.push(normalized);
  }

  if (learningGoal) {
    for (const raw of GOAL_TOPIC_HINTS[learningGoal]) {
      const normalized = normalizeTerm(raw);
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      next.push(normalized);
    }
  }

  return next;
}

export function scoreTopicLabelAgainstOnboarding(
  label: string | null | undefined,
  interests: readonly string[],
  learningGoal: OnboardingGoal | null
): number {
  const normalizedLabel = normalizeTerm(label ?? "");
  if (!normalizedLabel) return 0;

  let score = 0;
  for (const hint of getOnboardingTopicHints(interests, learningGoal)) {
    if (normalizedLabel.includes(hint) || hint.includes(normalizedLabel)) {
      score += hint.includes(" ") ? 4 : 3;
    }
  }

  return score;
}

export function pickOnboardingTopicPreference(
  labels: readonly string[],
  interests: readonly string[],
  learningGoal: OnboardingGoal | null
): string | null {
  let bestLabel: string | null = null;
  let bestScore = 0;

  for (const label of labels) {
    const score = scoreTopicLabelAgainstOnboarding(label, interests, learningGoal);
    if (score > bestScore) {
      bestLabel = label;
      bestScore = score;
    }
  }

  return bestScore > 0 ? bestLabel : null;
}

export function getDefaultCreateTopic(
  topicOptions: readonly string[],
  interests: readonly string[],
  learningGoal: OnboardingGoal | null
): string | null {
  return pickOnboardingTopicPreference(topicOptions, interests, learningGoal);
}

export function getCreateFocusForGoal(learningGoal: OnboardingGoal | null): string {
  if (learningGoal === "Work") return "Verbs";
  if (learningGoal === "Culture") return "Expressions";
  return "Mixed";
}

export function getJourneyVariantFromPreferences(
  language: string,
  preferredVariant: string | null | undefined,
  preferredRegion: string | null | undefined
): string | null {
  const normalizedVariant = normalizeTerm(preferredVariant ?? "");
  if (normalizedVariant) return normalizedVariant;

  const normalizedLanguage = normalizeTerm(language);
  const normalizedRegion = normalizeTerm(preferredRegion ?? "");
  if (!normalizedLanguage || !normalizedRegion) return null;

  if (normalizedLanguage === "spanish") {
    if (normalizedRegion === "spain") return "spain";
    return "latam";
  }

  return normalizedRegion || null;
}

export function scoreReadTimeFit(
  readMinutes: number | null | undefined,
  dailyMinutes: number | null
): number {
  if (!readMinutes || !dailyMinutes) return 0;
  if (readMinutes <= dailyMinutes) return 4;
  if (readMinutes <= dailyMinutes + 5) return 2;
  if (readMinutes >= dailyMinutes * 2) return -2;
  return 0;
}

type PracticeLikeItem = {
  word?: string | null;
  translation?: string | null;
  exampleSentence?: string | null;
  storyTitle?: string | null;
  wordType?: string | null;
  nextReviewAt?: string | null;
};

export function scorePracticeItemAgainstOnboarding<T extends PracticeLikeItem>(
  item: T,
  prefs: OnboardingPracticePrefs
): number {
  const haystack = normalizeTerm(
    [item.word, item.translation, item.exampleSentence, item.storyTitle].filter(Boolean).join(" ")
  );
  const wordType = normalizeTerm(item.wordType ?? "");
  let score = 0;

  score += scoreTopicLabelAgainstOnboarding(haystack, prefs.interests, prefs.learningGoal);

  if (prefs.learningGoal === "Travel") {
    if (wordType === "phrase" || wordType === "expression") score += 3;
    if (/travel|transport|city|hotel|airport|station|ticket/.test(haystack)) score += 4;
  } else if (prefs.learningGoal === "Work") {
    if (wordType === "verb") score += 2;
    if (/work|office|meeting|business|technology|money|career|study/.test(haystack)) score += 4;
  } else if (prefs.learningGoal === "Daily life") {
    if (/food|family|home|shopping|health|daily|community/.test(haystack)) score += 4;
  } else if (prefs.learningGoal === "Culture") {
    if (wordType === "phrase" || wordType === "expression") score += 2;
    if (/culture|history|music|art|tradition|identity|folklore/.test(haystack)) score += 4;
  } else if (prefs.learningGoal === "Fluency") {
    if (wordType === "phrase" || wordType === "expression") score += 3;
    if ((item.exampleSentence?.trim().length ?? 0) > 40) score += 2;
  }

  if (prefs.dailyMinutes && prefs.dailyMinutes <= 5) {
    if ((item.exampleSentence?.trim().length ?? 0) <= 80) score += 2;
  } else if (prefs.dailyMinutes && prefs.dailyMinutes >= 15) {
    if ((item.exampleSentence?.trim().length ?? 0) >= 50) score += 1;
  }

  return score;
}

export function sortPracticeItemsByOnboarding<T extends PracticeLikeItem>(
  items: readonly T[],
  prefs: OnboardingPracticePrefs,
  preferDue = false
): T[] {
  const now = Date.now();
  return [...items].sort((a, b) => {
    const aDue = a.nextReviewAt ? Date.parse(a.nextReviewAt) : Number.NaN;
    const bDue = b.nextReviewAt ? Date.parse(b.nextReviewAt) : Number.NaN;
    if (preferDue) {
      const aDueNow = !Number.isFinite(aDue) || aDue <= now;
      const bDueNow = !Number.isFinite(bDue) || bDue <= now;
      if (aDueNow !== bDueNow) return aDueNow ? -1 : 1;
    }

    const scoreDiff = scorePracticeItemAgainstOnboarding(b, prefs) - scorePracticeItemAgainstOnboarding(a, prefs);
    if (scoreDiff !== 0) return scoreDiff;

    if (Number.isFinite(aDue) && Number.isFinite(bDue) && aDue !== bDue) {
      return aDue - bDue;
    }

    const aWord = normalizeTerm(a.word ?? "");
    const bWord = normalizeTerm(b.word ?? "");
    return aWord.localeCompare(bWord);
  });
}

export function getPracticeModeBias(
  prefs: OnboardingPracticePrefs
): "meaning" | "context" | "natural" | "listening" | null {
  if (prefs.dailyMinutes && prefs.dailyMinutes <= 5) return "meaning";
  if (prefs.learningGoal === "Travel") return "natural";
  if (prefs.learningGoal === "Culture") return "context";
  if (prefs.learningGoal === "Fluency") return "listening";
  return null;
}

export const PRODUCT_TOUR_MESSAGES = [
  {
    id: "home",
    target: "home",
    targetLabel: "Home",
    title: "Home keeps you moving",
    body: "Your next story, streak and daily progress live here so you always know what to do next.",
  },
  {
    id: "explore",
    target: "explore",
    targetLabel: "Explore",
    title: "Explore finds your lane",
    body: "Browse books, stories and topics matched to your level, language and interests.",
  },
  {
    id: "reader",
    target: "reader",
    targetLabel: "Reader",
    title: "Reader is where learning happens",
    body: "Tap words to save vocab, listen to audio and resume exactly where you left off.",
  },
  {
    id: "practice",
    target: "practice-favorites",
    targetLabel: "Practice + Favorites",
    title: "Practice turns saved words into progress",
    body: "Favorites feed review and practice automatically, so reading creates your next session.",
  },
  {
    id: "journey",
    target: "journey",
    targetLabel: "Journey",
    title: "Journey gives you a path",
    body: "Follow topics step by step: finish stories, practice the topic, then clear the checkpoint.",
  },
] as const;
