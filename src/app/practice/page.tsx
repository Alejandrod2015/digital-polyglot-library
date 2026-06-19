"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenText,
  ChevronDown,
  Clock,
  Crown,
  Flame,
  Headphones,
  Home,
  MessageCircleMore,
  Play,
  Rocket,
  RotateCcw,
  Shapes,
  Sparkles,
  Target,
  TrendingUp,
  Volume2,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { getLanguageCountry } from "@/lib/languageFlags";
import Flag from "@/components/Flag";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import {
  buildPracticeSession,
  getRecommendedPracticeModeFromOnboarding,
  getDuePracticeItems,
  getSpeechSynthesisLang,
  sortPracticeItemsByDueness,
  PracticeAudioClip,
  PracticeExercise,
  PracticeFavoriteItem,
  PracticeMode,
} from "@/lib/practiceExercises";
import {
  coerceAudioSegments,
  findBestAudioSegment,
  findBestAudioSegmentLegacy,
  type AudioSegment,
} from "@/lib/audioSegments";
import {
  sortPracticeItemsByOnboarding,
  type OnboardingGoal,
  type OnboardingPracticePrefs,
} from "@/lib/onboarding";
import { isStandaloneSourcePath } from "@/lib/storySource";
import { PracticeExitConfirm } from "@/components/PracticeExitConfirm";
import { PracticeCountdown } from "@/components/PracticeCountdown";
import { Confetti } from "@/components/Confetti";

type LoadState = "loading" | "ready" | "error";
type StoryAudioData = {
  audioUrl: string | null;
  audioSegments: AudioSegment[];
};

type JourneyPracticeSource = {
  variantId?: string | null;
  level?: {
    id: string;
    title: string;
    subtitle: string;
  } | null;
  topic?: {
    id: string;
    slug: string;
    label: string;
    storyCount: number;
  } | null;
  review?: {
    dueCount: number;
    totalCount: number;
    focusWords?: string[];
  } | null;
  items: PracticeFavoriteItem[];
  exercises?: PracticeExercise[];
  checkpointToken?: string;
};

function getFavoritesCacheKey(userId?: string | null) {
  return `dp_favorites_${userId ?? "guest"}`;
}

function readLocalPracticeFavorites(userId?: string | null): PracticeFavoriteItem[] {
  if (typeof window === "undefined") return [];

  const candidates = [getFavoritesCacheKey(userId), "favorites"];
  for (const key of candidates) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as PracticeFavoriteItem[];
      if (Array.isArray(parsed)) {
        return parsed.map((item) => ({
          ...item,
          practiceSource: item.practiceSource ?? "user_saved",
        }));
      }
    } catch {
      // ignore invalid cache
    }
  }

  return [];
}

async function readCachedJson<T>(requestUrl: string): Promise<T | null> {
  if (typeof window === "undefined" || !("caches" in window)) return null;

  try {
    const request = new Request(new URL(requestUrl, window.location.origin).toString(), {
      method: "GET",
      credentials: "same-origin",
    });
    const cached = await window.caches.match(request);
    if (!cached) return null;
    return (await cached.json()) as T;
  } catch {
    return null;
  }
}

