"use client";

import { useMemo, useEffect, useRef, useState } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { motion } from "framer-motion";
import Link from "next/link";
import { CheckCircle2, Flame, Sparkles } from "lucide-react";
import StoryCarousel from "@/components/StoryCarousel";
import ReleaseCarousel from "@/components/ReleaseCarousel";
import BookHorizontalCard from "@/components/BookHorizontalCard";
import LevelBadge from "@/components/LevelBadge";
import LanguageBadge from "@/components/LanguageBadge";
import RegionBadge from "@/components/RegionBadge";
import { books } from "@/data/books";
import { formatTopic } from "@domain/displayFormat";
import { getBookCardMeta } from "@domain/bookCardMeta";
import type { GamificationSummary } from "@/lib/gamification";
import { buildGamificationCelebrations, type GamificationCelebration } from "@/lib/gamificationCelebrations";
import { VARIANT_OPTIONS_BY_LANGUAGE, formatVariantLabel, normalizeVariant } from "@/lib/languageVariant";
import {
  JOURNEY_FOCUS_OPTIONS,
  ONBOARDING_DAILY_MINUTES_OPTIONS,
  ONBOARDING_INTEREST_OPTIONS,
  ONBOARDING_LEVEL_OPTIONS,
  PRODUCT_TOUR_MESSAGES,
  getJourneyFocusFromLearningGoal,
  getLearningGoalFromJourneyFocus,
  scoreReadTimeFit,
  scoreTopicLabelAgainstOnboarding,
  type JourneyFocus,
  type OnboardingGoal,
} from "@/lib/onboarding";
import { resolveCatalogAudioUrl, resolvePublicMediaUrl } from "@/lib/publicMedia";

type LatestBook = {
  slug: string;
  title: string;
  language?: string;
  region?: string;
  level?: string;
  cover?: string;
  description?: string;
};

type LatestStory = {
  bookSlug: string;
  bookTitle: string;
  storySlug: string;
  storyTitle: string;
  language?: string;
  region?: string;
  level?: string;
  coverUrl: string;
  audioUrl?: string;
  topic?: string;
};

type LatestPolyglotStory = {
  slug: string;
  title: string;
  language?: string;
  region?: string;
  level?: string;
  text?: string;
  coverUrl?: string;
};

type ContinueItem = {
  bookSlug: string;
  storySlug: string;
  title: string;
  bookTitle: string;
  cover: string;
  language?: string;
  region?: string;
  level?: string;
  topic?: string;
  readMinutes?: number;
  audioDurationSec?: number;
  progressSec?: number;
};

type ContinueMobileCard = {
  kind: "continue" | "recommendation";
  item: ContinueItem;
  reason?: string;
};

type ContinueListeningApiItem = {
  bookSlug: string;
  storySlug: string;
  lastPlayedAt: string;
  progressSec?: number;
  audioDurationSec?: number;
};

type FavoriteSignalItem = {
  word: string;
  language?: string;
  wordType?: string;
  nextReviewAt?: string | null;
  streak?: number;
};

type RecommendedStoryItem = {
  key: string;
  storyId: string;
  storySlug: string;
  storyTitle: string;
  bookSlug: string;
  bookId: string;
  bookTitle: string;
  coverUrl: string;
  language?: string;
  region?: string;
  level?: string;
  topic?: string;
  audioSrc?: string;
  text?: string;
  reason: string;
  score: number;
};

type HomeStoryCard =
  | {
      kind: "catalog";
      key: string;
      href: string;
      title: string;
      subtitle: string;
      coverUrl: string;
      level?: string;
      language?: string;
      region?: string;
      detail: string;
    }
  | {
      kind: "polyglot";
      key: string;
      href: string;
      title: string;
      subtitle: string;
      coverUrl: string;
      level?: string;
      language?: string;
      region?: string;
      detail: string;
    };

type Props = {
  latestBooks: LatestBook[];
  latestStories: LatestStory[];
  latestPolyglotStories: LatestPolyglotStory[];
  featuredWeekSlug: string | null;
  featuredDaySlug: string | null;
  initialPlan: string;
  initialTargetLanguages: string[];
  initialInterests: string[];
  initialPreferredVariant: string;
  initialHasUser: boolean;
  initialContinueListening: Array<{
    bookSlug: string;
    storySlug: string;
    progressSec?: number;
    audioDurationSec?: number;
  }>;
  continueLoadedOnServer: boolean;
};

type HomeProgressPayload = {
  streakDays: number;
  gamification: GamificationSummary;
};

type OnboardingPreferenceState = {
  targetLanguages: string[];
  interests: string[];
  preferredLevel: string | null;
  preferredRegion: string | null;
  preferredVariant: string | null;
  learningGoal: OnboardingGoal | null;
  journeyFocus: JourneyFocus | null;
  dailyMinutes: number | null;
  onboardingSurveyCompletedAt: string | null;
  onboardingTourCompletedAt: string | null;
};

const MOBILE_LIMIT = 6;
const DESKTOP_LIMIT = 10;
const CONTINUE_COMPLETION_RATIO = 0.95;
const REGION_OPTIONS_BY_LANGUAGE: Record<string, string[]> = {
  spanish: ["Colombia", "Mexico", "Argentina", "Peru", "Spain"],
  german: ["Germany"],
  french: ["France"],
  portuguese: ["Brazil", "Portugal"],
  italian: ["Italy"],
  english: ["United States", "United Kingdom"],
};

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((i) => typeof i === "string");
}

function normalizeKey(value?: string): string {
  return (value ?? "").toLowerCase().trim();
}

function normalizeForMatch(value?: string): string {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function tokenizeForMatch(value?: string): Set<string> {
  const normalized = normalizeForMatch(value);
  if (!normalized) return new Set();
  const tokens = normalized.split(/[^\p{L}\p{N}]+/u).filter((token) => token.length >= 2);
  return new Set(tokens);
}

function stripHtml(input: string): string {
  return input.replace(/<[^>]+>/g, "");
}

function readJsonArrayFromStorage<T>(
  storage: Storage,
  key: string,
  isItem: (value: unknown) => value is T
): T[] {
  try {
    const raw = storage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isItem) : [];
  } catch {
    return [];
  }
}

function estimateReadMinutes(text?: string): number {
  const words = stripHtml(text ?? "")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 180));
}

function formatRemainingDuration(totalSeconds?: number, progressSec?: number): string {
  if (!totalSeconds || !Number.isFinite(totalSeconds) || totalSeconds <= 0) return "--:-- left";
  const safeProgress =
    typeof progressSec === "number" && Number.isFinite(progressSec) && progressSec > 0
      ? progressSec
      : 0;
  const remaining = Math.max(0, Math.floor(totalSeconds - safeProgress));
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")} left`;
}

function getRegionOptionsForLanguage(language: string): string[] {
  return REGION_OPTIONS_BY_LANGUAGE[language.trim().toLowerCase()] ?? [];
}

function isCompletedFromAudio(progressSec?: number, audioDurationSec?: number): boolean {
  if (
    typeof progressSec !== "number" ||
    !Number.isFinite(progressSec) ||
    typeof audioDurationSec !== "number" ||
    !Number.isFinite(audioDurationSec) ||
    audioDurationSec <= 0
  ) {
    return false;
  }
  return progressSec >= audioDurationSec * CONTINUE_COMPLETION_RATIO;
}

async function trackBusinessMetric(eventType: string, value?: number) {
  try {
    await fetch("/api/metrics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storySlug: "__plans__",
        bookSlug: "billing",
        eventType,
        value,
      }),
    });
  } catch {
    // silent
  }
}