function normalizeStorySlug(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function findSegmentForClip(
  storyAudio: StoryAudioData | null | undefined,
  clip: PracticeAudioClip | null | undefined
): AudioSegment | null {
  if (!storyAudio || !clip) return null;
  if (clip.storySource !== "standalone") {
    return findBestAudioSegmentLegacy(storyAudio.audioSegments, clip.sentence);
  }
  const segmentId = typeof clip.segmentId === "string" ? clip.segmentId.trim() : "";

  const exactById =
    segmentId
      ? storyAudio.audioSegments.find((segment) => segment.id === segmentId) ?? null
      : null;

  if (exactById) return exactById;

  return findBestAudioSegment(storyAudio.audioSegments, clip.sentence, {
    targetWord: clip.targetWord,
    mode: "strict",
  });
}

function isStandaloneFavorite(item: PracticeFavoriteItem): boolean {
  return isStandaloneSourcePath(item.sourcePath, item.storySlug);
}

function isExpressionLikeFavorite(item: PracticeFavoriteItem): boolean {
  const word = typeof item.word === "string" ? item.word.trim() : "";
  const wordType = typeof item.wordType === "string" ? item.wordType.toLowerCase() : "";
  return word.includes(" ") || /expression|phrase|idiom|chunk|connector/.test(wordType);
}

function getModeLabel(mode: PracticeMode): string {
  switch (mode) {
    case "meaning":
      return "Meaning";
    case "context":
      return "Context";
    case "natural":
      return "Natural usage";
    case "listening":
      return "Listening";
    case "match":
      return "Match";
  }
}

const matchColorClasses = [
  "border-sky-400 bg-sky-400/18 text-sky-100",
  "border-emerald-400 bg-emerald-400/18 text-emerald-100",
  "border-amber-300 bg-amber-300/18 text-amber-100",
  "border-fuchsia-400 bg-fuchsia-400/18 text-fuchsia-100",
  "border-cyan-300 bg-cyan-300/18 text-cyan-100",
  "border-rose-400 bg-rose-400/18 text-rose-100",
];

const modeThemeByMode: Record<
  PracticeMode,
  {
    title: string;
    eyebrow: string;
    detail: string;
    caption: string;
    icon: LucideIcon;
    iconClass: string;
    badgeClass: string;
    panelGlow: string;
    accentBar: string;
    shellClass: string;
    orbClass: string;
    buttonClass: string;
  }
> = {
  meaning: {
    title: "Meaning",
    eyebrow: "Word quest",
    detail: "Choose the meaning that fits a word in context.",
    caption: "Best for locking in definitions with real usage.",
    icon: Sparkles,
    iconClass: "bg-amber-300/18 text-amber-100 ring-1 ring-amber-200/30",
    badgeClass: "border-amber-200/30 bg-amber-300/12 text-amber-100",
    panelGlow: "from-amber-200/14 via-transparent",
    accentBar: "from-amber-300 via-yellow-200 to-orange-200",
    shellClass: "border-amber-200/20 bg-[linear-gradient(180deg,rgba(72,74,47,0.92),rgba(49,58,46,0.96))]",
    orbClass: "bg-[radial-gradient(circle,rgba(252,211,77,0.34),transparent_68%)]",
    buttonClass: "bg-amber-300 text-slate-950 shadow-[0_8px_20px_rgba(252,211,77,0.22)]",
  },
  context: {
    title: "Context",
    eyebrow: "Sentence run",
    detail: "Complete short sentences with the right word or expression.",
    caption: "Best for recall and sentence-level usage.",
    icon: MessageCircleMore,
    iconClass: "bg-emerald-300/18 text-emerald-100 ring-1 ring-emerald-200/30",
    badgeClass: "border-emerald-200/30 bg-emerald-300/12 text-emerald-100",
    panelGlow: "from-emerald-200/14 via-transparent",
    accentBar: "from-emerald-300 via-teal-200 to-cyan-200",
    shellClass: "border-emerald-200/20 bg-[linear-gradient(180deg,rgba(39,78,71,0.94),rgba(34,62,64,0.98))]",
    orbClass: "bg-[radial-gradient(circle,rgba(110,231,183,0.28),transparent_68%)]",
    buttonClass: "bg-emerald-300 text-slate-950 shadow-[0_8px_20px_rgba(110,231,183,0.2)]",
  },
  natural: {
    title: "Natural usage",
    eyebrow: "Phrase flow",
    detail: "Spot the expression that sounds right in real language.",
    caption: "Best for phrases, connectors, and colloquial language.",
    icon: BookOpenText,
    iconClass: "bg-sky-300/18 text-sky-100 ring-1 ring-sky-200/30",
    badgeClass: "border-sky-200/30 bg-sky-300/12 text-sky-100",
    panelGlow: "from-sky-200/14 via-transparent",
    accentBar: "from-sky-300 via-cyan-200 to-blue-200",
    shellClass: "border-sky-200/20 bg-[linear-gradient(180deg,rgba(40,73,101,0.94),rgba(31,53,83,0.98))]",
    orbClass: "bg-[radial-gradient(circle,rgba(125,211,252,0.28),transparent_68%)]",
    buttonClass: "bg-sky-300 text-slate-950 shadow-[0_8px_20px_rgba(125,211,252,0.18)]",
  },
  listening: {
    title: "Listening",
    eyebrow: "Sound check",
    detail: "Hear a word and choose what was said.",
    caption: "Best for audio recognition and fast review.",
    icon: Headphones,
    iconClass: "bg-fuchsia-300/18 text-fuchsia-100 ring-1 ring-fuchsia-200/30",
    badgeClass: "border-fuchsia-200/30 bg-fuchsia-300/12 text-fuchsia-100",
    panelGlow: "from-fuchsia-200/14 via-transparent",
    accentBar: "from-fuchsia-300 via-pink-200 to-rose-200",
    shellClass: "border-fuchsia-200/20 bg-[linear-gradient(180deg,rgba(80,54,91,0.94),rgba(64,42,84,0.98))]",
    orbClass: "bg-[radial-gradient(circle,rgba(244,114,182,0.28),transparent_68%)]",
    buttonClass: "bg-fuchsia-300 text-slate-950 shadow-[0_8px_20px_rgba(244,114,182,0.2)]",
  },
  match: {
    title: "Match",
    eyebrow: "Pair rush",
    detail: "Match saved words to their meanings in quick sets.",
    caption: "Best for fast warm-up rounds.",
    icon: Shapes,
    iconClass: "bg-cyan-300/18 text-cyan-100 ring-1 ring-cyan-200/30",
    badgeClass: "border-cyan-200/30 bg-cyan-300/12 text-cyan-100",
    panelGlow: "from-cyan-200/14 via-transparent",
    accentBar: "from-cyan-300 via-sky-200 to-indigo-200",
    shellClass: "border-cyan-200/20 bg-[linear-gradient(180deg,rgba(38,80,92,0.94),rgba(31,62,79,0.98))]",
    orbClass: "bg-[radial-gradient(circle,rgba(103,232,249,0.28),transparent_68%)]",
    buttonClass: "bg-cyan-300 text-slate-950 shadow-[0_8px_20px_rgba(103,232,249,0.2)]",
  },
};

const CLIP_START_PADDING_SEC = 0.08;
const CLIP_END_TRIM_SEC = 0.5;
const CHECKPOINT_PASS_THRESHOLD = 0.8;

type FeedbackTone = "correct" | "wrong";

// Combo tiers + labels mirror the iPhone (apps/mobile getPracticeComboTier /
// getPracticeComboLabel) so the streak celebration reads the same on both
// clients: a toast pill appears from a 2-in-a-row streak and escalates.
type ComboTier = 0 | 1 | 2 | 3 | 4 | 5;
function getComboTier(streak: number): ComboTier {
  if (streak >= 10) return 5;
  if (streak >= 8) return 4;
  if (streak >= 6) return 3;
  if (streak >= 4) return 2;
  if (streak >= 2) return 1;
  return 0;
}
function getComboLabel(streak: number, tier: ComboTier): string {
  if (tier >= 5) return `Perfect x${streak}`;
  if (tier === 4) return `On fire x${streak}`;
  if (tier === 3) return `Hot streak x${streak}`;
  return `Bonus x${streak}`;
}


function scoreSpeechVoice(voice: SpeechSynthesisVoice, lang: string) {
  const voiceLang = (voice.lang ?? "").toLowerCase();
  const targetLang = lang.toLowerCase();
  const targetBase = targetLang.split("-")[0];
  const voiceName = (voice.name ?? "").toLowerCase();

  if (!voiceLang.startsWith(targetBase)) return Number.NEGATIVE_INFINITY;

  let score = 0;

  if (voiceLang === targetLang) score += 140;
  else if (voiceLang.startsWith(targetLang)) score += 120;
  else score += 80;

  if (/google/.test(voiceName)) score += 120;
  if (/microsoft/.test(voiceName)) score += 105;
  if (/neural|natural|premium|enhanced|wavenet/.test(voiceName)) score += 90;
  if (!voice.localService) score += 40;
  if (/desktop/.test(voiceName)) score += 25;

  if (/compact|eloquence|whisper|novelty|bubbles|trinoids|zarvox/i.test(voice.name ?? "")) {
    score -= 180;
  }

  return score;
}

function selectPreferredSpeechVoice(voices: SpeechSynthesisVoice[], lang: string) {
  const ranked = voices
    .map((voice) => ({ voice, score: scoreSpeechVoice(voice, lang) }))
    .filter((entry) => Number.isFinite(entry.score))
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.voice ?? null;
}

export default function PracticePage() {
  const { user, isLoaded } = useUser();
  const searchParams = useSearchParams();
  const [favorites, setFavorites] = useState<PracticeFavoriteItem[]>([]);
  const [prefabExercises, setPrefabExercises] = useState<PracticeExercise[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [selectedMode, setSelectedMode] = useState<PracticeMode | null>(null);
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [matchAnswers, setMatchAnswers] = useState<Record<string, string>>({});
  const [activeMatchWord, setActiveMatchWord] = useState<string | null>(null);
  const [revealedIds, setRevealedIds] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [pendingCountdownMode, setPendingCountdownMode] = useState<PracticeMode | null>(null);
  // Fires once: when the user arrives from the end-of-story "Start practice"
  // prompt, we open the session directly instead of leaving them on the
  // dashboard hub (the intent is to practice THAT story, not browse the hub).
  const storyAutoStartedRef = useRef(false);
  const [languageSwitcherOpen, setLanguageSwitcherOpen] = useState(false);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [lastResult, setLastResult] = useState<"correct" | "wrong" | null>(null);
  // Combo toast (iPhone parity): an animated celebration pill that pops in the
  // header when the streak hits a tier (≥2 in a row) and auto-dismisses.
  const [comboToast, setComboToast] = useState<{ streak: number; tier: ComboTier; label: string } | null>(null);
  const comboDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Per-exercise countdown (iPhone parity): multiple-choice gets 10 s; when it
  // hits 0 without an answer the exercise reveals as wrong (timeout-as-wrong),
  // mirroring the mobile flow. Match keeps its own pace and is excluded.
  const [timerRemaining, setTimerRemaining] = useState(10);
  // Wall-clock duration of the round, captured when the session completes so
  // the result card can show a "time" stat like the iPhone version.
  const [sessionDurationMs, setSessionDurationMs] = useState<number | null>(null);
  const sessionStartRef = useRef<number | null>(null);
  // Tracks the last context exercise whose sentence audio we auto-played on
  // reveal, so the effect fires exactly once per reveal (iPhone parity).
  const contextRevealAudioRef = useRef<string | null>(null);
  // Tracks the last meaning exercise whose target word we auto-played on
  // appearance (iPhone autoplays the word so the learner hears it while
  // choosing the meaning). Fires once per exercise.
  const meaningAutoplayedRef = useRef<string | null>(null);
  // True for ~1.4s when a tier-5 combo (10-in-a-row) lands, driving the
  // in-session confetti burst - same as the iPhone's comboBurst.
  const [comboBurst, setComboBurst] = useState(false);
  const comboBurstDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Words the user got wrong this round (for the result card's "Fix N" action).
  const [missedWords, setMissedWords] = useState<string[]>([]);
  const [playingClipId, setPlayingClipId] = useState<string | null>(null);
  const [speakingClipId, setSpeakingClipId] = useState<string | null>(null);
  const [hqClipId, setHqClipId] = useState<string | null>(null);
  const [hqUrlBySentence, setHqUrlBySentence] = useState<Record<string, string>>({});
  const [userStoryAudioBySlug, setUserStoryAudioBySlug] = useState<Record<string, StoryAudioData>>({});
  const [standaloneStoryAudioBySlug, setStandaloneStoryAudioBySlug] = useState<Record<string, StoryAudioData>>({});
  const clipAudioRef = useRef<HTMLAudioElement | null>(null);
  const clipStopAtRef = useRef<number | null>(null);
  const clipTimeHandlerRef = useRef<(() => void) | null>(null);
  const feedbackAudioContextRef = useRef<AudioContext | null>(null);
  const feedbackSoundRefs = useRef<Record<FeedbackTone, HTMLAudioElement | null>>({
    correct: null,
    wrong: null,
  });
  // Celebratory chime reused for both combo toasts (tiered volume) and the
  // end-of-session perfect run - same asset the iPhone uses (practice-perfect).
  const comboSoundRef = useRef<HTMLAudioElement | null>(null);
  const perfectChimePlayedRef = useRef(false);
  const practiceSource = searchParams.get("source");
  const storyPracticeSlug = searchParams.get("storySlug");
  const storyPracticeBookSlug = searchParams.get("bookSlug");
  const storyPracticeTitle = searchParams.get("storyTitle");
  const storyReturnHref = searchParams.get("storyHref");
  const storyNextHref = searchParams.get("nextHref");
  const journeyVariant = searchParams.get("variant");
  const journeyLevelId = searchParams.get("levelId");
  const journeyTopicId = searchParams.get("topicId");
  const explicitReturnTo = searchParams.get("returnTo");
  const explicitReturnLabel = searchParams.get("returnLabel");
  const isReviewFocus = searchParams.get("review") === "1";
  const requestedModeParam = searchParams.get("mode");
  const isJourneyCheckpoint = searchParams.get("checkpoint") === "1";
  const isJourneyPractice = practiceSource === "journey" && Boolean(journeyLevelId) && Boolean(journeyTopicId);
  const isStoryPractice = practiceSource === "story" && Boolean(storyPracticeSlug);
  const journeyReturnHref =
    isJourneyPractice && journeyLevelId && journeyTopicId
      ? explicitReturnTo && explicitReturnTo.startsWith("/") && !explicitReturnTo.startsWith("//")
        ? explicitReturnTo
        : `/${journeyVariant ? `?variant=${encodeURIComponent(journeyVariant)}` : ""}`
      : null;
  const [checkpointSaveState, setCheckpointSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [checkpointToken, setCheckpointToken] = useState<string | null>(null);
  const [checkpointResponses, setCheckpointResponses] = useState<Record<string, string>>({});
  const [journeyReviewMeta, setJourneyReviewMeta] = useState<JourneyPracticeSource["review"]>(null);
  const [practiceStreakDays, setPracticeStreakDays] = useState<number>(0);
  const practiceStartTrackedRef = useRef(false);
  const practiceCompletionTrackedRef = useRef(false);
  const autoOpenedModeRef = useRef<string | null>(null);
  const onboardingPracticePrefs = useMemo<OnboardingPracticePrefs>(() => {
    const metadata = user?.publicMetadata ?? {};
    const interests = Array.isArray(metadata.interests)
      ? metadata.interests.filter((value): value is string => typeof value === "string")
      : [];
    return {
      interests,
      learningGoal: typeof metadata.learningGoal === "string" ? (metadata.learningGoal as OnboardingGoal) : null,
      dailyMinutes: typeof metadata.dailyMinutes === "number" ? metadata.dailyMinutes : null,
    };
  }, [user]);
  const trackUiMetric = useCallback(
    async (
      eventType: "checkpoint_recovery_clicked" | "practice_recommended_mode_opened",
      metadata?: Record<string, unknown>
    ) => {
      if (!user) return;

      try {
        await fetch("/api/metrics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookSlug: "journey",
            storySlug: journeyTopicId || "practice",
            eventType,
            metadata: {
              variantId: journeyVariant,
              levelId: journeyLevelId,
              topicId: journeyTopicId,
              reviewFocus: isReviewFocus,
              checkpoint: isJourneyCheckpoint,
              ...metadata,
            },
          }),
        });
      } catch {
        // Best-effort analytics only.
      }
    },
    [isJourneyCheckpoint, isReviewFocus, journeyLevelId, journeyTopicId, journeyVariant, user]
  );

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) {
      setFavorites([]);
      setPrefabExercises([]);
      setUserStoryAudioBySlug({});
      setStandaloneStoryAudioBySlug({});
      setLoadState("ready");
      return;
    }

    let cancelled = false;

    const load = async () => {
      const requestUrl =
        isJourneyPractice && journeyLevelId && journeyTopicId
          ? `/api/journey/practice?levelId=${encodeURIComponent(journeyLevelId)}&topicId=${encodeURIComponent(
              journeyTopicId
            )}${journeyVariant ? `&variant=${encodeURIComponent(journeyVariant)}` : ""}${isJourneyCheckpoint ? "&kind=checkpoint" : ""}`
          : isStoryPractice && storyPracticeSlug
            ? `/api/story-practice?storySlug=${encodeURIComponent(storyPracticeSlug)}${
                storyPracticeBookSlug ? `&bookSlug=${encodeURIComponent(storyPracticeBookSlug)}` : ""
              }`
          : "/api/favorites";

      try {
        setLoadState("loading");
        const res = await fetch(requestUrl, { cache: "no-store" });
        if (!res.ok) throw new Error(`Error ${res.status}`);
        const data = (await res.json()) as PracticeFavoriteItem[] | JourneyPracticeSource;
        if (!cancelled) {
          // Default favorites mode: pre-sort by FSRS dueness so the practice
          // queue starts with the most-overdue items. Journey and story
          // practice keep their server-defined order (curriculum / story
          // sequence is intentional there).
          const rawItems = Array.isArray(data)
            ? data
            : Array.isArray(data.items)
              ? data.items
              : [];
          const isDefaultFavoritesMode = !isJourneyPractice && !isStoryPractice;
          setFavorites(isDefaultFavoritesMode ? sortPracticeItemsByDueness(rawItems) : rawItems);
          setPrefabExercises(!Array.isArray(data) && Array.isArray(data.exercises) ? data.exercises : []);
          setCheckpointToken(!Array.isArray(data) && typeof data.checkpointToken === "string" ? data.checkpointToken : null);
          setJourneyReviewMeta(
            !Array.isArray(data) && data.review && typeof data.review === "object" ? data.review : null
          );
          setLoadState("ready");
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          const cachedData = await readCachedJson<PracticeFavoriteItem[] | JourneyPracticeSource>(requestUrl);
          if (cachedData) {
            const cachedItems = Array.isArray(cachedData)
              ? cachedData
              : Array.isArray(cachedData.items)
                ? cachedData.items
                : [];
            const isDefaultFavoritesMode = !isJourneyPractice && !isStoryPractice;
            setFavorites(
              isDefaultFavoritesMode ? sortPracticeItemsByDueness(cachedItems) : cachedItems
            );
            setPrefabExercises(
              !Array.isArray(cachedData) && Array.isArray(cachedData.exercises)
                ? cachedData.exercises
                : []
            );
            setCheckpointToken(
              !Array.isArray(cachedData) && typeof cachedData.checkpointToken === "string"
                ? cachedData.checkpointToken
                : null
            );
            setJourneyReviewMeta(
              !Array.isArray(cachedData) && cachedData.review && typeof cachedData.review === "object"
                ? cachedData.review
                : null
            );
            setLoadState("ready");
            return;
          }

          if (!isJourneyPractice && !isStoryPractice) {
            const localFavorites = readLocalPracticeFavorites(user?.id ?? null);
            setFavorites(sortPracticeItemsByDueness(localFavorites));
            setPrefabExercises([]);
            setCheckpointToken(null);
            setLoadState(localFavorites.length > 0 ? "ready" : "error");
            return;
          }

          setFavorites([]);
          setPrefabExercises([]);
          setCheckpointToken(null);
          setJourneyReviewMeta(null);
          setLoadState("error");
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [
    isJourneyCheckpoint,
    isJourneyPractice,
    isLoaded,
    isStoryPractice,
    journeyLevelId,
    journeyTopicId,
    journeyVariant,
    storyPracticeBookSlug,
    storyPracticeSlug,
    user,
  ]);

  useEffect(() => {
    const userStorySlugs = Array.from(
      new Set(
        favorites
          .filter((favorite) => !isStandaloneFavorite(favorite))
          .map((favorite) => (typeof favorite.storySlug === "string" ? favorite.storySlug.trim() : ""))
          .filter(Boolean)
      )
    );

    if (userStorySlugs.length === 0) {
      setUserStoryAudioBySlug({});
    }

    const standaloneStorySlugs = Array.from(
      new Set(
        favorites
          .filter((favorite) => isStandaloneFavorite(favorite))
          .map((favorite) => (typeof favorite.storySlug === "string" ? favorite.storySlug.trim() : ""))
          .filter(Boolean)
      )
    );

    if (standaloneStorySlugs.length === 0) {
      setStandaloneStoryAudioBySlug({});
    }

    let cancelled = false;

    const loadUserStoryAudio = async () => {
      if (userStorySlugs.length === 0) return;
      try {
        const res = await fetch(`/api/user-stories?slugs=${encodeURIComponent(userStorySlugs.join(","))}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`Error ${res.status}`);
        const data = (await res.json()) as {
          stories?: Array<{ slug?: string; audioUrl?: string | null; audioSegments?: unknown }>;
        };

        if (cancelled) return;

        const next: Record<string, StoryAudioData> = {};
        for (const story of data.stories ?? []) {
          const slug = normalizeStorySlug(story.slug);
          if (!slug) continue;
          next[slug] = {
            audioUrl: typeof story.audioUrl === "string" ? story.audioUrl : null,
            audioSegments: coerceAudioSegments(story.audioSegments),
          };
        }
        setUserStoryAudioBySlug(next);
      } catch (error) {
        console.error("[practice] failed to load user story audio segments", error);
        if (!cancelled) setUserStoryAudioBySlug({});
      }
    };

    const loadStandaloneStoryAudio = async () => {
      if (standaloneStorySlugs.length === 0) return;
      try {
        const res = await fetch(
          `/api/standalone-story-audio?slugs=${encodeURIComponent(standaloneStorySlugs.join(","))}`,
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error(`Error ${res.status}`);
        const data = (await res.json()) as {
          stories?: Array<{ slug?: string; audioUrl?: string | null; audioSegments?: unknown }>;
        };

        if (cancelled) return;

        const next: Record<string, StoryAudioData> = {};
        for (const story of data.stories ?? []) {
          const slug = normalizeStorySlug(story.slug);
          if (!slug) continue;
          next[slug] = {
            audioUrl: typeof story.audioUrl === "string" ? story.audioUrl : null,
            audioSegments: coerceAudioSegments(story.audioSegments),
          };
        }
        setStandaloneStoryAudioBySlug(next);
      } catch (error) {
        console.error("[practice] failed to load standalone story audio segments", error);
        if (!cancelled) setStandaloneStoryAudioBySlug({});
      }
    };

    void loadUserStoryAudio();
    void loadStandaloneStoryAudio();

    return () => {
      cancelled = true;
    };
  }, [favorites]);

  const orderedFavorites = useMemo(
    () => sortPracticeItemsByOnboarding(favorites, onboardingPracticePrefs, true),
    [favorites, onboardingPracticePrefs]
  );
  const exercises = useMemo(() => {
    if (isJourneyCheckpoint) return prefabExercises;
    return selectedMode ? buildPracticeSession(orderedFavorites, selectedMode, onboardingPracticePrefs) : [];
  }, [isJourneyCheckpoint, onboardingPracticePrefs, orderedFavorites, prefabExercises, selectedMode]);
  const currentExercise = exercises[exerciseIndex] ?? null;
  const inferredModeFromExercise: PracticeMode | null =
    currentExercise?.type === "meaning_in_context"
      ? "meaning"
      : currentExercise?.type === "fill_blank"
        ? "context"
        : currentExercise?.type === "natural_expression"
          ? "natural"
          : currentExercise?.type === "listen_choose"
            ? "listening"
            : currentExercise?.type === "match_meaning"
              ? "match"
              : null;
  const activePracticeMode = selectedMode ?? inferredModeFromExercise;
  const revealed = currentExercise ? revealedIds.includes(currentExercise.id) : false;
  const activeSession = selectedMode !== null || (isJourneyCheckpoint && exercises.length > 0);
  const completedExerciseCount = sessionComplete ? exercises.length : revealedIds.length;
  const progressPercent =
    exercises.length > 0 ? Math.min(100, (completedExerciseCount / exercises.length) * 100) : 0;
  const showFeedback = Boolean(revealed && currentExercise);
  const canSubmitAnswer = currentExercise
    ? currentExercise.type === "match_meaning"
      ? currentExercise.pairs.every((pair) => Boolean(matchAnswers[pair.word]))
      : Boolean(selectedOption)
    : false;

  const openSession = useCallback((mode: PracticeMode) => {
    if (typeof window !== "undefined") {
      window.history.pushState({ practiceSession: true }, "", window.location.href);
    }
    setSelectedMode(mode);
  }, []);

  const closeSession = useCallback(() => {
    setShowExitConfirm(false);
    if (isJourneyPractice && journeyReturnHref) {
      window.location.href = journeyReturnHref;
      return;
    }
    if (isStoryPractice && storyReturnHref) {
      window.location.href = storyReturnHref;
      return;
    }
    if (typeof window !== "undefined" && window.history.state?.practiceSession) {
      window.history.back();
      return;
    }
    setSelectedMode(null);
  }, [isJourneyPractice, isStoryPractice, journeyReturnHref, storyReturnHref]);
  const hasSessionProgress = revealedIds.length > 0;
  const attemptCloseSession = useCallback(() => {
    if (!sessionComplete && hasSessionProgress) {
      setShowExitConfirm(true);
      return;
    }
    closeSession();
  }, [closeSession, hasSessionProgress, sessionComplete]);

  const trackPracticeMetric = useCallback(
    async (
      eventType: "practice_session_started" | "practice_session_completed",
      extra?: Record<string, unknown>
    ) => {
      if (!user) return;

      const firstExerciseWithStorySlug = exercises.find(
        (exercise): exercise is Extract<PracticeExercise, { storySlug?: string | null }> =>
          "storySlug" in exercise && typeof exercise.storySlug === "string" && exercise.storySlug.trim().length > 0
      );

      try {
        await fetch("/api/metrics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storySlug: firstExerciseWithStorySlug?.storySlug?.trim() || "practice",
            eventType,
            metadata: {
              mode: activePracticeMode ?? "mixed",
              itemsCount: exercises.length,
              score,
              source: isJourneyPractice ? "journey" : "practice",
              storyTitle: storyPracticeTitle,
              isJourneyCheckpoint,
              levelId: journeyLevelId,
              topicId: journeyTopicId,
              variantId: journeyVariant,
              ...extra,
            },
          }),
        });
      } catch (error) {
        console.error("[practice] failed to track practice metric", error);
      }
    },
    [
      activePracticeMode,
      exercises,
      isJourneyCheckpoint,
      isJourneyPractice,
      journeyLevelId,
      journeyTopicId,
      score,
      storyPracticeTitle,
      user,
    ]
  );

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.dataset.practiceActive = activeSession ? "true" : "false";
    window.dispatchEvent(new Event("practice-session-visibility-change"));
    return () => {
      document.body.dataset.practiceActive = "false";
      window.dispatchEvent(new Event("practice-session-visibility-change"));
    };
  }, [activeSession]);

  useEffect(() => {
    if (typeof window === "undefined" || !activeSession) return;

    const handlePopState = () => {
      setSelectedMode(null);
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [activeSession]);

  useEffect(() => {
    setExerciseIndex(0);
    setSelectedOption(null);
    setMatchAnswers({});
    setActiveMatchWord(null);
    setRevealedIds([]);
    setScore(0);
    setSessionComplete(false);
    setStreak(0);
    setMaxStreak(0);
    setLastResult(null);
    setTimerRemaining(10);
    setSessionDurationMs(null);
    setMissedWords([]);
    setComboToast(null);
    setComboBurst(false);
    perfectChimePlayedRef.current = false;
    sessionStartRef.current = Date.now();
    setCheckpointSaveState("idle");
    setCheckpointResponses({});
    practiceStartTrackedRef.current = false;
    practiceCompletionTrackedRef.current = false;
  }, [favorites.length, prefabExercises.length, selectedMode]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/progress");
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const streak = typeof data?.practiceStreakDays === "number" ? data.practiceStreakDays : 0;
        setPracticeStreakDays(streak);
      } catch {
        // Non-blocking; chip just stays at 0.
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const reviewDueCount = journeyReviewMeta?.dueCount ?? 0;
  const reviewFocusWords = Array.isArray(journeyReviewMeta?.focusWords) ? journeyReviewMeta.focusWords : [];
  const reviewLead = reviewFocusWords.slice(0, 3).join(" · ");
  const checkpointRecoveryHref = useMemo(() => {
    if (!journeyLevelId || !journeyTopicId) return null;
    const params = new URLSearchParams();
    params.set("source", "journey");
    params.set("levelId", journeyLevelId);
    params.set("topicId", journeyTopicId);
    params.set("review", "1");
    if (journeyVariant) params.set("variant", journeyVariant);
    if (journeyReturnHref) params.set("returnTo", journeyReturnHref);
    if (explicitReturnLabel?.trim()) params.set("returnLabel", explicitReturnLabel.trim());
    return `/practice?${params.toString()}`;
  }, [explicitReturnLabel, journeyLevelId, journeyReturnHref, journeyTopicId, journeyVariant]);

  useEffect(() => {
    if (!activeSession || sessionComplete || exercises.length === 0 || practiceStartTrackedRef.current) return;
    practiceStartTrackedRef.current = true;
    void trackPracticeMetric("practice_session_started");
  }, [activeSession, exercises.length, sessionComplete, trackPracticeMetric]);

  useEffect(() => {
    if (!sessionComplete || exercises.length === 0 || practiceCompletionTrackedRef.current) return;
    practiceCompletionTrackedRef.current = true;
    const passedCheckpoint = exercises.length > 0 && score / exercises.length >= CHECKPOINT_PASS_THRESHOLD;
    void trackPracticeMetric("practice_session_completed", {
      score,
      itemsCount: exercises.length,
      accuracyPercent: exercises.length > 0 ? Math.round((score / exercises.length) * 100) : 0,
      passedCheckpoint: isJourneyCheckpoint ? passedCheckpoint : undefined,
    });
  }, [exercises.length, isJourneyCheckpoint, score, sessionComplete, trackPracticeMetric]);

  useEffect(() => {
    setSelectedOption(null);
    setMatchAnswers({});
    setActiveMatchWord(null);
    setLastResult(null);
    setPlayingClipId(null);
    setTimerRemaining(10);
    contextRevealAudioRef.current = null;
    meaningAutoplayedRef.current = null;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpeakingClipId(null);
  }, [exerciseIndex]);

  useEffect(() => {
    if (typeof window === "undefined" || !activeSession) return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [activeSession, exerciseIndex, sessionComplete]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      // Sonidos compartidos con mobile (apps/mobile/assets/sounds).
      // Antes la web usaba WAV viejos diferentes a los de la app
      // iPhone; ahora ambos clientes disparan los mismos MP3 para
      // paridad de experiencia.
      const correct = new Audio("/sounds/practice-correct.mp3");
      const wrong = new Audio("/sounds/practice-wrong.mp3");
      const combo = new Audio("/sounds/practice-perfect.mp3");
      correct.preload = "auto";
      wrong.preload = "auto";
      combo.preload = "auto";
      correct.volume = 0.8;
      wrong.volume = 0.8;
      feedbackSoundRefs.current.correct = correct;
      feedbackSoundRefs.current.wrong = wrong;
      comboSoundRef.current = combo;
    }

    const feedbackSounds = feedbackSoundRefs.current;
    const comboSound = comboSoundRef.current;

    return () => {
      const audio = clipAudioRef.current;
      if (audio && clipTimeHandlerRef.current) {
        audio.removeEventListener("timeupdate", clipTimeHandlerRef.current);
      }
      audio?.pause();
      feedbackSounds.correct?.pause();
      feedbackSounds.wrong?.pause();
      comboSound?.pause();
      feedbackAudioContextRef.current?.close().catch(() => {});
    };
  }, []);

  // Celebratory chime, reused for combos (tiered volume) and the perfect-run
  // finale (full volume) - same asset + escalation curve as the iPhone.
  const playComboChime = useCallback((volume: number) => {
    if (typeof window === "undefined") return;
    const sound = comboSoundRef.current;
    if (!sound) return;
    sound.volume = Math.max(0, Math.min(1, volume));
    sound.currentTime = 0;
    void sound.play().catch(() => {});
  }, []);

  const playGeneratedFeedbackTone = useCallback((tone: FeedbackTone) => {
    if (typeof window === "undefined") return;
    const AudioContextClass = window.AudioContext || (window as typeof window & {
      webkitAudioContext?: typeof AudioContext;
    }).webkitAudioContext;

    if (!AudioContextClass) return;

    const context =
      feedbackAudioContextRef.current && feedbackAudioContextRef.current.state !== "closed"
        ? feedbackAudioContextRef.current
        : new AudioContextClass();
    feedbackAudioContextRef.current = context;

    if (context.state === "suspended") {
      void context.resume().catch(() => {});
    }

    const now = context.currentTime;
    const master = context.createGain();
    master.connect(context.destination);
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(tone === "correct" ? 0.08 : 0.055, now + 0.02);
    master.gain.exponentialRampToValueAtTime(0.0001, now + (tone === "correct" ? 0.34 : 0.28));

    const notes =
      tone === "correct"
        ? [
            { frequency: 660, start: 0, end: 0.12, type: "triangle" as OscillatorType },
            { frequency: 880, start: 0.1, end: 0.24, type: "sine" as OscillatorType },
            { frequency: 1046, start: 0.22, end: 0.34, type: "sine" as OscillatorType },
          ]
        : [
            { frequency: 320, start: 0, end: 0.12, type: "sawtooth" as OscillatorType },
            { frequency: 240, start: 0.1, end: 0.28, type: "triangle" as OscillatorType },
          ];

    for (const note of notes) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = note.type;
      oscillator.frequency.setValueAtTime(note.frequency, now + note.start);
      gain.gain.setValueAtTime(0.0001, now + note.start);
      gain.gain.exponentialRampToValueAtTime(tone === "correct" ? 0.85 : 0.65, now + note.start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + note.end);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(now + note.start);
      oscillator.stop(now + note.end);
    }
  }, []);

  const playFeedbackSound = useCallback((tone: FeedbackTone) => {
    if (typeof window === "undefined") return;
    const sound = feedbackSoundRefs.current[tone];
    if (sound) {
      sound.currentTime = 0;
      void sound.play().catch(() => {
        playGeneratedFeedbackTone(tone);
      });
      return;
    }

    playGeneratedFeedbackTone(tone);
  }, [playGeneratedFeedbackTone]);

  // Combo celebration: every time the streak climbs, surface the tiered toast
  // pill (iPhone parity). Visual ONLY — the celebration chime is reserved for
  // the end-of-session perfect run, so it never plays mid-session. Each answer
  // still gets its own correct/wrong sound.
  useEffect(() => {
    if (streak <= 0) return;
    setMaxStreak((max) => (streak > max ? streak : max));
    const tier = getComboTier(streak);
    if (tier === 0) return;
    setComboToast({ streak, tier, label: getComboLabel(streak, tier) });
    if (comboDismissRef.current) clearTimeout(comboDismissRef.current);
    comboDismissRef.current = setTimeout(() => setComboToast(null), 1500);
    // Tier-5 (10-in-a-row): fire the confetti burst in-session, like iPhone.
    if (tier >= 5) {
      setComboBurst(true);
      if (comboBurstDismissRef.current) clearTimeout(comboBurstDismissRef.current);
      comboBurstDismissRef.current = setTimeout(() => setComboBurst(false), 1400);
    }
    return () => {
      if (comboDismissRef.current) clearTimeout(comboDismissRef.current);
    };
  }, [streak, playComboChime]);

  // Perfect-run finale chime, fired once when a flawless session completes.
  useEffect(() => {
    if (!sessionComplete) return;
    if (exercises.length === 0 || score !== exercises.length) return;
    if (perfectChimePlayedRef.current) return;
    perfectChimePlayedRef.current = true;
    playComboChime(0.95);
  }, [sessionComplete, score, exercises.length, playComboChime]);

  const revealCurrent = useCallback(() => {
    if (!currentExercise) return;
    if (revealedIds.includes(currentExercise.id)) return;
    setRevealedIds((prev) => (prev.includes(currentExercise.id) ? prev : [...prev, currentExercise.id]));

    const isCorrect =
      currentExercise.type === "match_meaning"
        ? currentExercise.pairs.every((pair) => matchAnswers[pair.word] === pair.answer)
        : selectedOption === currentExercise.answer;

    if (isCorrect) {
      setScore((prev) => prev + 1);
      // maxStreak is derived in the streak effect below (not inside this
      // updater) so StrictMode's double-invoke can't inflate it.
      setStreak((prev) => prev + 1);
      setLastResult("correct");
      playFeedbackSound("correct");
    } else {
      setStreak(0);
      setLastResult("wrong");
      playFeedbackSound("wrong");
      // Track the missed word for the result card's "Fix" action.
      const missed =
        currentExercise.type === "meaning_in_context"
          ? currentExercise.word
          : currentExercise.type === "match_meaning"
            ? null
            : currentExercise.answer;
      if (missed) setMissedWords((prev) => (prev.includes(missed) ? prev : [...prev, missed]));
    }
  }, [currentExercise, matchAnswers, playFeedbackSound, revealedIds, selectedOption]);

  // Timer tick: count down once per second while a multiple-choice exercise is
  // unanswered. Match is excluded (it paces itself). Stops on reveal/complete.
  useEffect(() => {
    if (!activeSession || sessionComplete) return;
    if (!currentExercise || currentExercise.type === "match_meaning") return;
    if (revealed) return;
    if (timerRemaining <= 0) return;
    const id = window.setTimeout(() => {
      setTimerRemaining((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearTimeout(id);
  }, [activeSession, sessionComplete, currentExercise, revealed, timerRemaining]);

  // Timeout-as-wrong: when the timer reaches 0 with no answer revealed, reveal
  // the exercise (an empty/incorrect selection grades as wrong).
  useEffect(() => {
    if (!activeSession || sessionComplete) return;
    if (!currentExercise || currentExercise.type === "match_meaning") return;
    if (revealed) return;
    if (timerRemaining > 0) return;
    revealCurrent();
  }, [activeSession, sessionComplete, currentExercise, revealed, timerRemaining, revealCurrent]);

  // Capture the round's wall-clock duration the moment it completes.
  useEffect(() => {
    if (!sessionComplete) return;
    if (sessionDurationMs !== null) return;
    if (sessionStartRef.current == null) return;
    setSessionDurationMs(Date.now() - sessionStartRef.current);
  }, [sessionComplete, sessionDurationMs]);

  const stopClipPlayback = useCallback(() => {
    const audio = clipAudioRef.current;
    if (audio && clipTimeHandlerRef.current) {
      audio.removeEventListener("timeupdate", clipTimeHandlerRef.current);
    }
    if (audio) {
      audio.pause();
    }
    clipStopAtRef.current = null;
    clipTimeHandlerRef.current = null;
    setPlayingClipId(null);
  }, []);

  useEffect(() => {
    stopClipPlayback();
  }, [exerciseIndex, stopClipPlayback]);

  const playExactContextClip = useCallback(
    async (clipOwnerId: string, clip: PracticeAudioClip | null | undefined) => {
      if (!clip || typeof window === "undefined") return;
      const normalizedSlug = normalizeStorySlug(clip.storySlug);
      const storyAudio =
        clip.storySource === "standalone"
          ? standaloneStoryAudioBySlug[normalizedSlug]
          : userStoryAudioBySlug[normalizedSlug];
      const segment = findSegmentForClip(storyAudio, clip);
      if (!storyAudio?.audioUrl || !segment) return;

      const audio = clipAudioRef.current ?? new Audio();
      clipAudioRef.current = audio;

      if (clipTimeHandlerRef.current) {
        audio.removeEventListener("timeupdate", clipTimeHandlerRef.current);
        clipTimeHandlerRef.current = null;
      }

      if (audio.src !== storyAudio.audioUrl) {
        audio.src = storyAudio.audioUrl;
      }

      const startPlayback = async () => {
        const isStandaloneClip = clip.storySource === "standalone";
        const directClipUrl =
          isStandaloneClip && typeof segment.clipUrl === "string" && segment.clipUrl.trim()
            ? segment.clipUrl.trim()
            : null;

        if (directClipUrl) {
          clipStopAtRef.current = null;
          if (audio.src !== directClipUrl) {
            audio.src = directClipUrl;
          }
          audio.currentTime = 0;
          setPlayingClipId(clipOwnerId);
          await audio.play();
          return;
        }

        const rawStartSec = isStandaloneClip
          ? segment.startSec
          : Math.max(0, segment.startSec - CLIP_START_PADDING_SEC);
        const rawEndSec = isStandaloneClip
          ? segment.endSec
          : Math.max(rawStartSec + 0.2, segment.endSec - CLIP_END_TRIM_SEC);
        const clipStartSec = Math.max(0, rawStartSec);
        const clipEndSec =
          Number.isFinite(audio.duration) && audio.duration > 0
            ? Math.min(audio.duration, rawEndSec)
            : rawEndSec;

        clipStopAtRef.current = clipEndSec;
        audio.currentTime = clipStartSec;

        const onTimeUpdate = () => {
          if (clipStopAtRef.current == null) return;
          if (audio.currentTime >= clipStopAtRef.current) {
            stopClipPlayback();
          }
        };

        clipTimeHandlerRef.current = onTimeUpdate;
        audio.addEventListener("timeupdate", onTimeUpdate);
        setPlayingClipId(clipOwnerId);
        await audio.play();
      };

      try {
        if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
          await new Promise<void>((resolve, reject) => {
            const onLoaded = () => {
              audio.removeEventListener("loadedmetadata", onLoaded);
              audio.removeEventListener("error", onError);
              resolve();
            };
            const onError = () => {
              audio.removeEventListener("loadedmetadata", onLoaded);
              audio.removeEventListener("error", onError);
              reject(new Error("Could not load clip metadata"));
            };
            audio.addEventListener("loadedmetadata", onLoaded, { once: true });
            audio.addEventListener("error", onError, { once: true });
            audio.load();
          });
        }

        if (playingClipId === clipOwnerId) {
          stopClipPlayback();
          return;
        }

        stopClipPlayback();
        await startPlayback();
      } catch (error) {
        console.error("[practice] clip playback failed", error);
        stopClipPlayback();
      }
    },
    [playingClipId, standaloneStoryAudioBySlug, stopClipPlayback, userStoryAudioBySlug]
  );

  const goNext = () => {
    if (exerciseIndex < exercises.length - 1) {
      setExerciseIndex((prev) => prev + 1);
      return;
    }
    setSessionComplete(true);
  };

  // FSRS grade derivation: which favorite word does this exercise score against?
  // match_meaning has multiple words at once and is skipped here (no grade UI;
  // user just sees Continue). All other types map cleanly to a single word.
  const getExerciseGradingWord = (exercise: PracticeExercise | null): string | null => {
    if (!exercise) return null;
    if (exercise.type === "meaning_in_context") return exercise.word;
    if (
      exercise.type === "fill_blank" ||
      exercise.type === "natural_expression" ||
      exercise.type === "listen_choose"
    ) {
      return exercise.answer;
    }
    return null; // match_meaning
  };

  const getFavoriteLanguageForWord = (word: string): string | undefined => {
    const fav = favorites.find((f) => f.word === word);
    return fav?.language ?? undefined;
  };

  // Auto-grade: when the user clicks Continue, derive the FSRS grade from
  // whether they answered correctly. Correct → 3 (Good), wrong → 1 (Again).
  // Fire-and-forget POST to /api/practice/review so the SRS state updates
  // without changing the user-visible UX. Any failure logs and still
  // advances; a flaky connection never blocks the practice flow.
  const continueWithAutoGrade = () => {
    const word = getExerciseGradingWord(currentExercise);
    if (word && lastResult) {
      const grade: 1 | 3 = lastResult === "correct" ? 3 : 1;
      const language = getFavoriteLanguageForWord(word);
      // Intentionally not awaited: advance immediately, send grade in background.
      void fetch("/api/practice/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word, grade, ...(language ? { language } : {}) }),
      }).catch((err) => {
        console.warn("[practice] auto-grade submission failed", err);
      });
    }
    goNext();
  };

  const restart = () => {
    setExerciseIndex(0);
    setSelectedOption(null);
    setMatchAnswers({});
    setRevealedIds([]);
    setScore(0);
    setStreak(0);
    setMaxStreak(0);
    setSessionComplete(false);
    setComboToast(null);
    setComboBurst(false);
    perfectChimePlayedRef.current = false;
    setCheckpointSaveState("idle");
    setCheckpointResponses({});
    practiceStartTrackedRef.current = false;
    practiceCompletionTrackedRef.current = false;
  };

  const playSpeechText = useCallback((clipOwnerId: string, text: string, language: string | null | undefined) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    if (speakingClipId === clipOwnerId) {
      synth.cancel();
      setSpeakingClipId(null);
      return;
    }

    synth.cancel();
    const lang = getSpeechSynthesisLang(language);

    setSpeakingClipId(clipOwnerId);

    let didSpeak = false;
    const speak = () => {
      if (didSpeak) return;
      didSpeak = true;

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = 0.92;

      const preferredVoice = selectPreferredSpeechVoice(synth.getVoices(), lang);
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      utterance.onend = () => {
        setSpeakingClipId((current) => (current === clipOwnerId ? null : current));
      };
      utterance.onerror = () => {
        setSpeakingClipId((current) => (current === clipOwnerId ? null : current));
      };

      synth.cancel();
      synth.speak(utterance);
    };

    if (synth.getVoices().length > 0) {
      speak();
      return;
    }

    const handleVoicesChanged = () => {
      synth.removeEventListener?.("voiceschanged", handleVoicesChanged);
      speak();
    };

    synth.addEventListener?.("voiceschanged", handleVoicesChanged);
    window.setTimeout(() => {
      synth.removeEventListener?.("voiceschanged", handleVoicesChanged);
      if (!didSpeak) {
        speak();
      }
    }, 180);
  }, [speakingClipId]);

  const playListenPrompt = useCallback(() => {
    if (!currentExercise || currentExercise.type !== "listen_choose") return;
    playSpeechText(currentExercise.id, currentExercise.speechText, currentExercise.language);
  }, [currentExercise, playSpeechText]);

  const playHqContextClip = useCallback(async (clipOwnerId: string, clip: PracticeAudioClip | null | undefined) => {
    if (!clip || typeof window === "undefined") return;
    const audio = clipAudioRef.current ?? new Audio();
    clipAudioRef.current = audio;
    if (clipTimeHandlerRef.current) {
      audio.removeEventListener("timeupdate", clipTimeHandlerRef.current);
      clipTimeHandlerRef.current = null;
    }
    if (hqClipId === clipOwnerId) {
      audio.pause();
      setHqClipId(null);
      return;
    }
    const cacheKey = `${clip.language ?? ""}|${clip.sentence}`;
    let url = hqUrlBySentence[cacheKey];
    if (!url) {
      try {
        const res = await fetch("/api/practice/sentence-tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sentence: clip.sentence,
            language: clip.language ?? "german",
          }),
        });
        if (!res.ok) {
          console.error("[practice] HQ TTS failed", res.status);
          return;
        }
        const data = (await res.json()) as { url?: string };
        if (!data.url) return;
        url = data.url;
        setHqUrlBySentence((prev) => ({ ...prev, [cacheKey]: data.url! }));
      } catch (err) {
        console.error("[practice] HQ TTS error", err);
        return;
      }
    }
    audio.src = url;
    audio.currentTime = 0;
    setHqClipId(clipOwnerId);
    audio.onended = () => {
      setHqClipId((current) => (current === clipOwnerId ? null : current));
    };
    try {
      await audio.play();
    } catch (err) {
      console.error("[practice] HQ TTS play error", err);
      setHqClipId(null);
    }
  }, [hqClipId, hqUrlBySentence]);

  // Single audio entry point for context exercises (iPhone parity: one button,
  // not three). Prefer the real story segment when we have it, fall back to
  // high-quality ElevenLabs TTS, then to the browser speech synth.
  const playContextAudio = useCallback(
    (clipOwnerId: string, clip: PracticeAudioClip | null | undefined) => {
      if (!clip) return;
      const normalizedSlug = normalizeStorySlug(clip.storySlug);
      const storyAudio =
        clip.storySource === "standalone"
          ? standaloneStoryAudioBySlug[normalizedSlug]
          : userStoryAudioBySlug[normalizedSlug];
      const segment = findSegmentForClip(storyAudio, clip);
      if (storyAudio?.audioUrl && segment) {
        void playExactContextClip(clipOwnerId, clip);
        return;
      }
      void playHqContextClip(clipOwnerId, clip);
    },
    [playExactContextClip, playHqContextClip, standaloneStoryAudioBySlug, userStoryAudioBySlug]
  );

  // True when any audio source for this context clip is currently playing.
  const isContextAudioActive = useCallback(
    (clipOwnerId: string) =>
      playingClipId === clipOwnerId || hqClipId === clipOwnerId || speakingClipId === clipOwnerId,
    [hqClipId, playingClipId, speakingClipId]
  );

  // Context-mode reveal audio (iPhone parity): no autoplay while the user is
  // thinking, but the moment they reveal the answer we play the full sentence
  // so they hear the word in its natural context. Fires once per reveal.
  useEffect(() => {
    if (!revealed || !currentExercise) return;
    if (currentExercise.type !== "fill_blank" && currentExercise.type !== "natural_expression") return;
    if (!currentExercise.audioClip) return;
    if (contextRevealAudioRef.current === currentExercise.id) return;
    contextRevealAudioRef.current = currentExercise.id;
    playContextAudio(currentExercise.id, currentExercise.audioClip);
  }, [revealed, currentExercise, playContextAudio]);

  // Meaning-mode word autoplay (iPhone parity): when a meaning exercise
  // appears, play the target WORD (HQ TTS, same voice as the story) so the
  // learner hears it while choosing the meaning. Fires once per exercise.
  useEffect(() => {
    if (!activeSession || sessionComplete) return;
    if (!currentExercise || currentExercise.type !== "meaning_in_context") return;
    if (!currentExercise.audioClip) return;
    if (meaningAutoplayedRef.current === currentExercise.id) return;
    meaningAutoplayedRef.current = currentExercise.id;
    void playHqContextClip(currentExercise.id, {
      storySlug: currentExercise.storySlug ?? "",
      sentence: currentExercise.word,
      storySource: "standalone",
      language: currentExercise.audioClip.language ?? null,
      voiceId: currentExercise.audioClip.voiceId ?? null,
    });
  }, [activeSession, sessionComplete, currentExercise, playHqContextClip]);

  const assignMatchMeaning = (meaning: string) => {
    if (!currentExercise || currentExercise.type !== "match_meaning" || !activeMatchWord || revealed) return;

    setMatchAnswers((prev) => {
      const next = { ...prev };
      for (const [word, assignedMeaning] of Object.entries(next)) {
        if (assignedMeaning === meaning) {
          delete next[word];
        }
      }
      next[activeMatchWord] = meaning;
      return next;
    });
    setActiveMatchWord(null);
  };

  const chooseOption = (option: string) => {
    setSelectedOption(option);
    if (
      isJourneyCheckpoint &&
      currentExercise &&
      currentExercise.type !== "match_meaning"
    ) {
      setCheckpointResponses((current) => ({
        ...current,
        [currentExercise.id]: option,
      }));
    }
  };

  const unassignMatchWord = (word: string) => {
    setMatchAnswers((prev) => {
      if (!prev[word]) return prev;
      const next = { ...prev };
      delete next[word];
      return next;
    });
    setActiveMatchWord((prev) => (prev === word ? null : prev));
  };

  const modeCards = (Object.entries(modeThemeByMode) as Array<
    [PracticeMode, (typeof modeThemeByMode)[PracticeMode]]
  >).map(([mode, theme]) => ({
    mode,
    ...theme,
  }));
  const activeModeTheme = selectedMode
    ? modeThemeByMode[selectedMode]
    : inferredModeFromExercise
      ? modeThemeByMode[inferredModeFromExercise]
      : null;
  const checkpointPassed = exercises.length > 0 && score / exercises.length >= CHECKPOINT_PASS_THRESHOLD;
  const checkpointNeedsSave = isJourneyCheckpoint && checkpointPassed && checkpointSaveState !== "saved";
  const checkpointMissedItems = useMemo(() => {
    if (!isJourneyCheckpoint) return [];

    return exercises.flatMap((exercise) => {
      if (exercise.type === "match_meaning") return [];
      const response = checkpointResponses[exercise.id];
      if (!response || response === exercise.answer) return [];

      if (exercise.type === "meaning_in_context") {
        return [{ label: exercise.word, answer: exercise.answer }];
      }
      if (exercise.type === "fill_blank") {
        return [{ label: exercise.answer, answer: exercise.answer }];
      }
      if (exercise.type === "natural_expression") {
        return [{ label: exercise.answer, answer: exercise.answer }];
      }
      return [{ label: exercise.speechText, answer: exercise.answer }];
    });
  }, [checkpointResponses, exercises, isJourneyCheckpoint]);
  const checkpointRecoveryWords = checkpointMissedItems
    .map((item) => item.label)
    .filter((value, index, array) => array.indexOf(value) === index)
    .slice(0, 4);
  const checkpointMissedMode = useMemo<PracticeMode | null>(() => {
    if (!isJourneyCheckpoint || checkpointMissedItems.length === 0) return null;

    const counts: Record<PracticeMode, number> = {
      meaning: 0,
      context: 0,
      natural: 0,
      listening: 0,
      match: 0,
    };

    for (const exercise of exercises) {
      if (exercise.type === "match_meaning") continue;
      const response = checkpointResponses[exercise.id];
      if (!response || response === exercise.answer) continue;

      if (exercise.type === "meaning_in_context") counts.meaning += 1;
      else if (exercise.type === "fill_blank") counts.context += 1;
      else if (exercise.type === "natural_expression") counts.natural += 1;
      else if (exercise.type === "listen_choose") counts.listening += 1;
    }

    const ranked = (Object.entries(counts) as Array<[PracticeMode, number]>)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1]);

    return ranked[0]?.[0] ?? null;
  }, [checkpointMissedItems.length, checkpointResponses, exercises, isJourneyCheckpoint]);
  const dueFavorites = useMemo(
    () => sortPracticeItemsByOnboarding(getDuePracticeItems(favorites), onboardingPracticePrefs, true),
    [favorites, onboardingPracticePrefs]
  );
  const reviewRecommendedMode = useMemo<PracticeMode>(() => {
    if (checkpointMissedMode) return checkpointMissedMode;
    if (dueFavorites.length === 0) return "meaning";

    const counts: Record<PracticeMode, number> = {
      meaning: 0,
      context: 0,
      natural: 0,
      listening: 0,
      match: 0,
    };

    for (const item of dueFavorites) {
      counts.meaning += 1;
      if (item.exampleSentence?.trim()) counts.context += 2;
      if (isExpressionLikeFavorite(item)) counts.natural += 3;
      if (item.storySlug || item.language) counts.listening += 1;
    }

    const ranked = (Object.entries(counts) as Array<[PracticeMode, number]>)
      .filter(([mode]) => mode !== "match")
      .sort((a, b) => b[1] - a[1]);

    const fallback = ranked[0]?.[0] ?? "meaning";
    return getRecommendedPracticeModeFromOnboarding(dueFavorites, fallback, onboardingPracticePrefs);
  }, [checkpointMissedMode, dueFavorites, onboardingPracticePrefs]);
  const reviewRecommendedLabel = getModeLabel(reviewRecommendedMode);

  // Auto-open the session when the user came straight from finishing a story
  // (source=story). Without this they land on the practice dashboard and have
  // to tap START again - they expect to practice the story they just read.
  // Mirrors the START button (setPendingCountdownMode → countdown → session).
  useEffect(() => {
    if (!isStoryPractice) return;
    if (loadState !== "ready") return;
    if (favorites.length === 0) return;
    if (selectedMode || pendingCountdownMode) return;
    if (storyAutoStartedRef.current) return;
    storyAutoStartedRef.current = true;
    setPendingCountdownMode(reviewRecommendedMode);
  }, [
    isStoryPractice,
    loadState,
    favorites.length,
    selectedMode,
    pendingCountdownMode,
    reviewRecommendedMode,
  ]);

  const preferredPracticeMinutes =
    typeof onboardingPracticePrefs.dailyMinutes === "number" && onboardingPracticePrefs.dailyMinutes > 0
      ? onboardingPracticePrefs.dailyMinutes
      : 5;
  const practiceSummary = useMemo(() => {
    if (isReviewFocus && reviewDueCount > 0) {
      return `You have ${reviewDueCount} due ${reviewDueCount === 1 ? "item" : "items"} waiting in this topic. ${reviewRecommendedLabel} is the best next move for your ${preferredPracticeMinutes}-minute session.`;
    }
    if (dueFavorites.length > 0) {
      return `${dueFavorites.length} saved ${dueFavorites.length === 1 ? "word is" : "words are"} ready. ${reviewRecommendedLabel} is the best quick review for your ${preferredPracticeMinutes}-minute session.`;
    }
    return `Pick one mode and start a quick ${preferredPracticeMinutes}-minute round.`;
  }, [dueFavorites.length, isReviewFocus, preferredPracticeMinutes, reviewDueCount, reviewRecommendedLabel]);
  const requestedMode =
    requestedModeParam === "meaning" ||
    requestedModeParam === "context" ||
    requestedModeParam === "natural" ||
    requestedModeParam === "listening" ||
    requestedModeParam === "match"
      ? requestedModeParam
      : null;
  useEffect(() => {
    if (!isJourneyCheckpoint || !sessionComplete || checkpointSaveState === "saving" || checkpointSaveState === "saved") {
      return;
    }
    if (!journeyLevelId || !journeyTopicId || !checkpointPassed || !checkpointToken) return;

    let cancelled = false;

    const saveCheckpoint = async () => {
      try {
        setCheckpointSaveState("saving");
        const res = await fetch("/api/journey/checkpoint", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: checkpointToken,
            responses: checkpointResponses,
          }),
        });

        if (!res.ok) {
          throw new Error("Failed to save checkpoint");
        }

        if (!cancelled) {
          setCheckpointSaveState("saved");
        }
      } catch (error) {
        console.error("[practice] failed to save journey checkpoint", error);
        if (!cancelled) {
          setCheckpointSaveState("error");
        }
      }
    };

    void saveCheckpoint();

    return () => {
      cancelled = true;
    };
  }, [
    checkpointPassed,
    checkpointSaveState,
    exercises.length,
    isJourneyCheckpoint,
    journeyLevelId,
    journeyTopicId,
    journeyVariant,
    checkpointResponses,
    checkpointToken,
    score,
    sessionComplete,
  ]);

  useEffect(() => {
    if (isJourneyCheckpoint) return;
    if (!requestedMode) return;
    if (selectedMode !== null) return;
    if (autoOpenedModeRef.current === requestedMode) return;

    autoOpenedModeRef.current = requestedMode;
    void trackUiMetric("practice_recommended_mode_opened", {
      mode: requestedMode,
      source: "query_param",
    });
    openSession(requestedMode);
  }, [isJourneyCheckpoint, openSession, requestedMode, selectedMode, trackUiMetric]);

  // ⚠️ Reglas de hooks: este useMemo DEBE quedar antes de cualquier early
  // return (loading, !user, error) - antes vivía hasta el render final del
  // hero y eso disparaba "change in order of Hooks called by PracticePage".
  const inferredLanguageFromFavs = useMemo(() => {
    if (favorites.length === 0) return null;
    const counts = new Map<string, number>();
    for (const f of favorites) {
      if (!f.language) continue;
      counts.set(f.language, (counts.get(f.language) ?? 0) + 1);
    }
    let best: { lang: string; n: number } | null = null;
    for (const [lang, n] of counts) {
      if (!best || n > best.n) best = { lang, n };
    }
    return best?.lang ?? null;
  }, [favorites]);

  if (!isLoaded || loadState === "loading") {
    return (
      <div className="min-h-screen p-6 pb-24 text-[var(--foreground)]">
        <div className="mb-4 h-9 w-48 animate-pulse rounded bg-[var(--card-bg)]" />
        <div className="mb-3 h-4 w-80 animate-pulse rounded bg-[var(--card-bg)]" />
        <div className="h-72 animate-pulse rounded-3xl bg-[var(--card-bg)]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen p-6 pb-24 text-[var(--foreground)]">
        <h1 className="mb-2 text-3xl font-bold">Practice</h1>
        <p className="mb-5 text-sm text-[var(--muted)]">
          Sign in to practice your saved vocabulary with fill-in-the-blank, matching, listening,
          and context exercises.
        </p>
        <Link
          href="/sign-in?redirect_url=/practice"
          className="inline-flex rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
        >
          Sign in
        </Link>
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <div className="min-h-screen p-6 pb-24 text-[var(--foreground)]">
        <h1 className="mb-2 text-3xl font-bold">Practice</h1>
        <p className="text-sm text-amber-300">Could not load your saved vocabulary right now.</p>
      </div>
    );
  }

  if (favorites.length === 0) {
    return (
      <div className="min-h-screen p-6 pb-24 text-[var(--foreground)]">
        <h1 className="mb-2 text-3xl font-bold">Practice</h1>
        <p className="mb-5 text-sm text-[var(--muted)]">
          {isJourneyPractice
            ? "This topic does not have enough practice items yet."
            : "Save words while reading and they will appear here as exercises."}
        </p>
        <div className="flex flex-wrap gap-3">
          {isJourneyPractice && journeyReturnHref ? (
            <Link
              href={journeyReturnHref}
              className="inline-flex rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            >
              Back to topic
            </Link>
          ) : (
            <Link
              href="/explore"
              className="inline-flex rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            >
              Explore stories
            </Link>
          )}
          <Link
            href="/favorites"
            className="inline-flex rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--card-bg-hover)]"
          >
            Open favorites
          </Link>
        </div>
      </div>
    );
  }

  if (activeSession) {
    const timerColor =
      timerRemaining <= 2 ? "#ff5f5f" : timerRemaining <= 5 ? "#ff9a57" : "#f8c15c";
    return (
      <div className="relative -mx-1 -my-6 box-border h-[calc(100dvh-env(safe-area-inset-top))] overflow-hidden px-4 py-2.5 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] text-[var(--foreground)] sm:px-5 sm:py-4 sm:pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <div className="mx-auto grid h-full max-w-5xl grid-rows-[auto_minmax(0,1fr)_auto] gap-2 sm:grid-rows-[auto_minmax(0,1fr)_144px]">
          {/* HEADER exacto al iPhone:
              - Back arrow rounded-square
              - Eyebrow "WORD QUEST · 02 OF 07" + título "Meaning"
              - Anillo circular a la derecha con score (e.g. 10) y
                progreso del ejercicio actual
              - Fila de mini-segments por ejercicio (no big bar)
              - Stats row: ⚡ +6 XP · 1 gem
              XP y gem son cosméticos: +6 por respuesta, 1 gem por
              ejercicio. */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={attemptCloseSession}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/12 bg-white/[0.04] text-white hover:bg-white/10"
                aria-label="Close practice"
              >
                <ArrowLeft size={18} />
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-[10.5px] font-extrabold uppercase tracking-[0.22em] text-white/55">
                  {activeModeTheme?.eyebrow ?? "Word quest"}
                  {" · "}
                  {String(Math.min(exerciseIndex + 1, exercises.length)).padStart(2, "0")}
                  {" OF "}
                  {String(exercises.length).padStart(2, "0")}
                </p>
                <div className="flex items-center gap-2.5">
                  <p className="text-[26px] font-black tracking-tight text-white leading-tight">
                    {activeModeTheme?.title ?? "Practice"}
                  </p>
                  {/* Combo toast (iPhone parity): pops in on a streak tier and
                      auto-dismisses. Icon + color escalate with the tier. */}
                  {comboToast ? (
                    (() => {
                      const t = comboToast.tier;
                      const ComboIcon = t >= 5 ? Crown : t >= 4 ? Rocket : Flame;
                      const pill =
                        t >= 5
                          ? "bg-gradient-to-r from-[#fde68a] to-[#f0abfc] text-[#3b0764]"
                          : t >= 4
                            ? "bg-gradient-to-r from-[#fdba74] to-[#fb7185] text-[#3a0a0a]"
                            : t >= 3
                              ? "bg-[#fb923c] text-[#2a1402]"
                              : "bg-[#fcd34d] text-[#2a1a02]";
                      const halo =
                        t >= 5 ? "#f0abfc" : t >= 4 ? "#fb7185" : t >= 3 ? "#fb923c" : "#fcd34d";
                      const haloStrength = t >= 5 ? 0.9 : t >= 4 ? 0.72 : t >= 3 ? 0.58 : 0.42;
                      return (
                        <span
                          key={`${comboToast.tier}-${comboToast.streak}`}
                          className="relative inline-flex shrink-0 items-center"
                        >
                          {/* Tier-colored glow behind the pill (iPhone halo). */}
                          <span
                            aria-hidden
                            className="pointer-events-none absolute -inset-2 rounded-full blur-md"
                            style={{
                              background: halo,
                              opacity: haloStrength,
                              animation: "combo-halo 1500ms ease-out both",
                            }}
                          />
                          <span
                            className={`relative inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wide shadow-lg ${pill}`}
                            style={{ animation: "combo-pop 1500ms cubic-bezier(0.22,1,0.36,1) both" }}
                          >
                            <ComboIcon size={12} fill="currentColor" />
                            {comboToast.label}
                          </span>
                        </span>
                      );
                    })()
                  ) : null}
                </div>
              </div>
              {/* Timer badge "Xs" (iPhone parity): gold → orange → red as it
                  drains. Hidden for match and once the answer is revealed. */}
              {!sessionComplete &&
              currentExercise &&
              currentExercise.type !== "match_meaning" &&
              !revealed ? (
                <div
                  className="grid h-10 min-w-[44px] shrink-0 place-items-center rounded-full border px-2.5 text-[15px] font-black tabular-nums"
                  style={{
                    borderColor: `${timerColor}55`,
                    backgroundColor: `${timerColor}1f`,
                    color: timerColor,
                  }}
                >
                  {timerRemaining}s
                </div>
              ) : null}
            </div>

            {/* Timer bar: empties left-to-right over the 10 s window. Same
                visibility rule as the badge. */}
            {!sessionComplete &&
            currentExercise &&
            currentExercise.type !== "match_meaning" &&
            !revealed ? (
              <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.08]">
                <div
                  className="h-full rounded-full transition-[width] duration-1000 ease-linear"
                  style={{
                    width: `${Math.max(0, Math.min(100, (timerRemaining / 10) * 100))}%`,
                    backgroundColor: timerColor,
                  }}
                />
              </div>
            ) : null}

            {/* Mini-segments por ejercicio (uno por exercise).
                Sin big bar arriba - iPhone sólo muestra esta fila. */}
            <div className="flex gap-1.5">
              {exercises.map((_, i) => {
                const done = i < completedExerciseCount;
                const current = i === exerciseIndex && !sessionComplete;
                return (
                  <span
                    key={i}
                    aria-hidden
                    className="flex-1 rounded-full"
                    style={{
                      height: 4,
                      background: done || current
                        ? "var(--color-gold)"
                        : "rgba(255,255,255,0.08)",
                    }}
                  />
                );
              })}
            </div>

            {/* Stats row: ⚡ +6 XP · ◆ 1 gem (cosmético) */}
            {!sessionComplete ? (
              <div className="flex items-center justify-end gap-3 text-[12px] font-extrabold">
                <span className="inline-flex items-center gap-1 text-[var(--color-gold)]">
                  <Zap size={13} fill="currentColor" />
                  +{6 * Math.max(1, streak || 1)} XP
                </span>
                <span className="text-white/20">|</span>
                <span className="inline-flex items-center gap-1 text-[#c4b5fd]">
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor">
                    <path d="M6 0l3 4-3 8-3-8z" />
                  </svg>
                  1 gem
                </span>
              </div>
            ) : null}
          </div>

          <div className="min-h-0 overflow-y-auto overscroll-contain pr-1">
            {sessionComplete ? (
              (() => {
                // iPhone-parity result card: score ring + corner chips
                // (XP / combo) + greeting + 2 stat cards + WHAT'S NEXT row.
                const total = exercises.length;
                const isPerfect = score === total && total > 0;
                const accuracyPct = total > 0 ? Math.round((score / total) * 100) : 0;
                const ringColor =
                  accuracyPct >= 80 ? "#22c55e" : accuracyPct >= 50 ? "#f59e0b" : "#fb7185";
                const xpTotal =
                  score * 10 + Math.max(0, maxStreak - 3) * 5 + (isPerfect ? 25 : 0);
                const totalSeconds = Math.max(0, Math.round((sessionDurationMs ?? 0) / 1000));
                const durationLabel =
                  totalSeconds >= 60
                    ? `${Math.floor(totalSeconds / 60)}m ${totalSeconds % 60}s`
                    : `${totalSeconds}s`;
                const firstName = (user?.firstName ?? "").trim().split(/\s+/)[0] || null;
                const greeting = isPerfect
                  ? firstName
                    ? `Perfect, ${firstName}.`
                    : "Perfect run."
                  : firstName
                    ? `Nice run, ${firstName}.`
                    : "Session complete.";
                const headline = isJourneyCheckpoint
                  ? checkpointPassed
                    ? "Checkpoint cleared."
                    : "Almost there. Try again."
                  : isPerfect
                    ? "Every answer locked in."
                    : accuracyPct >= 70
                      ? "You're sharper than last time."
                      : accuracyPct >= 40
                        ? "Solid practice. Keep going."
                        : "These ones need another pass.";
                const subtext = isJourneyCheckpoint
                  ? checkpointPassed
                    ? "Next step unlocked."
                    : `${Math.max(0, Math.ceil(CHECKPOINT_PASS_THRESHOLD * total) - score)} more correct to pass.`
                  : `${score} of ${total} correct.`;

                // Ring geometry - animate the arc from empty to score/total.
                const RING = 168;
                const STROKE = 16;
                const R = (RING - STROKE) / 2;
                const CIRC = 2 * Math.PI * R;
                const ratio = total > 0 ? Math.max(0, Math.min(1, score / total)) : 0;
                const dashTarget = CIRC * (1 - ratio);

                // WHAT'S NEXT actions (gold primary first, then up to 2 more).
                type ResultAction = {
                  key: string;
                  title: string;
                  subtitle: string;
                  icon: LucideIcon;
                  primary?: boolean;
                  href?: string;
                  onClick?: () => void;
                };
                const actions: ResultAction[] = [];
                let primaryIsReplay = false;
                if (isJourneyCheckpoint && !checkpointPassed) {
                  actions.push({ key: "retry", title: "Retry", subtitle: "Checkpoint", icon: RotateCcw, primary: true, onClick: restart });
                } else if (isStoryPractice && storyNextHref) {
                  actions.push({ key: "next-story", title: "Continue", subtitle: "Next story", icon: ArrowRight, primary: true, href: storyNextHref });
                } else if (isJourneyPractice && journeyReturnHref) {
                  actions.push({
                    key: "journey",
                    title: isJourneyCheckpoint && checkpointPassed && !checkpointNeedsSave ? "Continue" : "Journey",
                    subtitle: explicitReturnLabel?.trim() || "Back to journey",
                    icon: ArrowRight,
                    primary: true,
                    href: journeyReturnHref,
                  });
                } else if (isStoryPractice && storyReturnHref) {
                  actions.push({ key: "story", title: "Done", subtitle: "Back to story", icon: Home, primary: true, href: storyReturnHref });
                } else {
                  primaryIsReplay = true;
                  actions.push({ key: "replay", title: "Replay", subtitle: `Same ${total}`, icon: RotateCcw, primary: true, onClick: restart });
                }
                if (isJourneyCheckpoint && !checkpointPassed && checkpointRecoveryHref) {
                  actions.push({
                    key: "weak",
                    title: "Fix",
                    subtitle: "Weak spots",
                    icon: Target,
                    href: `${checkpointRecoveryHref}&mode=${encodeURIComponent(reviewRecommendedMode)}`,
                    onClick: () => {
                      void trackUiMetric("checkpoint_recovery_clicked", {
                        recommendedMode: reviewRecommendedMode,
                        missedWords: checkpointRecoveryWords,
                      });
                    },
                  });
                }
                if (!primaryIsReplay && actions.length < 3) {
                  actions.push({ key: "replay2", title: "Replay", subtitle: `Same ${total}`, icon: RotateCcw, onClick: restart });
                }
                if (actions.length < 3 && !isStoryPractice && !isJourneyPractice) {
                  actions.push({ key: "favorites", title: "Words", subtitle: "Favorites", icon: BookOpenText, href: "/favorites" });
                }

                return (
                  <div
                    className="relative flex min-h-full flex-col items-center gap-4 overflow-hidden rounded-3xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5 shadow-md sm:p-6"
                    style={{ animation: "practice-result-in 280ms ease-out both" }}
                  >
                    {/* One-shot diagonal shine sweep across the card on entry
                        (iPhone result-card shine). */}
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-y-0 left-0 w-1/3"
                      style={{
                        background:
                          "linear-gradient(90deg, transparent, rgba(255,255,255,0.14), transparent)",
                        animation: "practice-result-shine 1200ms ease-out 200ms both",
                      }}
                    />
                    <Confetti active={isPerfect} />

                    {/* Corner chips */}
                    <div className="flex w-full items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                        <Zap size={13} className="text-[#ffd25f]" fill="currentColor" />
                        <span className="text-[13px] font-black text-white">+{xpTotal}</span>
                        <span className="ml-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white/60">XP</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                        <Flame size={13} className="text-[#fb923c]" />
                        <span className="text-[13px] font-black text-white">x{maxStreak}</span>
                        <span className="ml-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white/60">Combo</span>
                      </span>
                    </div>

                    {/* Score ring */}
                    <div className="relative grid place-items-center" style={{ width: RING, height: RING }}>
                      <svg width={RING} height={RING} className="-rotate-90">
                        <circle cx={RING / 2} cy={RING / 2} r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={STROKE} />
                        <circle
                          cx={RING / 2}
                          cy={RING / 2}
                          r={R}
                          fill="none"
                          stroke={ringColor}
                          strokeWidth={STROKE}
                          strokeLinecap="round"
                          strokeDasharray={CIRC}
                          strokeDashoffset={dashTarget}
                          style={{
                            animation: "practice-ring-fill 1100ms cubic-bezier(0.22,1,0.36,1) both",
                            ["--ring-circ" as string]: `${CIRC}`,
                            ["--ring-offset" as string]: `${dashTarget}`,
                          }}
                        />
                      </svg>
                      <div className="absolute flex flex-col items-center">
                        <span className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-white/55">Score</span>
                        <span className="mt-1 text-[52px] font-black leading-none tracking-tight text-white">
                          {score}
                          <span className="text-[34px] text-white/40">/{total}</span>
                        </span>
                      </div>
                    </div>

                    {/* Greeting + headline + subtext */}
                    <div className="flex flex-col items-center gap-1 px-2 text-center">
                      <span className="text-[12px] font-extrabold uppercase tracking-[0.22em] text-emerald-300">{greeting}</span>
                      <h2 className="text-[22px] font-black leading-tight tracking-tight text-white">{headline}</h2>
                      <p className="text-[13px] leading-5 text-white/60">{subtext}</p>
                    </div>

                    {/* Stat cards */}
                    <div className="flex w-full gap-2.5">
                      <div className="flex flex-1 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5">
                        <Target size={20} className="text-[#9fe8ff]" />
                        <div>
                          <p className="text-[20px] font-black leading-none text-white">{accuracyPct}%</p>
                          <p className="mt-1 text-[11px] font-extrabold uppercase tracking-wider text-white/60">Accuracy</p>
                        </div>
                      </div>
                      <div className="flex flex-1 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5">
                        <Clock size={20} className="text-[#f8c15c]" />
                        <div>
                          <p className="text-[20px] font-black leading-none text-white">{durationLabel}</p>
                          <p className="mt-1 text-[11px] font-extrabold uppercase tracking-wider text-white/60">Time</p>
                        </div>
                      </div>
                    </div>

                    {/* Checkpoint recovery words (only on failed checkpoint) */}
                    {isJourneyCheckpoint && !checkpointPassed && checkpointRecoveryWords.length > 0 ? (
                      <div className="w-full rounded-2xl border border-rose-200/20 bg-rose-300/[0.08] px-4 py-3">
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-rose-100/80">Review these first</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {checkpointRecoveryWords.map((word) => (
                            <span key={word} className="rounded-full border border-rose-200/20 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-rose-50">
                              {word}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {/* WHAT'S NEXT */}
                    <div className="mt-auto w-full">
                      <p className="mb-2.5 text-[11px] font-extrabold uppercase tracking-[0.2em] text-white/50">What&rsquo;s next</p>
                      <div className="flex gap-2.5">
                        {actions.slice(0, 3).map((action) => {
                          const Icon = action.icon;
                          const cardClass = `flex flex-1 flex-col gap-1.5 rounded-2xl border px-3 py-3.5 text-left transition ${
                            action.primary
                              ? "border-[var(--color-gold)] bg-[var(--color-gold)] hover:brightness-105"
                              : "border-white/10 bg-white/[0.04] hover:bg-white/[0.07]"
                          }`;
                          const iconWrapClass = `grid h-8 w-8 place-items-center rounded-[10px] ${
                            action.primary ? "bg-black/15" : "bg-white/[0.06]"
                          }`;
                          const titleClass = `text-[15px] font-black tracking-tight ${action.primary ? "text-[#0a1424]" : "text-white"}`;
                          const subClass = `text-[11px] font-bold ${action.primary ? "text-[#0a1424]/70" : "text-white/60"}`;
                          const inner = (
                            <>
                              <span className={iconWrapClass}>
                                <Icon size={16} className={action.primary ? "text-[#0a1424]" : "text-white/80"} />
                              </span>
                              <span className={titleClass}>{action.title}</span>
                              <span className={subClass}>{action.subtitle}</span>
                            </>
                          );
                          return action.href ? (
                            <Link key={action.key} href={action.href} onClick={action.onClick} className={cardClass}>
                              {inner}
                            </Link>
                          ) : (
                            <button key={action.key} type="button" onClick={action.onClick} className={cardClass}>
                              {inner}
                            </button>
                          );
                        })}
                      </div>
                      {isJourneyCheckpoint && checkpointSaveState !== "idle" ? (
                        <p className="mt-3 text-center text-[12px] text-white/55">
                          {checkpointSaveState === "saving"
                            ? "Saving checkpoint…"
                            : checkpointSaveState === "saved"
                              ? "Checkpoint saved · next step unlocked"
                              : "Checkpoint passed but not saved yet"}
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })()
            ) : currentExercise ? (
              <div
                key={exerciseIndex}
                className="relative flex flex-col overflow-hidden rounded-3xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5 shadow-md"
                style={{ animation: "practice-exercise-in 280ms cubic-bezier(0.22,1,0.36,1) both" }}
              >
                {activeModeTheme ? (
                  <>
                    <div
                      aria-hidden="true"
                      className={`pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b ${activeModeTheme.panelGlow}`}
                    />
                    <div
                      aria-hidden="true"
                      className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${activeModeTheme.accentBar}`}
                    />
                  </>
                ) : null}

                {/* Unified multiple-choice render (iPhone parity): a hero block
                    whose content depends on the mode, followed by a 2×2 grid
                    of option cards with a colored accent pill (A/B/C/D). One
                    audio button - no TTS/STORY/HQ debug row. */}
                {currentExercise.type !== "match_meaning"
                  ? (() => {
                      const ex = currentExercise;
                      const isMeaning = ex.type === "meaning_in_context";
                      const isContext = ex.type === "fill_blank" || ex.type === "natural_expression";
                      const isListening = ex.type === "listen_choose";
                      const audioActive =
                        isListening
                          ? speakingClipId === ex.id
                          : isContextAudioActive(ex.id);
                      const accentColors = ["#fbbf24", "#60a5fa", "#a78bfa", "#34d399"];
                      return (
                        <div className="flex flex-col gap-6">
                          {/* ── Hero ── */}
                          <div className="flex flex-col items-center gap-3 pt-1">
                            {isListening ? (
                              <div className="flex flex-col items-center gap-3 py-3">
                                <button
                                  type="button"
                                  onClick={playListenPrompt}
                                  aria-label={audioActive ? "Stop" : "Play"}
                                  className="grid h-24 w-24 place-items-center rounded-full border-2 transition active:scale-95"
                                  style={{
                                    background: "rgba(82,160,214,0.20)",
                                    borderColor: "rgba(159,232,255,0.32)",
                                    boxShadow: "0 0 36px rgba(159,232,255,0.22)",
                                  }}
                                >
                                  <Volume2 size={40} className="text-[#9fe8ff]" />
                                </button>
                                <span className="text-[12px] font-black uppercase tracking-[0.2em] text-white/70">
                                  {audioActive ? "Playing" : "Tap to listen"}
                                </span>
                              </div>
                            ) : isContext ? (
                              <div className="flex w-full items-center justify-center gap-3">
                                <p className="flex-1 text-center text-[clamp(1.15rem,2.4vw,1.5rem)] font-extrabold leading-[1.35] tracking-tight text-white">
                                  {revealed
                                    ? ex.sentence.replace(/_{3,}/g, ex.answer)
                                    : ex.sentence}
                                </p>
                                {revealed && ex.audioClip ? (
                                  <button
                                    type="button"
                                    onClick={() => playContextAudio(ex.id, ex.audioClip)}
                                    aria-label={audioActive ? "Stop" : "Listen"}
                                    className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-full border transition"
                                    style={{
                                      background: "rgba(82,160,214,0.18)",
                                      borderColor: "rgba(159,232,255,0.14)",
                                    }}
                                  >
                                    <Volume2 size={18} className="text-[#9fe8ff]" />
                                  </button>
                                ) : null}
                              </div>
                            ) : isMeaning ? (
                              <>
                                <p className="text-[13px] font-semibold text-white/55">
                                  What does this word mean?
                                </p>
                                <div className="flex w-full items-center justify-center gap-3">
                                  <span className="text-[clamp(2.2rem,7vw,2.9rem)] font-black leading-none tracking-tight text-white">
                                    {ex.word}
                                  </span>
                                  {ex.audioClip ? (
                                    <button
                                      type="button"
                                      onClick={() => playContextAudio(ex.id, ex.audioClip)}
                                      aria-label={audioActive ? "Stop" : "Listen"}
                                      className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-full border transition"
                                      style={{
                                        background: "rgba(82,160,214,0.18)",
                                        borderColor: "rgba(159,232,255,0.14)",
                                      }}
                                    >
                                      <Volume2 size={18} className="text-[#9fe8ff]" />
                                    </button>
                                  ) : null}
                                </div>
                                <span
                                  aria-hidden
                                  className="block rounded-full"
                                  style={{ width: 64, height: 4, background: "#f8c15c" }}
                                />
                                {ex.sentence ? (
                                  <div
                                    className="mt-1 w-full rounded-[20px] px-4 py-4"
                                    style={{ background: "rgba(10,28,58,0.72)" }}
                                  >
                                    <p className="text-center text-[15px] font-semibold leading-6 text-white/[0.78]">
                                      {ex.sentence}
                                    </p>
                                  </div>
                                ) : null}
                              </>
                            ) : null}
                          </div>

                          {/* ── 2×2 option grid ── */}
                          <div className="grid grid-cols-2 gap-3.5">
                            {ex.options.map((option, idx) => {
                              const isSelected = selectedOption === option;
                              const isCorrect = revealed && option === ex.answer;
                              const isWrong = revealed && isSelected && option !== ex.answer;
                              const accent = accentColors[idx % accentColors.length];
                              const bg = isCorrect
                                ? "rgba(110,231,183,0.18)"
                                : isWrong
                                  ? "rgba(251,113,133,0.18)"
                                  : isSelected
                                    ? "rgba(103,181,255,0.14)"
                                    : "rgba(19,54,107,0.92)";
                              const border = isCorrect
                                ? "#6ee7b7"
                                : isWrong
                                  ? "#fb7185"
                                  : isSelected
                                    ? "#67b5ff"
                                    : "rgba(97,146,201,0.26)";
                              return (
                                <button
                                  key={option}
                                  type="button"
                                  onClick={() => chooseOption(option)}
                                  disabled={revealed}
                                  className="flex min-h-[120px] flex-col items-center justify-center gap-3 rounded-[22px] border-[1.5px] px-4 py-4 text-center transition disabled:cursor-not-allowed"
                                  style={{ background: bg, borderColor: border }}
                                >
                                  <span
                                    aria-hidden
                                    className="block rounded-full"
                                    style={{ width: 44, height: 10, background: accent }}
                                  />
                                  <span className="text-[16px] font-extrabold leading-[1.4] text-white/95">
                                    {option}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()
                  : null}

                {currentExercise.type === "match_meaning" ? (
                  <div className="flex flex-col gap-3">
                    <div className="mb-[clamp(0.2rem,0.6vh,0.45rem)] grid shrink-0 grid-cols-2 gap-[clamp(0.35rem,0.7vw,0.55rem)]">
                      <p className="px-1 text-center text-[clamp(0.68rem,1.1vw,0.8rem)] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                        Words
                      </p>
                      <p className="px-1 text-center text-[clamp(0.68rem,1.1vw,0.8rem)] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                        Meanings
                      </p>
                    </div>
                    <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-4 gap-[clamp(0.35rem,0.7vw,0.55rem)]">
                      {currentExercise.pairs.map((pair, index) => {
                        const meaning = currentExercise.pairs[0]?.options[index];
                        const currentValue = matchAnswers[pair.word] ?? "";
                        const matchColor = matchColorClasses[index % matchColorClasses.length];
                        const isActive = activeMatchWord === pair.word;
                        const isCorrect = revealed && currentValue === pair.answer;
                        const isWrong = revealed && currentValue && currentValue !== pair.answer;
                        const assignedWord =
                          meaning != null
                            ? Object.entries(matchAnswers).find(([, assignedMeaning]) => assignedMeaning === meaning)?.[0] ?? null
                            : null;
                        const isAssigned = Boolean(assignedWord);
                        const assignedIndex = assignedWord
                          ? currentExercise.pairs.findIndex((candidate) => candidate.word === assignedWord)
                          : -1;
                        const assignedPair =
                          assignedWord != null
                            ? currentExercise.pairs.find((candidate) => candidate.word === assignedWord) ?? null
                            : null;
                        const meaningColor =
                          assignedIndex >= 0
                            ? matchColorClasses[assignedIndex % matchColorClasses.length]
                            : "";
                        const meaningIsCorrect = revealed && assignedPair?.answer === meaning;
                        const meaningIsWrong = revealed && isAssigned && assignedPair?.answer !== meaning;

                        return (
                          <div key={`${pair.word}-${meaning ?? index}`} className="contents">
                            <button
                              type="button"
                              onClick={() => {
                                if (revealed) return;
                                if (currentValue) {
                                  unassignMatchWord(pair.word);
                                  return;
                                }
                                setActiveMatchWord((prev) => (prev === pair.word ? null : pair.word));
                              }}
                              className={`flex h-full min-h-0 w-full items-center justify-center rounded-[1.2rem] border px-[clamp(0.4rem,0.8vw,0.7rem)] py-[clamp(0.4rem,0.8vw,0.7rem)] text-center transition ${
                                isCorrect
                                  ? matchColor
                                  : isWrong
                                    ? "border-rose-400 bg-rose-400 text-slate-950"
                                    : currentValue
                                      ? matchColor
                                      : isActive
                                        ? matchColor
                                        : "border-[var(--card-border)] bg-[var(--card-bg)] hover:bg-[var(--card-bg-hover)]"
                              }`}
                            >
                              <div>
                                <p className="text-[clamp(0.95rem,1.6vw,1.55rem)] font-semibold tracking-tight">
                                  {pair.word}
                                </p>
                              </div>
                            </button>

                            {meaning ? (
                              <button
                                type="button"
                                onClick={() => {
                                  if (revealed) return;
                                  if (assignedWord) {
                                    unassignMatchWord(assignedWord);
                                    return;
                                  }
                                  assignMatchMeaning(meaning);
                                }}
                                disabled={revealed || (!activeMatchWord && !assignedWord)}
                                className={`flex h-full min-h-0 w-full items-center justify-center rounded-[1.2rem] border px-[clamp(0.4rem,0.8vw,0.7rem)] py-[clamp(0.4rem,0.8vw,0.7rem)] text-center transition ${
                                  meaningIsCorrect
                                    ? meaningColor
                                    : meaningIsWrong
                                      ? "border-rose-400 bg-rose-400 text-slate-950"
                                      : isAssigned
                                        ? meaningColor
                                        : "border-[var(--card-border)] bg-[var(--card-bg)] hover:bg-[var(--card-bg-hover)]"
                                } disabled:opacity-100`}
                              >
                                <p className="text-[clamp(0.76rem,1.12vw,0.94rem)] leading-[1.22]">
                                  {meaning}
                                </p>
                              </button>
                            ) : (
                              <div />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="h-full rounded-3xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6 shadow-md">
                <h2 className="text-2xl font-semibold tracking-tight">Not enough words yet</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
                  This mode needs a few more saved words with clear context before it can generate a useful session.
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <Link
                    href="/favorites"
                    className="inline-flex rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
                  >
                    Open favorites
                  </Link>
                  <button
                    type="button"
                    onClick={closeSession}
                    className="inline-flex rounded-xl border border-[var(--card-border)] bg-[var(--bg-content)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--card-bg-hover)]"
                  >
                    Choose another mode
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer iPhone exacto: botón full-width gold con "CHECK
              ANSWER →" cuando hay respuesta; disabled gris en otro caso;
              estado feedback verde/rojo tras revelar. */}
          {!sessionComplete && currentExercise ? (
            <div>
              {showFeedback ? (
                <button
                  type="button"
                  onClick={continueWithAutoGrade}
                  className={`flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-[18px] text-[13px] font-black uppercase tracking-[0.18em] transition ${
                    lastResult === "correct"
                      ? "bg-emerald-300 text-slate-950 hover:bg-emerald-200"
                      : "bg-rose-400 text-slate-950 hover:bg-rose-300"
                  }`}
                >
                  {exerciseIndex >= exercises.length - 1 ? "Finish" : "Next"}
                  <span aria-hidden>→</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={revealCurrent}
                  disabled={!canSubmitAnswer}
                  className={`flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-[18px] text-[13px] font-black uppercase tracking-[0.18em] transition ${
                    canSubmitAnswer
                      ? "bg-[var(--color-gold)] text-[#2a1a02] hover:bg-[#f59e0b]"
                      : "cursor-not-allowed bg-white/[0.06] text-white/40"
                  }`}
                >
                  {canSubmitAnswer ? "Check answer" : "Pick an answer"}
                  {canSubmitAnswer ? <span aria-hidden>→</span> : null}
                </button>
              )}
            </div>
          ) : null}
        </div>
        {/* In-session confetti burst for a tier-5 combo (10-in-a-row),
            mirroring the iPhone's comboBurst. */}
        <Confetti active={comboBurst} />
        {showExitConfirm ? (
          <PracticeExitConfirm
            onKeepGoing={() => setShowExitConfirm(false)}
            onExit={closeSession}
          />
        ) : null}
        <style jsx global>{`
          @keyframes practice-exercise-in {
            0% { opacity: 0; transform: translateY(12px); }
            100% { opacity: 1; transform: translateY(0); }
          }
          @keyframes practice-result-in {
            0% { opacity: 0; transform: translateY(10px) scale(0.98); }
            100% { opacity: 1; transform: translateY(0) scale(1); }
          }
          @keyframes practice-ring-fill {
            from { stroke-dashoffset: var(--ring-circ); }
            to { stroke-dashoffset: var(--ring-offset); }
          }
          @keyframes combo-pop {
            0% { opacity: 0; transform: translateY(6px) scale(0.7); }
            18% { opacity: 1; transform: translateY(0) scale(1.12); }
            32% { transform: translateY(0) scale(1); }
            82% { opacity: 1; transform: translateY(0) scale(1); }
            100% { opacity: 0; transform: translateY(-4px) scale(0.96); }
          }
          @keyframes combo-halo {
            0% { opacity: 0; transform: scale(0.7); }
            22% { transform: scale(1.25); }
            82% { transform: scale(1.1); }
            100% { opacity: 0; transform: scale(1); }
          }
          @keyframes practice-result-shine {
            0% { transform: translateX(-130%) skewX(-18deg); opacity: 0; }
            18% { opacity: 0.55; }
            100% { transform: translateX(230%) skewX(-18deg); opacity: 0; }
          }
        `}</style>
      </div>
    );
  }

  // Active language for the flag pill. Resolution order:
  //   1. user.publicMetadata.targetLanguages[0] (explicit preference)
  //   2. most-common language across the user's favorites (which is what
  //      Practice operates on anyway)
  //   3. nothing → we hide the pill instead of showing a "🌐 ??" stub
  const metadataLanguage = (() => {
    const tl = user?.publicMetadata?.targetLanguages;
    if (Array.isArray(tl) && typeof tl[0] === "string") return tl[0] as string;
    return null;
  })();
  const activeLanguageName = metadataLanguage ?? inferredLanguageFromFavs;
  const activeVariantKey =
    typeof user?.publicMetadata?.preferredVariant === "string"
      ? (user.publicMetadata.preferredVariant as string)
      : null;
  const activeCountry = activeLanguageName ? getLanguageCountry(activeLanguageName, activeVariantKey) : null;
  const activeLangShort = activeLanguageName
    ? (() => {
        const map: Record<string, string> = {
          spanish: "ES", english: "EN", french: "FR", german: "DE",
          italian: "IT", portuguese: "PT", japanese: "JA", korean: "KO",
          chinese: "ZH",
        };
        const key = activeLanguageName.toLowerCase();
        return map[key] ?? activeLanguageName.slice(0, 2).toUpperCase();
      })()
    : null;

  // iPhone parity: show the 4 main modes (no "natural") on every viewport.
  const visibleModeCards = modeCards.filter((card) => card.mode !== "natural");
  const dueCount = dueFavorites.length;

  return (
    <div
      // Background plano. Sin radial gold-halo arriba y sin degradado
      // vertical: ambos creaban el "brillo" detrás del círculo. Usa el
      // token --bg-content (deep-navy en dark, warm-cream en light) en
      // vez de un hex literal para respetar el theme switch.
      className="min-h-screen p-4 pb-24 text-[var(--foreground)] sm:p-6 sm:pb-24 -mx-1 -my-6 sm:mx-0 sm:my-0 bg-[var(--bg-content)]"
    >
      <div className="mx-auto w-full max-w-[480px]">
      {/* ── iPhone-style HERO - visible on every viewport ── */}
      <div>
        {/* Flag pill + title. Tapping the pill opens the LanguageSwitcher
            bottom sheet (same component used in MobileTabBar). */}
        <div className="flex items-center gap-4 mb-6">
          {activeCountry && activeLangShort ? (
            <button
              type="button"
              onClick={() => setLanguageSwitcherOpen(true)}
              className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] border border-white/10 pl-1.5 pr-3 py-1.5 active:bg-white/[0.1] transition-colors"
              aria-label="Switch language"
            >
              <span
                className="rounded-full bg-black/30 grid place-items-center leading-none"
                style={{ width: 28, height: 28 }}
              >
                <Flag code={activeCountry} size={20} title={activeLangShort} />
              </span>
              <span className="text-[13px] font-extrabold text-white">{activeLangShort}</span>
              <ChevronDown size={14} className="text-white/55" />
            </button>
          ) : null}
          <h1 className="text-[28px] font-black tracking-tight text-white leading-none">
            {isReviewFocus && reviewDueCount > 0 ? "Review" : "Practice"}
          </h1>
        </div>

        {/* Two chips: STREAK + DUE (GOAL needs backend data we don't have
            client-side; using DUE which is the actionable number here). */}
        <div className="flex items-center justify-center gap-3 mb-5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] border border-white/8 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/80">
            <Zap size={13} className="text-[#fb923c]" />
            <span className="text-base font-black text-white leading-none">{practiceStreakDays}</span>
            Streak
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] border border-white/8 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/80">
            <TrendingUp size={13} className="text-emerald-300" />
            <span className="text-base font-black text-white leading-none">{dueCount}</span>
            Due
          </span>
        </div>

        <p className="text-center text-[14px] text-white/72 mb-3">
          From <span className="font-extrabold text-white">Your saved words</span>
        </p>

        {/* DONUT: a real square (260x260) so rounded-full makes a circle.
            Pixel-fixed via inline style because Tailwind v4 JIT silently
            drops some arbitrary values when the file is large. */}
        <div className="flex justify-center mb-3">
          <button
            type="button"
            onClick={() => {
              if (dueCount === 0) return;
              void trackUiMetric("practice_recommended_mode_opened", {
                mode: reviewRecommendedMode,
                source: "orbit_cta",
              });
              setPendingCountdownMode(reviewRecommendedMode);
            }}
            disabled={dueCount === 0}
            // Donut sólido. Marker class `dp-practice-donut`: globals
            // mapea su bg al tema (deep-navy en dark, white card +
            // shadow en light) sin que escribamos hex literales aquí.
            className="dp-practice-donut relative grid place-items-center disabled:opacity-60"
            style={{
              width: 260,
              height: 260,
              borderRadius: "50%",
            }}
            aria-label="Start recommended practice"
          >
            <div className="flex flex-col items-center gap-3">
              <div className="flex flex-col items-center">
                <span
                  className="font-black text-white leading-none"
                  style={{ fontSize: 64 }}
                >
                  {dueCount}
                </span>
                <span className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-white/55 mt-1">
                  Due
                </span>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[var(--color-gold)] px-5 py-2 text-[13px] font-black uppercase tracking-[0.14em] text-[#2a1a02]">
                <Play size={14} fill="currentColor" />
                Start
              </div>
            </div>
          </button>
        </div>

        <p className="text-center text-[12px] text-white/55 mb-5">
          ~{Math.max(1, Math.round(dueCount * 0.3))} min · {dueCount === 0 ? "0" : "1"} skill · +{dueCount * 10} XP
        </p>
      </div>

      {/* Optional Back-to-Journey link shown only when we came from Journey,
          so the user can step out without losing context. */}
      {journeyReturnHref ? (
        <div className="mb-4 flex justify-center">
          <Link
            href={journeyReturnHref}
            className="inline-flex rounded-full border border-white/12 bg-white/6 px-4 py-2 text-xs font-semibold text-white/85 hover:bg-white/10"
          >
            Back to Journey
          </Link>
        </div>
      ) : null}

      {/* ── 2×2 iPhone-style skill cards (4 modes, no "natural") ── */}
      <div className="grid grid-cols-2 gap-3">
        {visibleModeCards.map((card) => (
          <button
            key={card.mode}
            type="button"
            onClick={() => setPendingCountdownMode(card.mode)}
            // dp-practice-mode marker class: el `card.shellClass` trae
            // un gradient dark hardcoded. En light mode lo sobreescribimos
            // a paper card blanco con tint del accent del modo.
            className={`dp-practice-mode group relative overflow-hidden rounded-[1.5rem] border p-3 text-left transition active:scale-[0.99] ${card.shellClass}`}
          >
            <div className="relative flex h-full flex-col">
              <div className="flex items-start justify-between gap-2 mb-3">
                <span
                  className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.75rem] ${card.iconClass}`}
                >
                  <card.icon size={17} />
                </span>
                <span className="text-[26px] font-black leading-none text-white">0</span>
              </div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/70 leading-tight">
                {card.title}
              </p>
            </div>
          </button>
        ))}
      </div>

      </div>{/* end .mx-auto max-w-[480px] */}
      {pendingCountdownMode ? (
        <PracticeCountdown
          onComplete={() => {
            const mode = pendingCountdownMode;
            setPendingCountdownMode(null);
            if (mode) openSession(mode);
          }}
        />
      ) : null}
      <LanguageSwitcher
        open={languageSwitcherOpen}
        onClose={() => setLanguageSwitcherOpen(false)}
      />
    </div>
  );
}