export default function HomeClient({
  latestBooks,
  latestStories,
  latestPolyglotStories,
  featuredWeekSlug,
  featuredDaySlug,
  initialPlan,
  initialTargetLanguages,
  initialInterests,
  initialPreferredVariant,
  initialHasUser,
  initialContinueListening,
  continueLoadedOnServer,
}: Props) {
  const { user, isLoaded } = useUser();
  const { userId, isLoaded: isAuthLoaded } = useAuth();

  const [continueListening, setContinueListening] = useState<ContinueItem[]>(() =>
    initialContinueListening
      .map((item) => {
        const bookMeta = Object.values(books).find((b) => b.slug === item.bookSlug);
        if (!bookMeta) return null;
        const storyMeta = bookMeta.stories.find((s) => s.slug === item.storySlug);
        if (!storyMeta) return null;
        const storyCover =
          typeof storyMeta.cover === "string" && storyMeta.cover.trim() !== ""
            ? storyMeta.cover
            : null;
        const cover =
          storyCover ??
          (typeof bookMeta.cover === "string" && bookMeta.cover.trim() !== ""
            ? resolvePublicMediaUrl(bookMeta.cover) ?? bookMeta.cover
            : "/covers/default.jpg");

        return {
          bookSlug: bookMeta.slug,
          storySlug: storyMeta.slug,
          title: storyMeta.title,
          bookTitle: bookMeta.title,
          cover,
          language: storyMeta.language ?? bookMeta.language,
          region: storyMeta.region ?? bookMeta.region,
          level: storyMeta.level ?? bookMeta.level,
          topic: storyMeta.topic ?? bookMeta.topic,
          readMinutes: estimateReadMinutes(storyMeta.text ?? ""),
          progressSec:
            typeof item.progressSec === "number" && Number.isFinite(item.progressSec)
              ? item.progressSec
              : undefined,
          audioDurationSec:
            typeof item.audioDurationSec === "number" && Number.isFinite(item.audioDurationSec)
              ? item.audioDurationSec
              : undefined,
        } as ContinueItem;
      })
      .filter((item): item is ContinueItem => item !== null)
      .filter((item) => !isCompletedFromAudio(item.progressSec, item.audioDurationSec))
  );
  const [continueRefreshTick, setContinueRefreshTick] = useState(0);
  const [continueInitialized, setContinueInitialized] = useState(continueLoadedOnServer);
  const hasSyncedLocalContinueForUserRef = useRef<string | null>(null);
  const lastContinueRefreshAtRef = useRef(0);
  const [favoriteSignals, setFavoriteSignals] = useState<FavoriteSignalItem[]>([]);
  const [savedBookIds, setSavedBookIds] = useState<Set<string>>(new Set());
  const [savedStoryIds, setSavedStoryIds] = useState<Set<string>>(new Set());
  const [readingHistoryStoryIds, setReadingHistoryStoryIds] = useState<Set<string>>(new Set());
  const [, setPersonalizationSignalsLoaded] = useState(false);
  const [preferredVariantOverride, setPreferredVariantOverride] = useState<string>(
    initialPreferredVariant
  );
  const [variantSaving, setVariantSaving] = useState(false);
  const [variantHint, setVariantHint] = useState("");
  const [homeProgress, setHomeProgress] = useState<HomeProgressPayload | null>(null);
  const [activeCelebration, setActiveCelebration] = useState<GamificationCelebration | null>(null);
  const [onboardingState, setOnboardingState] = useState<OnboardingPreferenceState>({
    targetLanguages: initialTargetLanguages,
    interests: initialInterests,
    preferredLevel: null,
    preferredRegion: null,
    preferredVariant: initialPreferredVariant || null,
    learningGoal: null,
    journeyFocus: null,
    dailyMinutes: null,
    onboardingSurveyCompletedAt: null,
    onboardingTourCompletedAt: null,
  });
  const [surveyStep, setSurveyStep] = useState(0);
  const [tourStep, setTourStep] = useState<number | null>(null);
  const [onboardingSaving, setOnboardingSaving] = useState(false);
  const [onboardingError, setOnboardingError] = useState("");
  const plan = isLoaded
    ? (user?.publicMetadata?.plan as string | undefined) ?? "free"
    : initialPlan;
  const hasSession = isAuthLoaded ? Boolean(userId) : initialHasUser;
  const trialStartedAt = isLoaded
    ? (user?.publicMetadata?.trialStartedAt as string | undefined)
    : undefined;
  const activeOnboardingLanguage = onboardingState.targetLanguages[0] ?? "Spanish";
  const activeOnboardingRegions = useMemo(
    () => getRegionOptionsForLanguage(activeOnboardingLanguage),
    [activeOnboardingLanguage]
  );
  const activeOnboardingVariants = useMemo(
    () => VARIANT_OPTIONS_BY_LANGUAGE[activeOnboardingLanguage.trim().toLowerCase()] ?? [],
    [activeOnboardingLanguage]
  );
  const shouldShowSurvey =
    hasSession && isLoaded && !onboardingState.onboardingSurveyCompletedAt;
  const shouldShowTour =
    hasSession &&
    isLoaded &&
    Boolean(onboardingState.onboardingSurveyCompletedAt) &&
    !onboardingState.onboardingTourCompletedAt &&
    tourStep !== null;
  const activeTourMessage = shouldShowTour && tourStep !== null ? PRODUCT_TOUR_MESSAGES[tourStep] : null;
  const activeTourTarget = activeTourMessage?.target ?? null;

  useEffect(() => {
    if (typeof document === "undefined" || typeof window === "undefined") return;
    if (activeTourTarget) {
      document.body.dataset.onboardingTourTarget = activeTourTarget;
    } else {
      delete document.body.dataset.onboardingTourTarget;
    }
    window.dispatchEvent(new Event("dp-onboarding-tour-target-change"));
    return () => {
      delete document.body.dataset.onboardingTourTarget;
      window.dispatchEvent(new Event("dp-onboarding-tour-target-change"));
    };
  }, [activeTourTarget]);

  useEffect(() => {
    if (typeof document === "undefined" || !activeTourTarget) return;
    const target = document.querySelector<HTMLElement>(`[data-tour-target="${activeTourTarget}"]`);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeTourTarget]);

  function getTourSectionClass(target: string) {
    return activeTourTarget === target
      ? "relative z-[81] rounded-[1.9rem] ring-2 ring-[#ffd36b] ring-offset-4 ring-offset-slate-950/80 shadow-[0_0_0_1px_rgba(255,211,107,0.18),0_24px_60px_rgba(8,18,38,0.35)] transition-all duration-200"
      : "";
  }

  const toContinueItem = (bookSlug: string, storySlug: string): ContinueItem | null => {
    const bookMeta = Object.values(books).find((b) => b.slug === bookSlug);
    if (!bookMeta) return null;
    const storyMeta = bookMeta.stories.find((s) => s.slug === storySlug);
    if (!storyMeta) return null;

    const storyCover =
      typeof storyMeta.cover === "string" && storyMeta.cover.trim() !== ""
        ? storyMeta.cover
        : null;
    const cover =
      storyCover ??
      (typeof bookMeta.cover === "string" && bookMeta.cover.trim() !== ""
        ? bookMeta.cover
        : "/covers/default.jpg");

    return {
      bookSlug: bookMeta.slug,
      storySlug: storyMeta.slug,
      title: storyMeta.title,
      bookTitle: bookMeta.title,
      cover,
      language: storyMeta.language ?? bookMeta.language,
      region: storyMeta.region ?? bookMeta.region,
      level: storyMeta.level ?? bookMeta.level,
      topic: storyMeta.topic ?? bookMeta.topic,
      readMinutes: estimateReadMinutes(storyMeta.text ?? ""),
    };
  };

  useEffect(() => {
    if (!isLoaded || !user) return;
    const publicMetadata = user.publicMetadata ?? {};
    const nextTargetLanguages = isStringArray(publicMetadata.targetLanguages)
      ? publicMetadata.targetLanguages
      : initialTargetLanguages;
    const nextInterests = isStringArray(publicMetadata.interests)
      ? publicMetadata.interests
      : initialInterests;
    setOnboardingState({
      targetLanguages: nextTargetLanguages.length > 0 ? nextTargetLanguages : ["Spanish"],
      interests: nextInterests,
      preferredLevel:
        typeof publicMetadata.preferredLevel === "string" ? publicMetadata.preferredLevel : null,
      preferredRegion:
        typeof publicMetadata.preferredRegion === "string" ? publicMetadata.preferredRegion : null,
      preferredVariant:
        typeof publicMetadata.preferredVariant === "string"
          ? publicMetadata.preferredVariant
          : initialPreferredVariant || null,
      learningGoal:
        typeof publicMetadata.learningGoal === "string"
          ? (publicMetadata.learningGoal as OnboardingGoal)
          : null,
      journeyFocus:
        typeof publicMetadata.journeyFocus === "string"
          ? (publicMetadata.journeyFocus as JourneyFocus)
          : getJourneyFocusFromLearningGoal(
              typeof publicMetadata.learningGoal === "string"
                ? (publicMetadata.learningGoal as OnboardingGoal)
                : null
            ),
      dailyMinutes:
        typeof publicMetadata.dailyMinutes === "number" ? publicMetadata.dailyMinutes : null,
      onboardingSurveyCompletedAt:
        typeof publicMetadata.onboardingSurveyCompletedAt === "string"
          ? publicMetadata.onboardingSurveyCompletedAt
          : null,
      onboardingTourCompletedAt:
        typeof publicMetadata.onboardingTourCompletedAt === "string"
          ? publicMetadata.onboardingTourCompletedAt
          : null,
    });
  }, [initialInterests, initialPreferredVariant, initialTargetLanguages, isLoaded, user]);

  useEffect(() => {
    if (!hasSession || !isLoaded) return;
    if (!onboardingState.onboardingSurveyCompletedAt) {
      setTourStep(null);
      return;
    }
    if (!onboardingState.onboardingTourCompletedAt) {
      setTourStep((current) => current ?? 0);
      return;
    }
    setTourStep(null);
  }, [hasSession, isLoaded, onboardingState.onboardingSurveyCompletedAt, onboardingState.onboardingTourCompletedAt]);

  useEffect(() => {
    if (!isLoaded || !userId) return;
    if (plan !== "premium" && plan !== "polyglot") return;
    if (!trialStartedAt) return;
    if (typeof window === "undefined") return;

    const startedAt = new Date(trialStartedAt);
    if (Number.isNaN(startedAt.getTime())) return;
    if (Date.now() - startedAt.getTime() < 24 * 60 * 60 * 1000) return;

    const key = `dp_trial_day1_active_sent_v1:${userId}`;
    if (window.localStorage.getItem(key) === "1") return;

    void trackBusinessMetric("trial_day_1_active", 1);
    window.localStorage.setItem(key, "1");
  }, [isLoaded, userId, plan, trialStartedAt]);

  const saveOnboardingPreferences = async (payload: Partial<OnboardingPreferenceState>) => {
    setOnboardingSaving(true);
    setOnboardingError("");
    try {
      const response = await fetch("/api/user/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(`Error ${response.status}`);
      const data = (await response.json()) as Partial<OnboardingPreferenceState>;
      setOnboardingState((current) => ({
        ...current,
        targetLanguages: Array.isArray(data.targetLanguages) ? data.targetLanguages : current.targetLanguages,
        interests: Array.isArray(data.interests) ? data.interests : current.interests,
        preferredLevel: typeof data.preferredLevel === "string" ? data.preferredLevel : current.preferredLevel,
        preferredRegion: typeof data.preferredRegion === "string" ? data.preferredRegion : current.preferredRegion,
        preferredVariant: typeof data.preferredVariant === "string" ? data.preferredVariant : current.preferredVariant,
        learningGoal: typeof data.learningGoal === "string" ? (data.learningGoal as OnboardingGoal) : current.learningGoal,
        journeyFocus: typeof data.journeyFocus === "string" ? (data.journeyFocus as JourneyFocus) : current.journeyFocus,
        dailyMinutes: typeof data.dailyMinutes === "number" ? data.dailyMinutes : current.dailyMinutes,
        onboardingSurveyCompletedAt:
          typeof data.onboardingSurveyCompletedAt === "string"
            ? data.onboardingSurveyCompletedAt
            : current.onboardingSurveyCompletedAt,
        onboardingTourCompletedAt:
          typeof data.onboardingTourCompletedAt === "string"
            ? data.onboardingTourCompletedAt
            : current.onboardingTourCompletedAt,
      }));
      return true;
    } catch (error) {
      setOnboardingError(error instanceof Error ? error.message : "Could not save onboarding.");
      return false;
    } finally {
      setOnboardingSaving(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadHomeProgress = async () => {
      if (!userId) {
        if (!cancelled) setHomeProgress(null);
        return;
      }

      try {
        const res = await fetch("/api/progress", { cache: "no-store" });
        const data = (await res.json()) as HomeProgressPayload & { error?: string };
        if (!res.ok) throw new Error(data.error || "Failed to load progress");
        if (!cancelled) setHomeProgress(data);
      } catch {
        if (!cancelled) setHomeProgress(null);
      }
    };

    if (isAuthLoaded) void loadHomeProgress();
    return () => {
      cancelled = true;
    };
  }, [isAuthLoaded, userId]);

  useEffect(() => {
    if (typeof window === "undefined" || !userId || !homeProgress?.gamification) return;

    const storageKey = `dp_home_gamification_seen_v1:${userId}`;
    let parsed: string[] = [];
    try {
      const raw = window.localStorage.getItem(storageKey);
      const value = raw ? (JSON.parse(raw) as unknown) : [];
      parsed = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
    } catch {
      parsed = [];
    }
    const seen = new Set(parsed);
    const next = buildGamificationCelebrations(homeProgress.gamification).find((item) => !seen.has(item.id)) ?? null;
    setActiveCelebration(next);
  }, [homeProgress, userId]);

  function dismissCelebration(id: string) {
    if (typeof window === "undefined" || !userId) return;
    const storageKey = `dp_home_gamification_seen_v1:${userId}`;
    let parsed: string[] = [];
    try {
      const raw = window.localStorage.getItem(storageKey);
      const value = raw ? (JSON.parse(raw) as unknown) : [];
      parsed = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
    } catch {
      parsed = [];
    }
    const next = [...new Set([...parsed, id])].slice(-40);
    window.localStorage.setItem(storageKey, JSON.stringify(next));
    setActiveCelebration(null);
  }

  useEffect(() => {
    let cancelled = false;

    const loadContinueListening = async () => {
      const finish = () => {
        if (!cancelled) setContinueInitialized(true);
      };
      let localSafe: ContinueItem[] = [];

      localSafe = readJsonArrayFromStorage<unknown>(
        localStorage,
        "dp_continue_listening_v1",
        (_value): _value is unknown => true
      )
        .map((i: unknown): ContinueItem | null => {
          if (typeof i !== "object" || i === null) return null;
          const r = i as Record<string, unknown>;
          if (
            typeof r.bookSlug !== "string" ||
            typeof r.storySlug !== "string" ||
            typeof r.title !== "string" ||
            typeof r.bookTitle !== "string" ||
            typeof r.cover !== "string"
          ) {
            return null;
          }

          const bookMeta = Object.values(books).find((b) => b.slug === r.bookSlug);
          const storyMeta = bookMeta?.stories.find((s) => s.slug === r.storySlug);
          const language =
            typeof r.language === "string"
              ? r.language
              : storyMeta?.language ?? bookMeta?.language;
          const region =
            typeof r.region === "string"
              ? r.region
              : storyMeta?.region ?? bookMeta?.region;
          const level =
            typeof r.level === "string" ? r.level : storyMeta?.level ?? bookMeta?.level;
          const topic =
            typeof r.topic === "string" ? r.topic : storyMeta?.topic ?? bookMeta?.topic;
          const readMinutes =
            typeof r.readMinutes === "number" && Number.isFinite(r.readMinutes)
              ? r.readMinutes
              : estimateReadMinutes(storyMeta?.text);
          const audioDurationSec =
            typeof r.audioDurationSec === "number" && Number.isFinite(r.audioDurationSec)
              ? r.audioDurationSec
              : undefined;
          const progressSec =
            typeof r.progressSec === "number" && Number.isFinite(r.progressSec)
              ? r.progressSec
              : undefined;

          return {
            bookSlug: r.bookSlug,
            storySlug: r.storySlug,
            title: r.title,
            bookTitle: r.bookTitle,
            cover: r.cover,
            language,
            region,
            level,
            topic,
            readMinutes,
            audioDurationSec,
            progressSec,
          };
        })
        .filter((i): i is ContinueItem => i !== null)
        .filter((item) => !isCompletedFromAudio(item.progressSec, item.audioDurationSec));

      if (!userId) {
        if (!cancelled) {
          setContinueListening(localSafe);
        }
        finish();
        return;
      }

      // Sincroniza historial local previo del dispositivo al backend solo una vez por usuario.
      if (
        localSafe.length > 0 &&
        hasSyncedLocalContinueForUserRef.current !== userId
      ) {
        try {
          await fetch("/api/continue-listening", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              items: localSafe.map((item) => ({
                bookSlug: item.bookSlug,
                storySlug: item.storySlug,
                progressSec: item.progressSec,
                audioDurationSec: item.audioDurationSec,
              })),
            }),
          });
          hasSyncedLocalContinueForUserRef.current = userId;
        } catch {
          // silencioso
        }
      }

      try {
        const res = await fetch("/api/continue-listening", { cache: "no-store" });
        if (!res.ok) return;

        const remote = (await res.json()) as ContinueListeningApiItem[];
        if (!Array.isArray(remote)) return;

        const localByKey: Map<string, ContinueItem> = new Map(
          localSafe.map((item) => [`${item.bookSlug}:${item.storySlug}`, item] as const)
        );

        const hydrated = remote
          .map((item) => {
            const hydratedItem = toContinueItem(item.bookSlug, item.storySlug);
            if (!hydratedItem) return null;
            const next: ContinueItem = { ...hydratedItem };
            if (typeof item.progressSec === "number" && Number.isFinite(item.progressSec)) {
              next.progressSec = item.progressSec;
            }
            if (
              typeof item.audioDurationSec === "number" &&
              Number.isFinite(item.audioDurationSec)
            ) {
              next.audioDurationSec = item.audioDurationSec;
            }
            return next;
          })
          .filter((item): item is ContinueItem => item !== null);

        const merged = hydrated
          .map((item) => {
          const key = `${item.bookSlug}:${item.storySlug}`;
          const local = localByKey.get(key);
          if (!local) return item;
          return {
            ...item,
            audioDurationSec: item.audioDurationSec ?? local.audioDurationSec,
            progressSec: item.progressSec ?? local.progressSec,
          };
          })
          .filter((item) => !isCompletedFromAudio(item.progressSec, item.audioDurationSec));

        if (cancelled) return;
        setContinueListening(merged);
        const nextRaw = JSON.stringify(merged);
        if (localStorage.getItem("dp_continue_listening_v1") !== nextRaw) {
          localStorage.setItem("dp_continue_listening_v1", nextRaw);
        }
      } catch {
        if (!cancelled) {
          setContinueListening([]);
        }
      } finally {
        finish();
      }
    };

    void loadContinueListening();

    return () => {
      cancelled = true;
    };
  }, [userId, continueRefreshTick]);

  const isPersonalizationReady = isAuthLoaded && isLoaded && continueInitialized;

  useEffect(() => {
    const refresh = () => {
      const now = Date.now();
      if (now - lastContinueRefreshAtRef.current < 1500) return;
      lastContinueRefreshAtRef.current = now;
      setContinueRefreshTick((v) => v + 1);
    };

    const handleContinueListeningUpdated = () => refresh();
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "dp_continue_listening_v1" && e.newValue !== e.oldValue) refresh();
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };

    window.addEventListener("continue-listening-updated", handleContinueListeningUpdated);
    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("continue-listening-updated", handleContinueListeningUpdated);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadPersonalizationSignals = async () => {
      if (!userId || (plan !== "premium" && plan !== "polyglot")) {
        if (!cancelled) {
          setFavoriteSignals([]);
          setSavedBookIds(new Set());
          setSavedStoryIds(new Set());
          setReadingHistoryStoryIds(new Set());
          setPersonalizationSignalsLoaded(true);
        }
        return;
      }

      if (!cancelled) {
        setPersonalizationSignalsLoaded(false);
      }

      try {
        const [favoritesRes, libraryBooksRes, libraryStoriesRes] = await Promise.all([
          fetch("/api/favorites", { cache: "no-store" }),
          fetch("/api/library?type=book", { cache: "no-store" }),
          fetch("/api/library?type=story", { cache: "no-store" }),
        ]);

        if (cancelled) return;

        if (favoritesRes.ok) {
          const raw: unknown = await favoritesRes.json();
          if (Array.isArray(raw)) {
            const parsed = raw
              .map((row): FavoriteSignalItem | null => {
                if (typeof row !== "object" || row === null) return null;
                const record = row as Record<string, unknown>;
                if (typeof record.word !== "string") return null;
                return {
                  word: record.word,
                  language: typeof record.language === "string" ? record.language : undefined,
                  wordType: typeof record.wordType === "string" ? record.wordType : undefined,
                  nextReviewAt:
                    typeof record.nextReviewAt === "string" || record.nextReviewAt === null
                      ? (record.nextReviewAt as string | null)
                      : undefined,
                  streak: typeof record.streak === "number" ? record.streak : undefined,
                };
              })
              .filter((item): item is FavoriteSignalItem => item !== null);
            setFavoriteSignals(parsed);
          }
        }

        if (libraryBooksRes.ok) {
          const raw: unknown = await libraryBooksRes.json();
          if (Array.isArray(raw)) {
            const ids = raw
              .map((row) => {
                if (typeof row !== "object" || row === null) return null;
                const record = row as Record<string, unknown>;
                return typeof record.bookId === "string" ? record.bookId : null;
              })
              .filter((id): id is string => !!id);
            setSavedBookIds(new Set(ids));
          }
        }

        if (libraryStoriesRes.ok) {
          const raw: unknown = await libraryStoriesRes.json();
          if (Array.isArray(raw)) {
            const ids = raw
              .map((row) => {
                if (typeof row !== "object" || row === null) return null;
                const record = row as Record<string, unknown>;
                return typeof record.storyId === "string" ? record.storyId : null;
              })
              .filter((id): id is string => !!id);
            setSavedStoryIds(new Set(ids));
          }
        }
      } catch {
        if (!cancelled) {
          setFavoriteSignals([]);
          setSavedBookIds(new Set());
          setSavedStoryIds(new Set());
        }
      }

      try {
        const parsed = readJsonArrayFromStorage<unknown>(
          localStorage,
          "dp_reading_history_v1",
          (_value): _value is unknown => true
        );
        if (!cancelled) {
          const ids = parsed
            .map((row) => {
              if (typeof row !== "object" || row === null) return null;
              const record = row as Record<string, unknown>;
              return typeof record.storyId === "string" ? record.storyId : null;
            })
            .filter((id): id is string => !!id);
          setReadingHistoryStoryIds(new Set(ids));
        }
      } finally {
        if (!cancelled) setPersonalizationSignalsLoaded(true);
      }
    };

    void loadPersonalizationSignals();

    return () => {
      cancelled = true;
    };
  }, [plan, userId]);

  const languageFilter = useMemo(() => {
    if (!Array.isArray(onboardingState.targetLanguages) || onboardingState.targetLanguages.length === 0) {
      return null;
    }
    return new Set(onboardingState.targetLanguages.map((l) => l.toLowerCase()));
  }, [onboardingState.targetLanguages]);
  const preferredLevel = useMemo(
    () => (typeof onboardingState.preferredLevel === "string" ? onboardingState.preferredLevel.toLowerCase().trim() : ""),
    [onboardingState.preferredLevel]
  );
  const preferredRegion = useMemo(
    () => (typeof onboardingState.preferredRegion === "string" ? onboardingState.preferredRegion.toLowerCase().trim() : ""),
    [onboardingState.preferredRegion]
  );
  const preferredVariant = useMemo(() => {
    const raw = onboardingState.preferredVariant ?? preferredVariantOverride;
    return typeof raw === "string" ? normalizeVariant(raw) ?? "" : "";
  }, [onboardingState.preferredVariant, preferredVariantOverride]);
  const shouldShowVariantPrompt = useMemo(() => {
    if (!hasSession) return false;
    if (!languageFilter?.has("spanish")) return false;
    return !preferredVariant;
  }, [hasSession, languageFilter, preferredVariant]);
  const interestFilter = useMemo(() => {
    if (!Array.isArray(onboardingState.interests) || onboardingState.interests.length === 0) return null;
    const normalized = onboardingState.interests
      .map((item) => normalizeForMatch(item))
      .filter((item) => item.length >= 2);
    if (normalized.length === 0) return null;
    return new Set(normalized);
  }, [onboardingState.interests]);
  const onboardingGoal = onboardingState.learningGoal;
  const onboardingDailyMinutes = onboardingState.dailyMinutes;
  const onboardingInterests = onboardingState.interests;
  const dueFavoriteSignalsCount = useMemo(
    () =>
      favoriteSignals.filter((favorite) => {
        if (!favorite.nextReviewAt) return true;
        const dueAt = Date.parse(favorite.nextReviewAt);
        return Number.isNaN(dueAt) || dueAt <= Date.now();
      }).length,
    [favoriteSignals]
  );
  function withReturnContext(href: string) {
    const [base, existingQuery = ""] = href.split("?");
    const params = new URLSearchParams(existingQuery);
    params.set("returnTo", "/");
    params.set("returnLabel", "Home");
    params.set("from", "home");
    return `${base}?${params.toString()}`;
  }

  const dailyLoopSummary = useMemo(() => {
    const preferredMinutes =
      typeof onboardingDailyMinutes === "number" && onboardingDailyMinutes > 0 ? onboardingDailyMinutes : 5;
    const practiceHref = `/practice?mode=${encodeURIComponent(
      dueFavoriteSignalsCount > 0 ? "context" : "meaning"
    )}&returnTo=${encodeURIComponent("/")}&returnLabel=${encodeURIComponent("Home")}`;

    if (continueListening.length > 0) {
      return {
        eyebrow: "Today’s loop",
        title: "Resume, review, then keep moving",
        body:
          dueFavoriteSignalsCount > 0
            ? `${dueFavoriteSignalsCount} due ${dueFavoriteSignalsCount === 1 ? "word is" : "words are"} waiting after your story.`
            : `You already have a story in motion. A quick ${preferredMinutes}-minute review after reading will keep the rhythm alive.`,
        primaryLabel: "Resume story",
        primaryHref: continueListening[0]
          ? withReturnContext(`/books/${continueListening[0].bookSlug}/${continueListening[0].storySlug}`)
          : "/",
        secondaryLabel: "Start review",
        secondaryHref: practiceHref,
      };
    }

    if (dueFavoriteSignalsCount > 0) {
      return {
        eyebrow: "Today’s loop",
        title: "Clear your due review first",
        body: `${dueFavoriteSignalsCount} saved ${dueFavoriteSignalsCount === 1 ? "word is" : "words are"} ready for a fast ${preferredMinutes}-minute session.`,
        primaryLabel: "Start review",
        primaryHref: practiceHref,
        secondaryLabel: "Open Journey",
        secondaryHref: "/journey",
      };
    }

    return {
      eyebrow: "Today’s loop",
      title: "Pick one story and one short review",
      body: `Aim for one authentic story and a ${preferredMinutes}-minute practice pass today.`,
      primaryLabel: "Open Journey",
      primaryHref: "/journey",
      secondaryLabel: "Browse stories",
      secondaryHref: "/explore",
    };
  }, [continueListening, dueFavoriteSignalsCount, onboardingDailyMinutes]);

  const bookMetaBySlug = useMemo(() => {
    const map = new Map<string, { statsLine?: string; topicsLine?: string }>();
    for (const book of Object.values(books)) {
      map.set(book.slug, getBookCardMeta(book));
    }
    return map;
  }, []);

  const filteredBooks = useMemo(() => {
    const base = languageFilter
      ? latestBooks.filter((b) => languageFilter.has((b.language ?? "").toLowerCase()))
      : latestBooks;

    return [...base].sort((a, b) => {
      const scoreBook = (book: LatestBook) => {
        const topicLabel = bookMetaBySlug.get(book.slug)?.topicsLine ?? "";
        const bookMeta = Object.values(books).find((entry) => entry.slug === book.slug);
        const avgReadMinutes =
          bookMeta && bookMeta.stories.length > 0
            ? Math.round(
                bookMeta.stories.reduce((sum, story) => sum + estimateReadMinutes(story.text ?? ""), 0) /
                  bookMeta.stories.length
              )
            : null;
        let score = 0;
        score += scoreTopicLabelAgainstOnboarding(topicLabel, onboardingInterests, onboardingGoal);
        if (preferredRegion && (book.region ?? "").toLowerCase() === preferredRegion) score += 3;
        if (preferredLevel && (book.level ?? "").toLowerCase() === preferredLevel) score += 2;
        score += scoreReadTimeFit(avgReadMinutes, onboardingDailyMinutes);
        return score;
      };

      return scoreBook(b) - scoreBook(a) || a.title.localeCompare(b.title);
    });
  }, [
    bookMetaBySlug,
    languageFilter,
    latestBooks,
    onboardingDailyMinutes,
    onboardingGoal,
    onboardingInterests,
    preferredLevel,
    preferredRegion,
  ]);

  const filteredStories = useMemo(() => {
    const base = languageFilter
      ? latestStories.filter((s) => languageFilter.has((s.language ?? "").toLowerCase()))
      : latestStories;

    return [...base].sort((a, b) => {
      const scoreStory = (story: LatestStory) => {
        let score = 0;
        score += scoreTopicLabelAgainstOnboarding(story.topic, onboardingInterests, onboardingGoal);
        if (preferredRegion && (story.region ?? "").toLowerCase() === preferredRegion) score += 3;
        if (preferredLevel && (story.level ?? "").toLowerCase() === preferredLevel) score += 2;
        const bookMeta = Object.values(books).find((entry) => entry.slug === story.bookSlug);
        const storyMeta = bookMeta?.stories.find((entry) => entry.slug === story.storySlug);
        score += scoreReadTimeFit(storyMeta ? estimateReadMinutes(storyMeta.text ?? "") : null, onboardingDailyMinutes);
        return score;
      };

      return scoreStory(b) - scoreStory(a) || a.storyTitle.localeCompare(b.storyTitle);
    });
  }, [
    languageFilter,
    latestStories,
    onboardingDailyMinutes,
    onboardingGoal,
    onboardingInterests,
    preferredLevel,
    preferredRegion,
  ]);

  const filteredPolyglot = useMemo(() => {
    const base = languageFilter
      ? latestPolyglotStories.filter((s) => languageFilter.has((s.language ?? "").toLowerCase()))
      : latestPolyglotStories;

    return [...base].sort((a, b) => {
      const scorePolyglot = (story: LatestPolyglotStory) => {
        let score = 0;
        score += scoreTopicLabelAgainstOnboarding(stripHtml(story.text ?? ""), onboardingInterests, onboardingGoal);
        if (preferredRegion && (story.region ?? "").toLowerCase() === preferredRegion) score += 3;
        if (preferredLevel && (story.level ?? "").toLowerCase() === preferredLevel) score += 2;
        score += scoreReadTimeFit(estimateReadMinutes(story.text ?? ""), onboardingDailyMinutes);
        return score;
      };

      return scorePolyglot(b) - scorePolyglot(a) || a.title.localeCompare(b.title);
    });
  }, [
    languageFilter,
    latestPolyglotStories,
    onboardingDailyMinutes,
    onboardingGoal,
    onboardingInterests,
    preferredLevel,
    preferredRegion,
  ]);

  const storiesForHome = filteredStories.slice(0, DESKTOP_LIMIT);
  const polyglotForHome = filteredPolyglot.slice(0, DESKTOP_LIMIT);
  const canShowPersonalizedRecommendations =
    isPersonalizationReady && (plan === "premium" || plan === "polyglot");

  const latestStoryTopicByKey = useMemo(() => {
    const topicByKey: Record<string, string | undefined> = {};
    for (const story of storiesForHome) {
      if (story.bookSlug === "standalone") {
        topicByKey[`${story.bookSlug}:${story.storySlug}`] = story.topic;
        continue;
      }
      const bookMeta = Object.values(books).find((b) => b.slug === story.bookSlug);
      const storyMeta = bookMeta?.stories.find((s) => s.slug === story.storySlug);
      topicByKey[`${story.bookSlug}:${story.storySlug}`] = storyMeta?.topic ?? bookMeta?.topic;
    }
    return topicByKey;
  }, [storiesForHome]);

  const latestHomeStories = useMemo<HomeStoryCard[]>(() => {
    const catalogCards = storiesForHome.map((s) => {
      const key = `${s.bookSlug}:${s.storySlug}`;
      return {
        kind: "catalog" as const,
        key,
        href:
          s.bookSlug === "standalone"
            ? withReturnContext(`/stories/${s.storySlug}`)
            : withReturnContext(`/books/${s.bookSlug}/${s.storySlug}`),
        title: s.storyTitle || "Untitled story",
        subtitle: s.bookTitle || s.bookSlug,
        coverUrl: s.coverUrl,
        level: s.level,
        language: s.language,
        region: s.region,
        detail: formatTopic(latestStoryTopicByKey[key]),
      };
    });

    const polyglotCards = polyglotForHome.map((story) => ({
      kind: "polyglot" as const,
      key: story.slug,
      href: withReturnContext(`/stories/${story.slug}`),
      title: story.title,
      subtitle: "Individual Story",
      coverUrl:
        typeof story.coverUrl === "string" && story.coverUrl.trim() !== ""
          ? resolvePublicMediaUrl(story.coverUrl) ?? story.coverUrl
          : "/covers/default.jpg",
      level: story.level,
      language: story.language,
      region: story.region,
      detail: stripHtml(story.text ?? "").slice(0, 120).trim()
        ? `${stripHtml(story.text ?? "").slice(0, 120).trim()}...`
        : "Fresh polyglot story",
    }));

    return [...catalogCards, ...polyglotCards];
  }, [
    latestStoryTopicByKey,
    polyglotForHome,
    storiesForHome,
  ]);

  const recommendedStories = useMemo<RecommendedStoryItem[]>(() => {
    if (!canShowPersonalizedRecommendations) return [];

    const continueSet = new Set(
      continueListening.map((item) => `${item.bookSlug}:${item.storySlug}`)
    );

    const preferredLanguageSet = new Set<string>();
    if (languageFilter) {
      for (const lang of languageFilter) preferredLanguageSet.add(lang);
    }
    for (const favorite of favoriteSignals) {
      if (favorite.language) preferredLanguageSet.add(normalizeKey(favorite.language));
    }

    const preferredLevelSet = new Set<string>();
    const preferredRegionSet = new Set<string>();
    const topicWeights = new Map<string, number>();

    if (preferredLevel) preferredLevelSet.add(normalizeKey(preferredLevel));
    if (preferredRegion) preferredRegionSet.add(normalizeKey(preferredRegion));

    for (const entry of continueListening) {
      if (entry.level) preferredLevelSet.add(normalizeKey(entry.level));
      if (entry.region) preferredRegionSet.add(normalizeKey(entry.region));
      if (entry.topic) {
        const key = normalizeKey(entry.topic);
        topicWeights.set(key, (topicWeights.get(key) ?? 0) + 2);
      }
    }

    for (const bookMeta of Object.values(books)) {
      if (!savedBookIds.has(bookMeta.id) && !savedBookIds.has(bookMeta.slug)) continue;
      if (bookMeta.level) preferredLevelSet.add(normalizeKey(bookMeta.level));
      if (bookMeta.region) preferredRegionSet.add(normalizeKey(bookMeta.region));
      if (bookMeta.topic) {
        const key = normalizeKey(bookMeta.topic);
        topicWeights.set(key, (topicWeights.get(key) ?? 0) + 2);
      }
    }

    const now = Date.now();
    const favoriteProfiles = favoriteSignals
      .map((favorite) => {
        const wordRaw = typeof favorite.word === "string" ? favorite.word.trim() : "";
        if (!wordRaw) return null;
        const normalizedWord = normalizeForMatch(wordRaw);
        if (normalizedWord.length < 3) return null;
        const isExpression = /\s|-/.test(normalizedWord);
        const dueAt =
          typeof favorite.nextReviewAt === "string" ? Date.parse(favorite.nextReviewAt) : Number.NaN;
        const isDue = Number.isFinite(dueAt) && dueAt <= now;
        const streak = typeof favorite.streak === "number" && Number.isFinite(favorite.streak)
          ? favorite.streak
          : 0;
        const difficultyBoost = favorite.wordType === "expression" ? 2 : 1;
        return {
          word: normalizedWord,
          language: normalizeForMatch(favorite.language),
          isExpression,
          isDue,
          streak,
          difficultyBoost,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .slice(0, 120);

    for (const favorite of favoriteProfiles) {
      topicWeights.set(favorite.word, (topicWeights.get(favorite.word) ?? 0) + favorite.difficultyBoost);
    }

    const candidates: RecommendedStoryItem[] = [];

    for (const bookMeta of Object.values(books)) {
      const bookSaved = savedBookIds.has(bookMeta.id) || savedBookIds.has(bookMeta.slug);
      for (const story of bookMeta.stories) {
        const key = `${bookMeta.slug}:${story.slug}`;
        const storySaved =
          savedStoryIds.has(story.id) ||
          savedStoryIds.has(story.slug) ||
          savedStoryIds.has(key);
        const alreadyRead = readingHistoryStoryIds.has(story.id) || readingHistoryStoryIds.has(story.slug);
        const inContinue = continueSet.has(key);
        if (storySaved || alreadyRead || inContinue) continue;

        const language = story.language ?? bookMeta.language;
        const region = story.region ?? bookMeta.region;
        const level = story.level ?? bookMeta.level;
        const topic = story.topic ?? bookMeta.topic;
        const normalizedText = normalizeForMatch(stripHtml(story.text ?? ""));
        const textTokens = tokenizeForMatch(story.text ?? "");
        const coverUrl =
          typeof story.cover === "string" && story.cover.trim() !== ""
            ? resolvePublicMediaUrl(story.cover) ?? story.cover
            : typeof bookMeta.cover === "string" && bookMeta.cover.trim() !== ""
              ? resolvePublicMediaUrl(bookMeta.cover) ?? bookMeta.cover
              : "/covers/default.jpg";
        const rawAudio = typeof story.audio === "string" ? story.audio.trim() : "";
        const audioSrc = resolveCatalogAudioUrl(rawAudio);

        let score = 0;
        let reason = "Picked for your profile";

        if (bookSaved) {
          score += 14;
          reason = "From a book in your library";
        }
        if (language && preferredLanguageSet.has(normalizeKey(language))) {
          score += 8;
          if (reason === "Picked for your profile") reason = "Matches your language focus";
        }
        if (level && preferredLevelSet.has(normalizeKey(level))) {
          score += 5;
          if (reason === "Picked for your profile") reason = "Matches your current level";
        }
        if (region && preferredRegionSet.has(normalizeKey(region))) {
          score += 4;
          if (reason === "Picked for your profile") reason = "Matches your region focus";
        }
        if (interestFilter && interestFilter.size > 0) {
          const topicKey = normalizeForMatch(topic);
          let interestMatches = 0;
          if (topicKey) {
            for (const interest of interestFilter) {
              if (topicKey.includes(interest) || interest.includes(topicKey)) {
                interestMatches += 1;
              }
            }
          }
          if (interestMatches === 0) {
            for (const interest of interestFilter) {
              if (normalizedText.includes(interest)) interestMatches += 1;
              if (interestMatches >= 2) break;
            }
          }
          if (interestMatches > 0) {
            score += Math.min(12, interestMatches * 6);
            if (reason === "Picked for your profile") reason = "Matches your interests";
          }
        }
        const onboardingTopicScore = scoreTopicLabelAgainstOnboarding(
          `${topic ?? ""} ${bookMeta.title} ${story.title}`,
          onboardingInterests,
          onboardingGoal
        );
        if (onboardingTopicScore > 0) {
          score += onboardingTopicScore;
          if (reason === "Picked for your profile") {
            reason = onboardingGoal ? `Aligned with your ${onboardingGoal.toLowerCase()} goal` : "Matches your interests";
          }
        }
        const readTimeFit = scoreReadTimeFit(estimateReadMinutes(story.text ?? ""), onboardingDailyMinutes);
        if (readTimeFit > 0) {
          score += readTimeFit;
          if (reason === "Picked for your profile" && onboardingDailyMinutes) {
            reason = `Fits your ${onboardingDailyMinutes}-minute plan`;
          }
        }
        if (topic) {
          const topicKey = normalizeKey(topic);
          const topicScore = topicWeights.get(topicKey) ?? 0;
          if (topicScore > 0) {
            score += Math.min(10, topicScore * 2);
            reason = `More ${formatTopic(topic)}`;
          }
        }

        let vocabMatches = 0;
        let dueMatches = 0;
        let weakMatches = 0;
        const languageKey = normalizeForMatch(language);
        for (const favorite of favoriteProfiles) {
          if (favorite.language && languageKey && favorite.language !== languageKey) continue;
          const hasMatch = favorite.isExpression
            ? normalizedText.includes(favorite.word)
            : textTokens.has(favorite.word);
          if (!hasMatch) continue;
          vocabMatches += 1;
          if (favorite.isDue) dueMatches += 1;
          if (favorite.streak <= 2) weakMatches += 1;
        }
        if (dueMatches > 0) {
          score += Math.min(24, dueMatches * 6);
          reason = "Practice your due words";
        } else if (weakMatches > 0) {
          score += Math.min(18, weakMatches * 4);
          if (!bookSaved) reason = "Strengthen your weak vocabulary";
        } else if (vocabMatches > 0) {
          score += Math.min(12, vocabMatches * 2);
          if (!bookSaved && vocabMatches >= 2) reason = "Contains words you saved";
        }

        if (score <= 0) continue;

        candidates.push({
          key,
          storyId: story.id,
          storySlug: story.slug,
          storyTitle: story.title,
          bookSlug: bookMeta.slug,
          bookId: bookMeta.id,
          bookTitle: bookMeta.title,
          coverUrl,
          language,
          region,
          level,
          topic,
          audioSrc,
          text: story.text,
          reason,
          score,
        });
      }
    }

    return candidates.sort((a, b) => b.score - a.score).slice(0, 12);
  }, [
    canShowPersonalizedRecommendations,
    continueListening,
    favoriteSignals,
    interestFilter,
    languageFilter,
    onboardingDailyMinutes,
    onboardingGoal,
    onboardingInterests,
    preferredLevel,
    preferredRegion,
    readingHistoryStoryIds,
    savedBookIds,
    savedStoryIds,
  ]);

  const featuredFreeStory = useMemo(() => {
    const targetSlug =
      plan === "basic"
        ? featuredDaySlug ?? featuredWeekSlug
        : plan === "free"
          ? featuredWeekSlug
          : null;
    if (!targetSlug) return null;

    for (const book of Object.values(books)) {
      const story = book.stories.find((s) => s.slug === targetSlug);
      if (!story) continue;
      return {
        label: plan === "basic" ? "Story of the Day" : "Story of the Week",
        href: withReturnContext(`/books/${book.slug}/${story.slug}`),
        title: story.title,
        bookTitle: book.title,
        cover:
          typeof story.cover === "string" && story.cover.trim() !== ""
            ? story.cover
            : typeof book.cover === "string" && book.cover.trim() !== ""
              ? book.cover
              : "/covers/default.jpg",
        language: story.language ?? book.language,
        region: story.region ?? book.region,
        level: story.level ?? book.level,
        topic: story.topic ?? book.topic,
      };
    }
    return null;
  }, [plan, featuredDaySlug, featuredWeekSlug]);

  const mobileContinueCards = useMemo<ContinueMobileCard[]>(() => {
    if (continueListening.length === 0) return [];

    const baseCards: ContinueMobileCard[] = continueListening.map((item) => ({
      kind: "continue",
      item,
    }));

    if (continueListening.length !== 1) return baseCards;

    const base = continueListening[0];
    const baseKey = `${base.bookSlug}:${base.storySlug}`;
    const baseLanguage = (base.language ?? "").toLowerCase();
    const baseTopic = (base.topic ?? "").toLowerCase();

    const candidates = storiesForHome
      .filter((s) => `${s.bookSlug}:${s.storySlug}` !== baseKey)
      .map((s) => {
        const bookMeta = Object.values(books).find((b) => b.slug === s.bookSlug);
        const storyMeta = bookMeta?.stories.find((st) => st.slug === s.storySlug);
        const topic = (storyMeta?.topic ?? bookMeta?.topic ?? "").toLowerCase();
        const language = (s.language ?? storyMeta?.language ?? bookMeta?.language ?? "").toLowerCase();

        let score = 0;
        if (s.bookSlug === base.bookSlug) score += 4;
        if (language && language === baseLanguage) score += 3;
        if (topic && baseTopic && topic === baseTopic) score += 5;

        const recommendation: ContinueItem = {
          bookSlug: s.bookSlug,
          storySlug: s.storySlug,
          title: s.storyTitle,
          bookTitle: s.bookTitle,
          cover: s.coverUrl,
          language: s.language ?? storyMeta?.language ?? bookMeta?.language,
          region: s.region ?? storyMeta?.region ?? bookMeta?.region,
          level: s.level ?? storyMeta?.level ?? bookMeta?.level,
          topic: storyMeta?.topic ?? bookMeta?.topic,
        };

        return { score, recommendation };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)
      .map((entry) => ({
        kind: "recommendation" as const,
        item: entry.recommendation,
        reason: "Recommended for you",
      }));

    return [...baseCards, ...candidates];
  }, [continueListening, storiesForHome]);

  const continueDesktopCardWidthClass =
    continueListening.length === 1
      ? "w-[420px] lg:w-[460px]"
      : continueListening.length === 2
        ? "w-[360px] lg:w-[400px]"
        : "w-[320px] lg:w-[340px]";

  const renderContinueCard = (
    item: ContinueItem,
    options?: { recommendation?: boolean; reason?: string }
  ) => (
    <Link
      key={`${item.bookSlug}:${item.storySlug}`}
      href={withReturnContext(`/books/${item.bookSlug}/${item.storySlug}`)}
      className="flex flex-col bg-[var(--card-bg)] hover:bg-[var(--card-bg-hover)] border border-[var(--card-border)] transition-all duration-200 rounded-2xl overflow-hidden shadow-md h-full cursor-pointer"
    >
      <div className="w-full h-48 bg-[color:var(--surface)]">
        <img
          src={item.cover}
          alt={item.title}
          className="object-cover w-full h-full"
        />
      </div>

      <div className="p-5 flex flex-col flex-1 text-left">
        <div>
          {options?.recommendation ? (
            <p className="inline-flex text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--foreground)] bg-[var(--chip-bg)] border border-[var(--chip-border)] rounded-full px-2 py-0.5 mb-2">
              {options.reason ?? "Recommended"}
            </p>
          ) : null}
          <h3 className="text-xl font-semibold mb-2 text-[var(--foreground)] line-clamp-2">
            {item.title}
          </h3>
          <p className="text-[var(--primary)] text-sm leading-relaxed line-clamp-1">
            {item.bookTitle}
          </p>
        </div>

        <div className="mt-3 text-sm text-[var(--muted)] space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <LevelBadge level={item.level} />
            <LanguageBadge language={item.language} />
            <RegionBadge region={item.region} />
          </div>
          <p>
            {formatRemainingDuration(item.audioDurationSec, item.progressSec)} ·{" "}
            {formatTopic(item.topic)}
          </p>
        </div>
      </div>
    </Link>
  );

  const savePreferredVariant = async (variantValue: string) => {
    try {
      setVariantSaving(true);
      setVariantHint("");
      const res = await fetch("/api/user/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferredVariant: variantValue,
        }),
      });
      if (!res.ok) throw new Error("Failed to save preferred variant");
      setPreferredVariantOverride(variantValue);
      setVariantHint("Preference saved.");
      await user?.reload();
    } catch {
      setVariantHint("Could not save your variant right now.");
    } finally {
      setVariantSaving(false);
    }
  };

  const onboardingSteps = [
    {
      title: "What are you learning?",
      body: "We will use this to tailor stories, books, Journey and Create.",
      render: (
        <div className="flex flex-wrap gap-3">
          {["Spanish", "French", "German", "Italian", "Portuguese", "Japanese"].map((language) => {
            const active = onboardingState.targetLanguages[0] === language;
            return (
              <button
                key={language}
                type="button"
                onClick={() =>
                  setOnboardingState((current) => ({
                    ...current,
                    targetLanguages: [language],
                    preferredVariant: null,
                    preferredRegion: null,
                  }))
                }
                className={[
                  "rounded-full border px-4 py-2 text-sm font-semibold transition",
                  active
                    ? "border-[var(--primary)] bg-[var(--primary)] text-[#0d1830]"
                    : "border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] hover:bg-[var(--card-bg-hover)]",
                ].join(" ")}
              >
                {language}
              </button>
            );
          })}
        </div>
      ),
    },
    {
      title: "What is your level?",
      body: "This keeps recommendations and Journey at the right difficulty.",
      render: (
        <div className="flex flex-wrap gap-3">
          {ONBOARDING_LEVEL_OPTIONS.map((level) => {
            const active = onboardingState.preferredLevel === level;
            return (
              <button
                key={level}
                type="button"
                onClick={() => setOnboardingState((current) => ({ ...current, preferredLevel: level }))}
                className={[
                  "rounded-full border px-4 py-2 text-sm font-semibold transition",
                  active
                    ? "border-[var(--primary)] bg-[var(--primary)] text-[#0d1830]"
                    : "border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] hover:bg-[var(--card-bg-hover)]",
                ].join(" ")}
              >
                {level}
              </button>
            );
          })}
        </div>
      ),
    },
    {
      title: "Which variant fits you best?",
      body: "This helps Journey, audio and recommendations sound more like the Spanish you want.",
      render: (
        <div className="flex flex-wrap gap-3">
          {activeOnboardingVariants.length > 0 ? (
            activeOnboardingVariants.map((variant) => {
              const active = onboardingState.preferredVariant === variant.value;
              return (
                <button
                  key={variant.value}
                  type="button"
                  onClick={() => setOnboardingState((current) => ({ ...current, preferredVariant: variant.value }))}
                  className={[
                    "rounded-full border px-4 py-2 text-sm font-semibold transition",
                    active
                      ? "border-[var(--primary)] bg-[var(--primary)] text-[#0d1830]"
                      : "border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] hover:bg-[var(--card-bg-hover)]",
                  ].join(" ")}
                >
                  {formatVariantLabel(variant.value) ?? variant.label}
                </button>
              );
            })
          ) : (
            <p className="text-sm text-[var(--muted)]">No variant choices for this language, so we will skip it.</p>
          )}
        </div>
      ),
    },
    {
      title: "Which region do you want to explore most?",
      body: "We use this to bias stories, books and examples toward the places you care about.",
      render: (
        <div className="flex flex-wrap gap-3">
          {activeOnboardingRegions.length > 0 ? (
            activeOnboardingRegions.map((region) => {
              const active = onboardingState.preferredRegion === region;
              return (
                <button
                  key={region}
                  type="button"
                  onClick={() => setOnboardingState((current) => ({ ...current, preferredRegion: region }))}
                  className={[
                    "rounded-full border px-4 py-2 text-sm font-semibold transition",
                    active
                      ? "border-[var(--primary)] bg-[var(--primary)] text-[#0d1830]"
                      : "border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] hover:bg-[var(--card-bg-hover)]",
                  ].join(" ")}
                >
                  {region}
                </button>
              );
            })
          ) : (
            <p className="text-sm text-[var(--muted)]">No region picker for this language yet, so we will skip it.</p>
          )}
        </div>
      ),
    },
    {
      title: "What do you want more of?",
      body: "Pick a few interests so the app can personalize stories and recommendations.",
      render: (
        <div className="flex flex-wrap gap-3">
          {ONBOARDING_INTEREST_OPTIONS.map((interest) => {
            const active = onboardingState.interests.some((item) => item.toLowerCase() === interest.toLowerCase());
            return (
              <button
                key={interest}
                type="button"
                onClick={() =>
                  setOnboardingState((current) => {
                    const exists = current.interests.some((item) => item.toLowerCase() === interest.toLowerCase());
                    const nextInterests = exists
                      ? current.interests.filter((item) => item.toLowerCase() !== interest.toLowerCase())
                      : current.interests.length >= 5
                        ? [...current.interests.slice(1), interest]
                        : [...current.interests, interest];
                    return { ...current, interests: nextInterests };
                  })
                }
                className={[
                  "rounded-full border px-4 py-2 text-sm font-semibold transition",
                  active
                    ? "border-[var(--primary)] bg-[var(--primary)] text-[#0d1830]"
                    : "border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] hover:bg-[var(--card-bg-hover)]",
                ].join(" ")}
              >
                {interest}
              </button>
            );
          })}
        </div>
      ),
    },
    {
      title: "Which Journey focus fits you best?",
      body: "This keeps your Journey grounded in the kind of stories you care about most.",
      render: (
        <div className="flex flex-wrap gap-3">
          {JOURNEY_FOCUS_OPTIONS.map((focus) => {
            const active = onboardingState.journeyFocus === focus;
            return (
              <button
                key={focus}
                type="button"
                onClick={() =>
                  setOnboardingState((current) => ({
                    ...current,
                    journeyFocus: focus,
                    learningGoal: getLearningGoalFromJourneyFocus(focus),
                  }))
                }
                className={[
                  "rounded-full border px-4 py-2 text-sm font-semibold transition",
                  active
                    ? "border-[var(--primary)] bg-[var(--primary)] text-[#0d1830]"
                    : "border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] hover:bg-[var(--card-bg-hover)]",
                ].join(" ")}
              >
                {focus}
              </button>
            );
          })}
        </div>
      ),
    },
    {
      title: "How much time can you give per day?",
      body: "This helps us shape goals and next-step nudges around your real schedule.",
      render: (
        <div className="flex flex-wrap gap-3">
          {ONBOARDING_DAILY_MINUTES_OPTIONS.map((minutes) => {
            const active = onboardingState.dailyMinutes === minutes;
            return (
              <button
                key={minutes}
                type="button"
                onClick={() => setOnboardingState((current) => ({ ...current, dailyMinutes: minutes }))}
                className={[
                  "rounded-full border px-4 py-2 text-sm font-semibold transition",
                  active
                    ? "border-[var(--primary)] bg-[var(--primary)] text-[#0d1830]"
                    : "border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] hover:bg-[var(--card-bg-hover)]",
                ].join(" ")}
              >
                {minutes} min
              </button>
            );
          })}
        </div>
      ),
    },
  ];

  const completeSurvey = async () => {
    const success = await saveOnboardingPreferences({
      targetLanguages: onboardingState.targetLanguages,
      interests: onboardingState.interests,
      preferredLevel: onboardingState.preferredLevel,
      preferredRegion: onboardingState.preferredRegion,
      preferredVariant: onboardingState.preferredVariant,
      learningGoal: onboardingState.learningGoal,
      journeyFocus: onboardingState.journeyFocus ?? getJourneyFocusFromLearningGoal(onboardingState.learningGoal),
      dailyMinutes: onboardingState.dailyMinutes,
      onboardingSurveyCompletedAt: new Date().toISOString(),
    });
    if (!success) return;
    setSurveyStep(0);
    setTourStep(0);
  };

  const completeTour = async () => {
    const success = await saveOnboardingPreferences({
      onboardingTourCompletedAt: new Date().toISOString(),
    });
    if (!success) return;
    setTourStep(null);
  };

  return (
    <div className="min-h-full w-full flex flex-col items-center px-8 pb-28">
      <>
      {shouldShowSurvey ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[1.75rem] border border-[var(--card-border)] bg-[linear-gradient(180deg,#112847_0%,#0d2038_100%)] p-6 shadow-[0_24px_60px_rgba(4,12,28,0.45)]">
            <div className="mb-6 flex gap-2">
              {onboardingSteps.map((step, index) => (
                <div
                  key={`${step.title}-${index}`}
                  className={`h-2 flex-1 rounded-full transition-all ${
                    index <= surveyStep ? "bg-[#ffd36b]" : "bg-white/10"
                  }`}
                />
              ))}
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
                  Personalize your path
                </p>
                <h2 className="mt-2 text-3xl font-semibold text-[var(--foreground)]">
                  {onboardingSteps[surveyStep]?.title}
                </h2>
                <p className="mt-2 text-sm text-slate-300">
                  {onboardingSteps[surveyStep]?.body}
                </p>
              </div>
              <div className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-300">
                {surveyStep + 1}/{onboardingSteps.length}
              </div>
            </div>

            <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
              {onboardingSteps[surveyStep]?.render}
            </div>

            {onboardingError ? (
              <p className="mt-4 text-sm font-medium text-rose-300">{onboardingError}</p>
            ) : null}

            <div className="mt-8 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setSurveyStep((current) => Math.max(0, current - 1))}
                disabled={surveyStep === 0 || onboardingSaving}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/88 disabled:opacity-40"
              >
                Back
              </button>

              <button
                type="button"
                onClick={() => {
                  if (surveyStep === onboardingSteps.length - 1) {
                    void completeSurvey();
                    return;
                  }
                  setSurveyStep((current) => Math.min(onboardingSteps.length - 1, current + 1));
                }}
                disabled={onboardingSaving}
                className="rounded-full border border-[var(--primary)] bg-[var(--primary)] px-5 py-2 text-sm font-black text-[#0d1830] disabled:opacity-50"
              >
                {onboardingSaving
                  ? "Saving..."
                  : surveyStep === onboardingSteps.length - 1
                    ? "Finish setup"
                    : "Next"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {shouldShowTour && tourStep !== null ? (
        <div className="fixed inset-0 z-[79] flex items-end justify-center bg-slate-950/45 px-4 pb-8 backdrop-blur-sm md:items-end">
          <div className="w-full max-w-xl rounded-[1.6rem] border border-[var(--card-border)] bg-[linear-gradient(180deg,#153355_0%,#102947_100%)] p-6 shadow-[0_24px_60px_rgba(4,12,28,0.45)]">
            <div className="mb-4 flex gap-2">
              {PRODUCT_TOUR_MESSAGES.map((message, index) => (
                <div
                  key={message.title}
                  className={`h-2 flex-1 rounded-full transition-all ${
                    index <= tourStep ? "bg-[#ffd36b]" : "bg-white/10"
                  }`}
                />
              ))}
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
              Product tour {tourStep + 1}/5
            </p>
            <div className="mt-3 inline-flex items-center rounded-full border border-[#456790] bg-[#1a3556] px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-[#dcefff]">
              {activeTourMessage?.targetLabel}
            </div>
            <h2 className="mt-4 text-2xl font-semibold text-[var(--foreground)]">
              {activeTourMessage?.title}
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-200/90">
              {activeTourMessage?.body}
            </p>
            {onboardingError ? <p className="mt-3 text-sm font-medium text-rose-300">{onboardingError}</p> : null}
            <div className="mt-6 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => void completeTour()}
                  disabled={onboardingSaving}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/88 disabled:opacity-40"
                >
                  Skip
                </button>
                <button
                  type="button"
                  onClick={() => setTourStep((current) => (current === null ? 0 : Math.max(0, current - 1)))}
                  disabled={tourStep === 0 || onboardingSaving}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/88 disabled:opacity-40"
                >
                  Back
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (tourStep >= PRODUCT_TOUR_MESSAGES.length - 1) {
                    void completeTour();
                    return;
                  }
                  setTourStep((current) => (current === null ? 0 : current + 1));
                }}
                disabled={onboardingSaving}
                className="rounded-full border border-[var(--primary)] bg-[var(--primary)] px-5 py-2 text-sm font-black text-[#0d1830] disabled:opacity-50"
              >
                {tourStep >= PRODUCT_TOUR_MESSAGES.length - 1 ? "Got it" : "Next"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {shouldShowVariantPrompt && (
        <section className="w-full max-w-5xl pt-6 md:pt-8 mb-8 md:mb-10">
          <div className="rounded-[1.6rem] border border-[var(--card-border)] bg-[linear-gradient(180deg,#153355_0%,#102947_100%)] p-5 shadow-[0_18px_50px_rgba(6,17,38,0.28)]">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
                  Spanish journey
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                  Pick your Spanish track
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
                  Choose the variety you want to follow across Journey, stories, and recommendations.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                {(VARIANT_OPTIONS_BY_LANGUAGE.spanish ?? []).map((variant) => (
                  <button
                    key={variant.value}
                    type="button"
                    onClick={() => void savePreferredVariant(variant.value)}
                    disabled={variantSaving}
                    className="inline-flex min-w-[140px] items-center justify-center rounded-full border border-[var(--primary)]/25 bg-[var(--primary)] px-5 py-3 text-sm font-black text-[#0d1830] shadow-[0_10px_24px_rgba(163,230,53,0.18)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {formatVariantLabel(variant.value) ?? variant.label}
                  </button>
                ))}
              </div>
            </div>
            {variantHint ? (
              <p className="mt-3 text-sm font-medium text-[var(--primary)]">{variantHint}</p>
            ) : null}
          </div>
        </section>
      )}

      {homeProgress?.gamification ? (
        <section className="w-full max-w-5xl pt-2 md:pt-4 mb-8 md:mb-10">
          <div className="rounded-[1.8rem] border border-[var(--card-border)] bg-[linear-gradient(180deg,#16304f_0%,#122946_100%)] p-5 shadow-[0_18px_50px_rgba(6,17,38,0.28)]">
            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-[1.4rem] border border-[#34516f] bg-[linear-gradient(180deg,#25486f_0%,#1a3457_100%)] p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-100">
                    <Flame size={14} className="text-[#ffd36b]" />
                    {homeProgress.gamification.dailyStreak}-day streak
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-[#355879] bg-[#1d4268] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#dcefff]">
                    <Sparkles size={14} className="text-[#8ef0c6]" />
                    {homeProgress.gamification.totalXp} XP
                  </span>
                </div>
                <div className="mt-4 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Level</p>
                    <div className="mt-2 flex items-end gap-3">
                      <span className="text-5xl font-bold leading-none text-white">
                        {homeProgress.gamification.currentLevel}
                      </span>
                      <div className="pb-1 text-sm text-slate-300">
                        <div>{homeProgress.gamification.todayXp} XP today</div>
                        <div>{homeProgress.gamification.weeklyXp} XP this week</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">
                    <span>Progress to next level</span>
                    <span>
                      {homeProgress.gamification.totalXp - homeProgress.gamification.levelStartXp} /{" "}
                      {homeProgress.gamification.nextLevelXp - homeProgress.gamification.levelStartXp} XP
                    </span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-[#314861]">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,#71dd5a,#3dc55d)] transition-all"
                      style={{ width: `${Math.round(homeProgress.gamification.levelProgress * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-[1.4rem] border border-[#34516f] bg-[#18314d] p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">Daily quests</p>
                    <h2 className="mt-1 text-xl font-semibold text-[var(--foreground)]">Keep the streak alive</h2>
                  </div>
                  <div className="text-sm font-semibold text-slate-300">
                    {homeProgress.gamification.quests.filter((quest) => quest.complete).length} / {homeProgress.gamification.quests.length}
                  </div>
                </div>

                <div className="space-y-3">
                  {homeProgress.gamification.quests.map((quest) => (
                    <div
                      key={quest.id}
                      className="rounded-[1.1rem] border border-[#334860] bg-[var(--bg-content)] px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <CheckCircle2
                            size={16}
                            className={quest.complete ? "text-[#8ef0c6]" : "text-slate-500"}
                          />
                          <span className="text-sm font-semibold text-[var(--foreground)]">{quest.label}</span>
                        </div>
                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">
                          +{quest.rewardXp} XP
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-slate-300">
                        <span>{Math.min(quest.current, quest.target)} / {quest.target}</span>
                        <span>{quest.complete ? "Done" : "In progress"}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 border-t border-white/8 pt-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Unlocked badges</p>
                    <p className="text-xs font-semibold text-slate-300">
                      {homeProgress.gamification.badges.filter((badge) => badge.unlocked).length} / {homeProgress.gamification.badges.length}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {homeProgress.gamification.badges.map((badge) => (
                      <div
                        key={badge.id}
                        className={[
                          "rounded-full border px-3 py-1.5 text-xs font-semibold",
                          badge.unlocked
                            ? "border-white/12 bg-white/8 text-[var(--foreground)]"
                            : "border-[var(--card-border)] bg-[var(--bg-content)] text-slate-500",
                        ].join(" ")}
                      >
                        {badge.label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {activeCelebration ? (
        <section className="w-full max-w-5xl mb-8 md:mb-10">
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 220, damping: 20 }}
            className="relative overflow-hidden rounded-[1.6rem] border border-[#355b82] bg-[linear-gradient(180deg,#1c426a_0%,#163557_100%)] p-5 shadow-[0_18px_50px_rgba(6,17,38,0.28)]"
          >
            {[
              { left: "8%", top: 22, color: "#ffd36b", dx: -16, dy: -18 },
              { left: "20%", top: 54, color: "#8ef0c6", dx: -8, dy: -28 },
              { left: "78%", top: 18, color: "#7dd3fc", dx: 14, dy: -20 },
              { left: "90%", top: 52, color: "#ffd36b", dx: 18, dy: -10 },
              { left: "70%", top: 86, color: "#8ef0c6", dx: 10, dy: 18 },
            ].map((particle, index) => (
              <motion.span
                key={`${activeCelebration.id}-${index}`}
                initial={{ opacity: 0, scale: 0.6, x: 0, y: 0 }}
                animate={{ opacity: [0, 1, 0], scale: [0.6, 1, 0.7], x: particle.dx, y: particle.dy }}
                transition={{ duration: 1, delay: index * 0.05, ease: "easeOut" }}
                className="pointer-events-none absolute h-2.5 w-2.5 rounded-full"
                style={{ left: particle.left, top: particle.top, backgroundColor: particle.color }}
              />
            ))}
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#ffd36b]">Celebration</p>
                <h2 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{activeCelebration.title}</h2>
                <p className="mt-2 max-w-2xl text-sm text-slate-200/90">{activeCelebration.body}</p>
              </div>
              <button
                type="button"
                onClick={() => dismissCelebration(activeCelebration.id)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-white/6 text-slate-100 transition hover:bg-white/12"
                aria-label="Dismiss celebration"
              >
                ×
              </button>
            </div>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#3d6491] bg-[#21466d] px-4 py-2 text-sm font-black text-[#dcefff]">
              <Sparkles size={16} className="text-[#8ef0c6]" />
              {activeCelebration.cta}
            </div>
          </motion.div>
        </section>
      ) : null}

      {isPersonalizationReady ? (
        <section
          data-tour-target="home"
          className={`w-full max-w-5xl pt-4 md:pt-6 mb-10 md:mb-12 ${getTourSectionClass("home")}`}
        >
          <div className="rounded-[1.8rem] border border-[var(--card-border)] bg-[linear-gradient(180deg,#18304d_0%,#14243b_100%)] p-5 shadow-[0_18px_50px_rgba(6,17,38,0.22)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
              {dailyLoopSummary.eyebrow}
            </p>
            <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="max-w-2xl">
                <h2 className="text-2xl font-semibold text-[var(--foreground)]">{dailyLoopSummary.title}</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{dailyLoopSummary.body}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  href={dailyLoopSummary.primaryHref}
                  className="inline-flex rounded-full bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white hover:opacity-90"
                >
                  {dailyLoopSummary.primaryLabel}
                </Link>
                <Link
                  href={dailyLoopSummary.secondaryHref}
                  className="inline-flex rounded-full border border-[var(--card-border)] bg-[var(--card-bg)] px-5 py-3 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--card-bg-hover)]"
                >
                  {dailyLoopSummary.secondaryLabel}
                </Link>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* Free featured story for free/basic users */}
      {isPersonalizationReady && featuredFreeStory && continueListening.length === 0 && (
        <section className="w-full max-w-5xl text-center pt-8 md:pt-10 mb-10 md:mb-12">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--primary)] mb-3">
            {featuredFreeStory.label}
          </p>
          <h2 className="text-2xl font-semibold mb-6 text-[var(--foreground)]">Your free story</h2>
          <div className="max-w-[520px] mx-auto">
            <Link
              href={featuredFreeStory.href}
              className="flex flex-col bg-[var(--card-bg)] hover:bg-[var(--card-bg-hover)] border border-[var(--card-border)] transition-all duration-200 rounded-2xl overflow-hidden shadow-md h-full cursor-pointer"
            >
              <div className="w-full aspect-[16/10] bg-[color:var(--surface)]">
                <img
                  src={featuredFreeStory.cover}
                  alt={featuredFreeStory.title}
                  className="object-contain w-full h-full"
                />
              </div>
              <div className="p-5 flex flex-col flex-1 text-left">
                <div>
                  <h3 className="text-xl font-semibold mb-2 text-[var(--foreground)] line-clamp-2">
                    {featuredFreeStory.title}
                  </h3>
                  <p className="text-[var(--primary)] text-sm leading-relaxed line-clamp-1">
                    {featuredFreeStory.bookTitle}
                  </p>
                </div>
                <div className="mt-3 text-sm text-[var(--muted)] space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <LevelBadge level={featuredFreeStory.level} />
                    <LanguageBadge language={featuredFreeStory.language} />
                    <RegionBadge region={featuredFreeStory.region} />
                  </div>
                  <p>{formatTopic(featuredFreeStory.topic)}</p>
                </div>
              </div>
            </Link>
          </div>
        </section>
      )}

      {/* Continue listening */}
      {isPersonalizationReady && continueListening.length > 0 && (
        <section className="w-full max-w-5xl text-center pt-8 md:pt-10 mb-10 md:mb-12">
          <h2 className="text-2xl font-semibold mb-6 text-[var(--foreground)]">Continue listening</h2>

          <div className="md:hidden">
            <StoryCarousel
              items={mobileContinueCards}
              renderItem={(entry) =>
                renderContinueCard(entry.item, {
                  recommendation: entry.kind === "recommendation",
                  reason: entry.reason,
                })
              }
            />
          </div>

          <div className="hidden md:block">
            {continueListening.length <= 3 ? (
              <div className="flex justify-center gap-4">
                {continueListening.map((item) => (
                  <div
                    key={`${item.bookSlug}:${item.storySlug}`}
                    className={continueDesktopCardWidthClass}
                  >
                    {renderContinueCard(item)}
                  </div>
                ))}
              </div>
            ) : (
              <div>
                <StoryCarousel
                  items={continueListening}
                  renderItem={(item) => renderContinueCard(item)}
                />
              </div>
            )}
          </div>
        </section>
      )}

      {isPersonalizationReady && featuredFreeStory && continueListening.length > 0 && (
        <section className="w-full max-w-5xl text-center mb-10 md:mb-12">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--primary)] mb-3">
            {featuredFreeStory.label}
          </p>
          <h2 className="text-2xl font-semibold mb-6 text-[var(--foreground)]">Your free story</h2>
          <div className="max-w-[520px] mx-auto">
            <Link
              href={featuredFreeStory.href}
              className="flex flex-col bg-[var(--card-bg)] hover:bg-[var(--card-bg-hover)] border border-[var(--card-border)] transition-all duration-200 rounded-2xl overflow-hidden shadow-md h-full cursor-pointer"
            >
              <div className="w-full aspect-[16/10] bg-[color:var(--surface)]">
                <img
                  src={featuredFreeStory.cover}
                  alt={featuredFreeStory.title}
                  className="object-contain w-full h-full"
                />
              </div>
              <div className="p-5 flex flex-col flex-1 text-left">
                <div>
                  <h3 className="text-xl font-semibold mb-2 text-[var(--foreground)] line-clamp-2">
                    {featuredFreeStory.title}
                  </h3>
                  <p className="text-[var(--primary)] text-sm leading-relaxed line-clamp-1">
                    {featuredFreeStory.bookTitle}
                  </p>
                </div>
                <div className="mt-3 text-sm text-[var(--muted)] space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <LevelBadge level={featuredFreeStory.level} />
                    <LanguageBadge language={featuredFreeStory.language} />
                    <RegionBadge region={featuredFreeStory.region} />
                  </div>
                  <p>{formatTopic(featuredFreeStory.topic)}</p>
                </div>
              </div>
            </Link>
          </div>
        </section>
      )}

      {canShowPersonalizedRecommendations && recommendedStories.length > 0 && (
        <section className="mb-10 md:mb-12 text-center w-full max-w-5xl">
          <div className="mb-6">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--primary)] mb-2">
              Premium personalization
            </p>
            <h2 className="text-2xl font-semibold text-[var(--foreground)]">Recommended for you</h2>
          </div>

          <div>
            <StoryCarousel
              items={recommendedStories}
              renderItem={(story) => (
                <Link
                  key={story.key}
                  href={withReturnContext(`/books/${story.bookSlug}/${story.storySlug}`)}
                  className="flex flex-col bg-[var(--card-bg)] hover:bg-[var(--card-bg-hover)] border border-[var(--card-border)] transition-all duration-200 rounded-2xl overflow-hidden shadow-md h-full cursor-pointer"
                >
                  <div className="w-full h-48 bg-[color:var(--surface)]">
                    <img
                      src={story.coverUrl}
                      alt={story.storyTitle}
                      className="object-cover w-full h-full"
                    />
                  </div>

                  <div className="p-5 flex flex-col flex-1 text-left">
                    <div>
                      <p className="inline-flex text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--foreground)] bg-[var(--chip-bg)] border border-[var(--chip-border)] rounded-full px-2 py-0.5 mb-2">
                        {story.reason}
                      </p>
                      <h3 className="text-xl font-semibold mb-2 text-[var(--foreground)] line-clamp-2">
                        {story.storyTitle}
                      </h3>
                      <p className="text-[var(--primary)] text-sm leading-relaxed line-clamp-1">
                        {story.bookTitle}
                      </p>
                    </div>

                    <div className="mt-3 text-sm text-[var(--muted)] space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <LevelBadge level={story.level} />
                        <LanguageBadge language={story.language} />
                        <RegionBadge region={story.region} />
                      </div>
                      <p>{formatTopic(story.topic)}</p>
                    </div>
                  </div>
                </Link>
              )}
            />
          </div>
        </section>
      )}

      {/* Latest Books */}
      <section className="mb-10 md:mb-12 text-center w-full max-w-5xl">
        <h2 className="text-2xl font-semibold mb-6 text-[var(--foreground)]">Latest Books</h2>

        <div className="md:hidden">
          <StoryCarousel
            items={filteredBooks.slice(0, MOBILE_LIMIT)}
            mobileItemClassName="w-[82%] sm:w-[62%]"
            renderItem={(book) => (
              <BookHorizontalCard
                key={book.slug}
                href={`/books/${book.slug}?from=home`}
                title={book.title}
                cover={book.cover}
                level={book.level}
                language={book.language}
                region={book.region}
                statsLine={bookMetaBySlug.get(book.slug)?.statsLine}
                topicsLine={bookMetaBySlug.get(book.slug)?.topicsLine}
                description={book.description}
              />
            )}
          />
        </div>

        <div className="hidden md:block">
          <ReleaseCarousel
            items={filteredBooks.slice(0, DESKTOP_LIMIT)}
            itemClassName="md:flex-[0_0_46%] lg:flex-[0_0_46%] xl:flex-[0_0_46%]"
            renderItem={(book) => (
              <BookHorizontalCard
                title={book.title}
                cover={book.cover}
                level={book.level}
                language={book.language}
                region={book.region}
                statsLine={bookMetaBySlug.get(book.slug)?.statsLine}
                topicsLine={bookMetaBySlug.get(book.slug)?.topicsLine}
                description={book.description}
                href={`/books/${book.slug}?from=home`}
              />
            )}
          />
        </div>
      </section>

      {/* Latest Stories */}
      <section
        data-tour-target="reader"
        className={`mb-10 md:mb-12 text-center w-full max-w-5xl ${getTourSectionClass("reader")}`}
      >
        <h2 className="text-2xl font-semibold mb-6 text-[var(--foreground)]">Latest Stories</h2>

        <div>
          <StoryCarousel
            items={latestHomeStories}
            renderItem={(story) => {
              return (
              <Link
                key={story.key}
                href={story.href}
                className="flex flex-col bg-[var(--card-bg)] hover:bg-[var(--card-bg-hover)] border border-[var(--card-border)] transition-all duration-200 rounded-2xl overflow-hidden shadow-md cursor-pointer"
              >
                <div className="w-full h-48 bg-[color:var(--surface)]">
                  <img
                    src={story.coverUrl}
                    alt={story.title}
                    className="object-cover w-full h-full"
                  />
                </div>

                <div className="p-5 flex flex-col text-left">
                  <div>
                    <h3 className="text-xl font-semibold mb-2 text-[var(--foreground)] line-clamp-2">
                      {story.title}
                    </h3>
                    <p className="text-[var(--primary)] text-sm leading-relaxed line-clamp-1">
                      {story.subtitle}
                    </p>
                  </div>

                  <div className="mt-3 text-sm text-[var(--muted)]">
                    <div className="flex flex-wrap items-center gap-2">
                      <LevelBadge level={story.level} />
                      <LanguageBadge language={story.language} />
                      <RegionBadge region={story.region} />
                    </div>
                  </div>
                </div>
              </Link>
              );
            }}
          />
        </div>

        <div className="md:hidden mt-4 text-[var(--muted)] text-sm">
          Showing {Math.min(MOBILE_LIMIT, latestHomeStories.length)} of {latestHomeStories.length}
        </div>
      </section>
      </>
    </div>
  );
}
