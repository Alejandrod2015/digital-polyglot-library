"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenText,
  Bookmark,
  BookmarkCheck,
  Check,
  ChevronDown,
  Clock,
  Crown,
  Flame,
  Headphones,
  Home,
  MessageCircleMore,
  Pause,
  Play,
  Rocket,
  RotateCcw,
  Shapes,
  Sparkles,
  Target,
  TrendingUp,
  Volume2,
  X,
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
  markTargetWordInSentence,
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
  normalizeSegmentText,
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
// Exact per-line concat offset for a multi-voice story. Unlike audioSegments
// (aeneas-aligned, drifts vs the post-processed master), these are the byte-exact
// boundaries captured while concatenating each synthesized line, plus the line's
// own isolated mp3 url.
type StoryAudioFragment = {
  text: string;
  startSec: number;
  endSec: number;
  url?: string | null;
  speaker?: string | null;
  voiceId?: string | null;
};

type StoryAudioData = {
  audioUrl: string | null;
  audioSegments: AudioSegment[];
  audioFragments?: StoryAudioFragment[];
};

function coerceAudioFragments(raw: unknown): StoryAudioFragment[] {
  if (!Array.isArray(raw)) return [];
  const out: StoryAudioFragment[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const f = item as Record<string, unknown>;
    const text = typeof f.text === "string" ? f.text : "";
    const startSec = typeof f.startSec === "number" ? f.startSec : NaN;
    const endSec = typeof f.endSec === "number" ? f.endSec : NaN;
    if (!text || !Number.isFinite(startSec) || !Number.isFinite(endSec) || endSec <= startSec) continue;
    out.push({
      text,
      startSec,
      endSec,
      url: typeof f.url === "string" ? f.url : null,
      speaker: typeof f.speaker === "string" ? f.speaker : null,
      voiceId: typeof f.voiceId === "string" ? f.voiceId : null,
    });
  }
  return out;
}

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

// Match a sentence against the story's exact per-line concat fragments. These
// carry byte-exact boundaries (and an isolated per-line mp3) that, unlike the
// aeneas-aligned audioSegments, never drift vs the post-processed master. The
// returned pseudo-segment routes playback to the line's own clip url, so the
// listening exercise plays exactly that one line with zero neighbour bleed.
function matchFragment(
  fragments: StoryAudioFragment[] | undefined,
  sentence: string
): { fragment: StoryAudioFragment; index: number } | null {
  if (!fragments || fragments.length === 0) return null;
  const normalizedSentence = normalizeSegmentText(sentence);
  if (!normalizedSentence) return null;

  let bestFragment: StoryAudioFragment | null = null;
  let bestIndex = -1;
  let bestScore = 0;
  for (let index = 0; index < fragments.length; index += 1) {
    const fragment = fragments[index];
    const normalizedFragment = normalizeSegmentText(fragment.text);
    if (!normalizedFragment) continue;
    let score = 0;
    if (normalizedFragment === normalizedSentence) score = 4;
    else if (
      normalizedFragment.includes(normalizedSentence) ||
      normalizedSentence.includes(normalizedFragment)
    )
      score = 3;
    if (score > bestScore) {
      bestScore = score;
      bestFragment = fragment;
      bestIndex = index;
    }
  }

  if (!bestFragment || bestScore < 3) return null;
  return { fragment: bestFragment, index: bestIndex };
}

function findFragmentSegment(
  fragments: StoryAudioFragment[] | undefined,
  sentence: string
): AudioSegment | null {
  const match = matchFragment(fragments, sentence);
  if (!match) return null;
  const { fragment, index } = match;
  return {
    id: `fragment-${index}`,
    text: fragment.text,
    normalizedText: normalizeSegmentText(fragment.text),
    startSec: fragment.startSec,
    endSec: fragment.endSec,
    index,
    clipUrl: fragment.url ?? undefined,
  };
}

function findSegmentForClip(
  storyAudio: StoryAudioData | null | undefined,
  clip: PracticeAudioClip | null | undefined
): AudioSegment | null {
  if (!storyAudio || !clip) return null;
  if (clip.storySource !== "standalone") {
    return (
      findFragmentSegment(storyAudio.audioFragments, clip.sentence) ??
      findBestAudioSegmentLegacy(storyAudio.audioSegments, clip.sentence)
    );
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

// Per-exercise countdown duration (seconds). Match gets more time
// because it's multiple pairs at once; the rest are single-answer.
function timerDurationForExercise(exercise: PracticeExercise | null): number {
  return exercise?.type === "match_meaning" ? 20 : 15;
}

function getModeLabel(mode: PracticeMode): string {
  switch (mode) {
    case "meaning":
      return "Meaning";
    case "context":
      return "Context";
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
// Single vetted narrator voice for isolated-word audio (Narrador2). Lone-word
// ElevenLabs renders vary a lot per voice; this one validated cleanest. Pre-
// generated clips are cached under this voiceId, so the client must request it.
const WORD_AUDIO_VOICE_ID = "yHD4CsKkghm19ToGLJEC";
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
  // Count of non-featured (pool) exercises for the current story; drives the
  // "Practice the rest" action on the result screen.
  const [poolCount, setPoolCount] = useState(0);
  // Next story in the curriculum (resolved server-side), for the result-screen
  // "Next story / Next topic" forward action.
  const [nextStoryResolved, setNextStoryResolved] = useState<{
    slug: string;
    title: string;
    kind: "story" | "topic";
    topic: string;
  } | null>(null);
  // The story's own narrator voice, so isolated-word audio matches the story's
  // country accent (RULE: see src/lib/practiceVoice.ts). Null until loaded.
  const [narratorVoiceId, setNarratorVoiceId] = useState<string | null>(null);
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
  const [savedWords, setSavedWords] = useState<Set<string>>(() => new Set());
  // Combo toast (iPhone parity): an animated celebration pill that pops in the
  // header when the streak hits a tier (≥2 in a row) and auto-dismisses.
  const [comboToast, setComboToast] = useState<{ streak: number; tier: ComboTier; label: string } | null>(null);
  const comboDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Per-exercise countdown: 15 s for single-answer exercises, 20 s for
  // match. When it hits 0 without an answer revealed the exercise reveals
  // as wrong (timeout-as-wrong). Actual per-exercise value is set in the
  // exercise-change effect via `timerDurationForExercise`.
  const [timerRemaining, setTimerRemaining] = useState(15);
  // Wall-clock duration of the round, captured when the session completes so
  // the result card can show a "time" stat like the iPhone version.
  const [sessionDurationMs, setSessionDurationMs] = useState<number | null>(null);
  const sessionStartRef = useRef<number | null>(null);
  // Tracks the last context exercise whose sentence audio we auto-played on
  // reveal, so the effect fires exactly once per reveal (iPhone parity).
  const contextRevealAudioRef = useRef<string | null>(null);
  // Last exercise id whose audio we warmed into the HTTP cache (so play is instant).
  const preloadedExerciseRef = useRef<string | null>(null);
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
  // Exercise ids answered wrong this round, and (when retrying) the subset of
  // ids to re-run. "Fix the ones you missed" reruns just these instead of all.
  const [wrongIds, setWrongIds] = useState<string[]>([]);
  const [retryIds, setRetryIds] = useState<string[] | null>(null);
  const [playingClipId, setPlayingClipId] = useState<string | null>(null);
  const [speakingClipId, setSpeakingClipId] = useState<string | null>(null);
  const [hqClipId, setHqClipId] = useState<string | null>(null);
  const [hqUrlBySentence, setHqUrlBySentence] = useState<Record<string, string>>({});
  // Isolated-word audio (ElevenLabs, same voice as the story line). Separate
  // element + state from the sentence/context clip so the two play buttons in a
  // meaning exercise are independent.
  const [wordClipId, setWordClipId] = useState<string | null>(null);
  const [wordUrlByKey, setWordUrlByKey] = useState<Record<string, string>>({});
  const wordAudioRef = useRef<HTMLAudioElement | null>(null);
  const [userStoryAudioBySlug, setUserStoryAudioBySlug] = useState<Record<string, StoryAudioData>>({});
  const [standaloneStoryAudioBySlug, setStandaloneStoryAudioBySlug] = useState<Record<string, StoryAudioData>>({});
  const clipAudioRef = useRef<HTMLAudioElement | null>(null);
  const clipStopAtRef = useRef<number | null>(null);
  const clipTimeHandlerRef = useRef<(() => void) | null>(null);
  // #5(c): ref al fallback de síntesis para poder invocarlo desde callbacks
  // definidos ANTES de playSpeechText (evita el TDZ del dep-array).
  const playSpeechTextRef = useRef<
    ((clipOwnerId: string, text: string, language: string | null | undefined) => void) | null
  >(null);
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
  const storyNextTitle = searchParams.get("nextTitle");
  // "story" (default) or "topic" — when the next item starts a new topic (i.e.
  // this was the last story of the current topic), the button reads "Next topic".
  const storyNextKind = searchParams.get("nextKind") === "topic" ? "topic" : "story";
  const journeyVariant = searchParams.get("variant");
  const journeyLevelId = searchParams.get("levelId");
  const journeyTopicId = searchParams.get("topicId");
  const explicitReturnTo = searchParams.get("returnTo");
  const explicitReturnLabel = searchParams.get("returnLabel");
  const isReviewFocus = searchParams.get("review") === "1";
  const requestedModeParam = searchParams.get("mode");
  // A mode the user explicitly asked for via ?mode= (vs the auto-recommended
  // one). Story practice only filters the curated set to a single type when a
  // mode is explicit; otherwise it runs the WHOLE curated set as one mixed
  // session (what "just finished the story" should feel like).
  const explicitStoryMode: PracticeMode | null =
    requestedModeParam === "meaning" ||
    requestedModeParam === "context" ||
    requestedModeParam === "listening" ||
    requestedModeParam === "match"
      ? requestedModeParam
      : null;
  const isJourneyCheckpoint = searchParams.get("checkpoint") === "1";
  const onlyExerciseParam = searchParams.get("ex");
  // `?pool=1`: practice the story's POOL (the non-featured extras) instead of the
  // featured end-of-story set. Offered from the result screen as "Practice more".
  const storyPoolMode = searchParams.get("pool") === "1";
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
              }${storyPoolMode ? "&pool=1" : ""}`
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
          setPoolCount(
            !Array.isArray(data) && typeof (data as { poolCount?: number }).poolCount === "number"
              ? (data as { poolCount?: number }).poolCount!
              : 0
          );
          setNextStoryResolved(
            !Array.isArray(data) &&
              (data as { nextStory?: unknown }).nextStory &&
              typeof (data as { nextStory?: { slug?: unknown } }).nextStory === "object"
              ? ((data as unknown as {
                  nextStory: { slug: string; title: string; kind: "story" | "topic"; topic: string };
                }).nextStory)
              : null
          );
          setNarratorVoiceId(
            !Array.isArray(data) && typeof (data as { narratorVoiceId?: unknown }).narratorVoiceId === "string"
              ? (data as unknown as { narratorVoiceId: string }).narratorVoiceId
              : null
          );
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

  // Seed the "saved" state from the user's actual vocabulary so words the user
  // bookmarked WHILE reading the story already render as saved in the
  // end-of-exercises words panel. Without this, `savedWords` only ever holds
  // words tapped inside this practice session (it starts empty), so
  // reading-saved words wrongly showed as un-saved. Runs independently of the
  // practice-source load because journey/story modes fetch their items from a
  // different endpoint than /api/favorites.
  useEffect(() => {
    if (!isLoaded || !user) return;
    let cancelled = false;

    const seedFromWords = (words: Iterable<string>) => {
      if (cancelled) return;
      setSavedWords((prev) => {
        const next = new Set(prev);
        for (const w of words) {
          const key = (w || "").toLowerCase();
          if (key) next.add(key);
        }
        return next;
      });
    };

    const seed = async () => {
      try {
        const res = await fetch("/api/favorites", { cache: "no-store" });
        if (!res.ok) throw new Error(`Error ${res.status}`);
        const data = (await res.json()) as PracticeFavoriteItem[];
        if (Array.isArray(data)) {
          seedFromWords(data.map((item) => item.word));
          return;
        }
      } catch {
        // Fall back to the reading-saved localStorage cache (written by the
        // reader's VocabPanel), which covers the same-session save flow.
      }
      seedFromWords(readLocalPracticeFavorites(user.id).map((item) => item.word));
    };

    void seed();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, user]);

  useEffect(() => {
    const userStorySlugs = Array.from(
      new Set(
        [
          // The practiced story itself, so exercises can play its audio segments
          // (e.g. the listening clip) without a saved favorite from that story.
          ...(isStoryPractice && storyPracticeSlug ? [storyPracticeSlug.trim()] : []),
          ...favorites
            .filter((favorite) => !isStandaloneFavorite(favorite))
            .map((favorite) => (typeof favorite.storySlug === "string" ? favorite.storySlug.trim() : "")),
        ].filter(Boolean)
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
          stories?: Array<{ slug?: string; audioUrl?: string | null; audioSegments?: unknown; audioFragments?: unknown }>;
        };

        if (cancelled) return;

        const next: Record<string, StoryAudioData> = {};
        for (const story of data.stories ?? []) {
          const slug = normalizeStorySlug(story.slug);
          if (!slug) continue;
          next[slug] = {
            audioUrl: typeof story.audioUrl === "string" ? story.audioUrl : null,
            audioSegments: coerceAudioSegments(story.audioSegments),
            audioFragments: coerceAudioFragments(story.audioFragments),
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
  }, [favorites, isStoryPractice, storyPracticeSlug]);

  const orderedFavorites = useMemo(
    () => sortPracticeItemsByOnboarding(favorites, onboardingPracticePrefs, true),
    [favorites, onboardingPracticePrefs]
  );
  const exercises = useMemo(() => {
    // Story practice renders the editorially CURATED set (prefabExercises),
    // the same source the mobile client prefers; the curated listen_choose
    // carries the real story-segment audioClip, and curated fill_blanks carry
    // hand-authored cloze + translations. Falling through to
    // buildPracticeSession (which synthesises exercises from raw vocab) would
    // play browser TTS and show vocab-derived distractors, so only use it when
    // there is no curated set for this story. A selected mode filters the
    // curated set by exercise type so the mode tabs keep working.
    const modeType: Record<PracticeMode, PracticeExercise["type"]> = {
      meaning: "meaning_in_context",
      context: "fill_blank",
      listening: "listen_choose",
      match: "match_meaning",
    };
    const base = isJourneyCheckpoint
      ? prefabExercises
      : isStoryPractice && prefabExercises.length > 0
        ? explicitStoryMode
          ? prefabExercises.filter((ex) => ex.type === modeType[explicitStoryMode])
          : prefabExercises
        : selectedMode
          ? buildPracticeSession(orderedFavorites, selectedMode, onboardingPracticePrefs)
          : [];
    // `?ex=N` (or a comma list `?ex=0,6,9`) opens just those exercises (0-based)
    // for previewing specific items without playing the whole set. For story
    // practice the indices address the FULL curated set (not the mode-filtered
    // subset), so a review link like `?ex=10,0,6,9` always maps to the same
    // curated exercises regardless of any auto-selected mode.
    const pickPool =
      isStoryPractice && prefabExercises.length > 0 && !isJourneyCheckpoint ? prefabExercises : base;
    let result = base;
    if (onlyExerciseParam != null && onlyExerciseParam !== "") {
      const picks = onlyExerciseParam
        .split(",")
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isInteger(n) && n >= 0 && n < pickPool.length);
      if (picks.length) result = picks.map((i) => pickPool[i]);
    }
    // "Fix the ones you missed" reruns just the wrong exercises from the set.
    if (retryIds && retryIds.length) {
      const wanted = new Set(retryIds);
      const filtered = result.filter((ex) => wanted.has(ex.id));
      if (filtered.length) return filtered;
    }
    return result;
  }, [explicitStoryMode, isJourneyCheckpoint, isStoryPractice, onboardingPracticePrefs, onlyExerciseParam, orderedFavorites, prefabExercises, retryIds, selectedMode]);
  const currentExercise = exercises[exerciseIndex] ?? null;

  // Toggle a practiced word in Favorites: first tap saves, second tap removes.
  // Optimistic; reverts on failure.
  const toggleWord = useCallback(
    async (es: string, en: string) => {
      const key = (es || "").toLowerCase();
      if (!es) return;
      const wasSaved = savedWords.has(key);
      setSavedWords((prev) => {
        const next = new Set(prev);
        if (wasSaved) next.delete(key);
        else next.add(key);
        return next;
      });
      try {
        await fetch("/api/favorites", {
          method: wasSaved ? "DELETE" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            wasSaved
              ? { word: es }
              // #4a (audit 2026-07-24): NO hardcodear 'spanish' (guardaba palabras
              // alemanas/italianas como español → acento equivocado, y bloqueaba
              // el backfill del server que solo rellena cuando language es null).
              // Guardamos sin idioma; favorites GET lo rellena desde el journey de
              // la historia (storySlug).
              : { word: es, translation: en || es, storySlug: storyPracticeSlug ?? undefined },
          ),
        });
      } catch {
        setSavedWords((prev) => {
          const next = new Set(prev);
          if (wasSaved) next.add(key);
          else next.delete(key);
          return next;
        });
      }
    },
    [savedWords, storyPracticeSlug],
  );

  const inferredModeFromExercise: PracticeMode | null =
    currentExercise?.type === "meaning_in_context"
      ? "meaning"
      : currentExercise?.type === "fill_blank"
        ? "context"
        : currentExercise?.type === "listen_choose"
          ? "listening"
          : currentExercise?.type === "match_meaning"
            ? "match"
            : null;
  // In a mixed story run (whole curated set, no explicit ?mode), the header
  // should reflect the CURRENT exercise's type, not the auto-selected mode.
  const activePracticeMode =
    isStoryPractice && !explicitStoryMode
      ? inferredModeFromExercise ?? selectedMode
      : selectedMode ?? inferredModeFromExercise;
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
    // Deep-link sessions (journey / story / checkpoint) opened with no return
    // href have no mode picker to fall back to, so setSelectedMode(null) does
    // nothing; navigate away instead so the back button never silently fails.
    if (isJourneyPractice || isStoryPractice || isJourneyCheckpoint) {
      if (typeof window !== "undefined") {
        if (window.history.length > 1) window.history.back();
        else window.location.href = "/";
      }
      return;
    }
    setSelectedMode(null);
  }, [isJourneyCheckpoint, isJourneyPractice, isStoryPractice, journeyReturnHref, storyReturnHref]);
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
    setTimerRemaining(15);
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
    setTimerRemaining(timerDurationForExercise(exercises[exerciseIndex] ?? null));
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
  // pill (iPhone parity). Visual ONLY; the celebration chime is reserved for
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
      setWrongIds((prev) => (prev.includes(currentExercise.id) ? prev : [...prev, currentExercise.id]));
    }
  }, [currentExercise, matchAnswers, playFeedbackSound, revealedIds, selectedOption]);

  // Timer tick: count down once per second while an exercise is unanswered.
  // Stops on reveal/complete.
  useEffect(() => {
    if (!activeSession || sessionComplete || pendingCountdownMode) return;
    if (!currentExercise) return;
    if (revealed) return;
    if (timerRemaining <= 0) return;
    const id = window.setTimeout(() => {
      setTimerRemaining((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearTimeout(id);
  }, [activeSession, sessionComplete, pendingCountdownMode, currentExercise, revealed, timerRemaining]);

  // Timeout-as-wrong: when the timer reaches 0 with no answer revealed, reveal
  // the exercise (an empty/incorrect selection grades as wrong).
  useEffect(() => {
    if (!activeSession || sessionComplete || pendingCountdownMode) return;
    if (!currentExercise) return;
    if (revealed) return;
    if (timerRemaining > 0) return;
    revealCurrent();
  }, [activeSession, sessionComplete, pendingCountdownMode, currentExercise, revealed, timerRemaining, revealCurrent]);

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
      audio.onended = null;
    }
    clipStopAtRef.current = null;
    clipTimeHandlerRef.current = null;
    setPlayingClipId(null);
  }, []);

  useEffect(() => {
    stopClipPlayback();
    if (wordAudioRef.current) wordAudioRef.current.pause();
    setWordClipId(null);
  }, [exerciseIndex, stopClipPlayback]);

  const playExactContextClip = useCallback(
    async (clipOwnerId: string, clip: PracticeAudioClip | null | undefined) => {
      if (!clip || typeof window === "undefined") return;
      // Explicit pre-trimmed clip URL (e.g. a sentence carved out of a long
      // narrator paragraph): play it directly, no segment/master logic.
      const explicitUrl = typeof clip.clipUrl === "string" && clip.clipUrl.trim() ? clip.clipUrl.trim() : null;
      if (explicitUrl) {
        const a = clipAudioRef.current ?? new Audio();
        clipAudioRef.current = a;
        if (clipTimeHandlerRef.current) { a.removeEventListener("timeupdate", clipTimeHandlerRef.current); clipTimeHandlerRef.current = null; }
        if (playingClipId === clipOwnerId) { stopClipPlayback(); return; }
        stopClipPlayback();
        clipStopAtRef.current = null;
        if (a.src !== explicitUrl) a.src = explicitUrl;
        a.currentTime = 0;
        a.onended = () => stopClipPlayback();
        setPlayingClipId(clipOwnerId);
        try {
          await a.play();
        } catch (err) {
          // #5(c): un clipUrl pre-horneado stale/404 dejaba la oración MUDA. En
          // vez de solo parar, caer a la síntesis del navegador de la oración.
          console.error("[practice] clip url play failed, falling back to speech synth", err);
          stopClipPlayback();
          playSpeechTextRef.current?.(clipOwnerId, clip.sentence, clip.language);
        }
        return;
      }
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
        // An isolated per-line mp3 (standalone clip url, or a journey
        // audioFragment url) plays start-to-finish with zero neighbour bleed and
        // no boundary-trim guesswork, so always prefer it when present.
        const directClipUrl =
          typeof segment.clipUrl === "string" && segment.clipUrl.trim()
            ? segment.clipUrl.trim()
            : null;

        if (directClipUrl) {
          clipStopAtRef.current = null;
          if (audio.src !== directClipUrl) {
            audio.src = directClipUrl;
          }
          audio.currentTime = 0;
          // The isolated clip plays to its natural end (no timeupdate stop),
          // so reset the play/pause state when it finishes; otherwise the
          // button stays stuck on "pause" after the audio is done.
          audio.onended = () => stopClipPlayback();
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
        // Slice playback stops via timeupdate, not natural end; clear any
        // onended handler left over from a prior direct-clip play.
        audio.onended = null;

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
      const nextExercise = exercises[exerciseIndex + 1] ?? null;
      // Reset the countdown synchronously in the same batched render as the
      // index bump. Otherwise, when advancing FROM an exercise whose timer
      // already hit 0, the timeout-as-wrong effect re-runs on the new exercise
      // with the stale `timerRemaining === 0` (the [exerciseIndex] reset effect
      // hasn't committed yet) and force-reveals it as wrong. Seeding the fresh
      // duration here means that effect's guard (`timerRemaining > 0`) holds.
      setTimerRemaining(timerDurationForExercise(nextExercise));
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

  const resetRound = () => {
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
    setMissedWords([]);
    practiceStartTrackedRef.current = false;
    practiceCompletionTrackedRef.current = false;
  };
  // Full replay: every exercise again.
  const restart = () => {
    setRetryIds(null);
    setWrongIds([]);
    resetRound();
  };
  // Rerun ONLY the exercises answered wrong this round.
  const restartMissed = () => {
    setRetryIds(wrongIds);
    setWrongIds([]);
    resetRound();
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
  // #5(c): mantener el ref apuntando al último playSpeechText.
  playSpeechTextRef.current = playSpeechText;

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
            // #4b: no hardcodear 'german'. Si no hay idioma fiable, dejamos que
            // el endpoint responda (400/404) y caemos a la síntesis del navegador.
            ...(clip.language ? { language: clip.language } : {}),
          }),
        });
        if (!res.ok) {
          // #5(b): el fallback que el comentario de arriba promete. Un idioma sin
          // voz (fr) o sin idioma → 404/400; en vez de quedar MUDO, hablar por
          // SpeechSynthesis del navegador (mejor algo que silencio).
          console.error("[practice] HQ TTS failed, falling back to speech synth", res.status);
          playSpeechText(clipOwnerId, clip.sentence, clip.language);
          return;
        }
        const data = (await res.json()) as { url?: string };
        if (!data.url) {
          playSpeechText(clipOwnerId, clip.sentence, clip.language);
          return;
        }
        url = data.url;
        setHqUrlBySentence((prev) => ({ ...prev, [cacheKey]: data.url! }));
      } catch (err) {
        console.error("[practice] HQ TTS error, falling back to speech synth", err);
        playSpeechText(clipOwnerId, clip.sentence, clip.language);
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
  }, [hqClipId, hqUrlBySentence, playSpeechText]);

  // Single audio entry point for context exercises (iPhone parity: one button,
  // not three). Prefer the real story segment when we have it, fall back to
  // high-quality ElevenLabs TTS, then to the browser speech synth.
  const playContextAudio = useCallback(
    (clipOwnerId: string, clip: PracticeAudioClip | null | undefined) => {
      if (!clip) return;
      // Pre-trimmed clip URL wins (sentence carved from a narrator paragraph).
      if (typeof clip.clipUrl === "string" && clip.clipUrl.trim()) {
        void playExactContextClip(clipOwnerId, clip);
        return;
      }
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

  // Play a SINGLE word (the meaning exercise's "play word" button). Rendered by
  // ElevenLabs in ONE fixed, vetted narrator voice (not the line's speaker):
  // lone-word renders are inconsistent per-voice, and this voice was validated
  // as the cleanest. The sentence button still plays the authentic speaker, so
  // only the isolated word standardises on this voice. Tapping again stops it.
  const playWordTts = useCallback(
    async (
      clipOwnerId: string,
      word: string,
      clip: PracticeAudioClip | null | undefined,
      languageOverride?: string | null
    ) => {
      if (!word || typeof window === "undefined") return;
      // RULE: the isolated word is spoken in the STORY'S practice voice (country
      // accent), so the R2 cache key matches the pre-generated clip. In JOURNEY
      // practice a topic pools words from several stories, each with its own
      // voice, so the per-exercise clip.voiceId is the source of truth; the
      // page-level narratorVoiceId (story practice) and the shared fixed voice
      // are only fallbacks. Without clip.voiceId, journey word audio requested
      // the fixed voice, missed the R2 cache (404) and went silent.
      const clipVoiceRaw = typeof clip?.voiceId === "string" ? clip.voiceId.trim() : "";
      const clipVoice = clipVoiceRaw.startsWith("elevenlabs/")
        ? clipVoiceRaw.slice("elevenlabs/".length)
        : clipVoiceRaw;
      const voiceId = clipVoice || narratorVoiceId || WORD_AUDIO_VOICE_ID;
      if (!voiceId) return;
      const audio = wordAudioRef.current ?? new Audio();
      wordAudioRef.current = audio;
      if (wordClipId === clipOwnerId) {
        audio.pause();
        setWordClipId(null);
        return;
      }
      // El idioma viene del clip (ejercicios) o del override (match, que no
      // pasa clip). Sin él, word-tts asume español y pronuncia palabras
      // alemanas/italianas con fonética española.
      const wordLanguage = clip?.language ?? languageOverride ?? undefined;
      // #5 (audit 2026-07-24): si hay clip PRE-HORNEADO de la palabra
      // (wordClipUrl), reproducirlo directo — el primer tier de la cadena de
      // fuentes que la web se saltaba (siempre re-rendeaba via runtime).
      const preBakedWordUrl =
        typeof clip?.wordClipUrl === "string" && clip.wordClipUrl.trim() ? clip.wordClipUrl.trim() : null;
      const cacheKey = `${voiceId}|${word.toLowerCase()}|${wordLanguage ?? "es"}`;
      let url = preBakedWordUrl ?? wordUrlByKey[cacheKey];
      if (!url) {
        try {
          const res = await fetch("/api/practice/word-tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ word, voiceId, ...(wordLanguage ? { language: wordLanguage } : {}) }),
          });
          if (!res.ok) {
            // #5(a): en vez de quedar MUDO ante un word-tts non-2xx (502/500/
            // 400/404 fr-pt), caer a la síntesis del navegador.
            console.error("[practice] word TTS failed, falling back to speech synth", res.status);
            playSpeechText(clipOwnerId, word, wordLanguage ?? null);
            return;
          }
          const data = (await res.json()) as { url?: string };
          if (!data.url) {
            playSpeechText(clipOwnerId, word, wordLanguage ?? null);
            return;
          }
          url = data.url;
          setWordUrlByKey((prev) => ({ ...prev, [cacheKey]: data.url! }));
        } catch (err) {
          console.error("[practice] word TTS error, falling back to speech synth", err);
          playSpeechText(clipOwnerId, word, wordLanguage ?? null);
          return;
        }
      }
      audio.src = url;
      audio.currentTime = 0;
      audio.onended = () => setWordClipId((current) => (current === clipOwnerId ? null : current));
      setWordClipId(clipOwnerId);
      try {
        await audio.play();
      } catch (err) {
        // #5(a): si el mp3 (pre-horneado o de runtime) no reproduce, último
        // recurso = síntesis del navegador, no silencio.
        console.error("[practice] word TTS play error, falling back to speech synth", err);
        setWordClipId(null);
        playSpeechText(clipOwnerId, word, wordLanguage ?? null);
      }
    },
    [wordClipId, wordUrlByKey, narratorVoiceId, playSpeechText]
  );

  // Preload this exercise's audio the moment it appears, so the play buttons
  // react instantly instead of waiting ~1s for the word-tts round-trip and the
  // mp3 download on click. Warms the browser's media cache via hidden <audio>
  // elements; the actual play then loads from cache.
  useEffect(() => {
    if (!currentExercise) return;
    if (preloadedExerciseRef.current === currentExercise.id) return;
    preloadedExerciseRef.current = currentExercise.id;
    let cancelled = false;

    // Warm the browser HTTP cache by fetching the mp3 (R2 serves it `immutable`,
    // so the play button's later request is served instantly from cache).
    // A detached <audio preload> is NOT reliable — browsers defer/skip preload
    // of media not in the DOM. fetch() actually downloads + caches.
    const warm = (url: string | null | undefined) => {
      if (!url || typeof window === "undefined") return;
      void fetch(url, { cache: "force-cache" }).catch(() => {});
    };
    // Resolve a word-tts url (cache or endpoint), then warm its mp3. The voice
    // must match what playWordTts requests at click time, i.e. the exercise's
    // own clip.voiceId when set (journey practice), else narrator, else fixed.
    const fallbackWordVoiceId = narratorVoiceId ?? WORD_AUDIO_VOICE_ID;
    const warmLanguage =
      (currentExercise as { audioClip?: { language?: string } | null }).audioClip?.language ??
      (currentExercise as { language?: string }).language ??
      undefined;
    const warmWord = (word: string, clipVoiceId?: string | null, langOverride?: string | null) => {
      const raw = typeof clipVoiceId === "string" ? clipVoiceId.trim() : "";
      const wordVoiceId =
        (raw.startsWith("elevenlabs/") ? raw.slice("elevenlabs/".length) : raw) || fallbackWordVoiceId;
      // #6 (audit 2026-07-24): en match el warm usaba warmLanguage ('es' por
      // defecto) y la voz fallback, mientras el click usa pair.language/pair.voiceId
      // → distinta cache key: el warm se desperdiciaba y generaba un render con
      // acento español de una palabra extranjera. Con el override, warm == click.
      const lang = langOverride ?? warmLanguage;
      const key = `${wordVoiceId}|${word.toLowerCase()}|${lang ?? "es"}`;
      if (wordUrlByKey[key]) {
        warm(wordUrlByKey[key]);
        return;
      }
      void fetch("/api/practice/word-tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word, voiceId: wordVoiceId, ...(lang ? { language: lang } : {}) }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { url?: string } | null) => {
          if (cancelled || !d?.url) return;
          setWordUrlByKey((prev) => (prev[key] ? prev : { ...prev, [key]: d.url! }));
          warm(d.url);
        })
        .catch(() => {});
    };

    // Match: warm each target-language word with ITS voice + language (so the
    // warm cache key matches the click; #6).
    if (currentExercise.type === "match_meaning") {
      for (const pair of currentExercise.pairs) {
        warmWord(pair.word, pair.voiceId ?? pair.wordVoiceId ?? null, pair.language ?? null);
      }
      return () => {
        cancelled = true;
      };
    }

    const clip =
      currentExercise.type === "meaning_in_context" || currentExercise.type === "fill_blank"
        ? currentExercise.audioClip
        : null;
    if (!clip) return;

    // Example-sentence audio: a pre-trimmed clip url, else the story master mp3.
    warm(
      typeof clip.clipUrl === "string" && clip.clipUrl.trim()
        ? clip.clipUrl.trim()
        : clip.storySource !== "standalone"
          ? userStoryAudioBySlug[normalizeStorySlug(clip.storySlug)]?.audioUrl ?? null
          : null
    );
    // Isolated word audio (meaning only).
    if (currentExercise.type === "meaning_in_context") warmWord(currentExercise.word, clip.voiceId);
    return () => {
      cancelled = true;
    };
  }, [currentExercise, userStoryAudioBySlug, wordUrlByKey, narratorVoiceId]);

  // Context-mode reveal audio (iPhone parity): no autoplay while the user is
  // thinking, but the moment they reveal the answer we play the full sentence
  // so they hear the word in its natural context. Fires once per reveal.
  // Meaning exercises don't autoplay here; they expose explicit word/sentence
  // play buttons instead.
  useEffect(() => {
    if (!revealed || !currentExercise) return;
    if (currentExercise.type !== "fill_blank") return;
    if (!currentExercise.audioClip) return;
    if (contextRevealAudioRef.current === currentExercise.id) return;
    contextRevealAudioRef.current = currentExercise.id;
    playContextAudio(currentExercise.id, currentExercise.audioClip);
  }, [revealed, currentExercise, playContextAudio]);

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
  // Use the per-exercise mode (activePracticeMode) so a mixed story run shows the
  // CURRENT exercise's label/theme (e.g. "Match" on a match), not the auto mode.
  const activeModeTheme = activePracticeMode ? modeThemeByMode[activePracticeMode] : null;
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
      listening: 0,
      match: 0,
    };

    for (const exercise of exercises) {
      if (exercise.type === "match_meaning") continue;
      const response = checkpointResponses[exercise.id];
      if (!response || response === exercise.answer) continue;

      if (exercise.type === "meaning_in_context") counts.meaning += 1;
      else if (exercise.type === "fill_blank") counts.context += 1;
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
      listening: 0,
      match: 0,
    };

    for (const item of dueFavorites) {
      counts.meaning += 1;
      if (item.exampleSentence?.trim()) counts.context += 2;
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
    // `?ex=` review/preview links open specific exercises directly — skip the
    // 3-2-1 get-ready countdown (it's only for a real "start practicing" run).
    if (onlyExerciseParam) {
      openSession(reviewRecommendedMode);
    } else {
      // Abre la sesión YA (el primer ejercicio se renderiza de fondo) y muestra
      // el 3-2-1 como overlay translúcido encima. Así nunca se ve el hub de
      // práctica al venir de una historia; el countdown queda sobre el ejercicio.
      openSession(reviewRecommendedMode);
      setPendingCountdownMode(reviewRecommendedMode);
    }
  }, [
    isStoryPractice,
    loadState,
    favorites.length,
    selectedMode,
    pendingCountdownMode,
    reviewRecommendedMode,
    onlyExerciseParam,
    openSession,
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
    const timerDuration = timerDurationForExercise(currentExercise);
    return (
      <div className="relative -mx-1 -my-6 box-border h-[calc(100dvh-env(safe-area-inset-top))] overflow-hidden px-4 py-2.5 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] text-[var(--foreground)] sm:px-5 sm:py-4 sm:pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <div
          className={`mx-auto grid h-full max-w-[480px] gap-2 ${
            sessionComplete
              ? "grid-rows-[auto_minmax(0,1fr)]"
              : "grid-rows-[auto_minmax(0,1fr)_auto] sm:grid-rows-[auto_minmax(0,1fr)_144px]"
          }`}
        >
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
                {!sessionComplete ? (
                  <p className="text-[10.5px] font-extrabold uppercase tracking-[0.22em] text-white/55">
                    {activeModeTheme?.eyebrow ?? "Word quest"}
                    {" · "}
                    {String(Math.min(exerciseIndex + 1, exercises.length)).padStart(2, "0")}
                    {" OF "}
                    {String(exercises.length).padStart(2, "0")}
                  </p>
                ) : null}
                <div className="flex items-center gap-2.5">
                  {!sessionComplete ? (
                    <p className="text-[26px] font-black tracking-tight text-white leading-tight">
                      {activeModeTheme?.title ?? "Practice"}
                    </p>
                  ) : null}
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
                  drains. Hidden once the answer is revealed. */}
              {!sessionComplete &&
              currentExercise &&
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

            {/* Timer bar: empties left-to-right over the countdown window.
                Same visibility rule as the badge. */}
            {!sessionComplete &&
            currentExercise &&
            !revealed ? (
              <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.08]">
                <div
                  className="h-full rounded-full transition-[width] duration-1000 ease-linear"
                  style={{
                    width: `${Math.max(0, Math.min(100, (timerRemaining / timerDuration) * 100))}%`,
                    backgroundColor: timerColor,
                  }}
                />
              </div>
            ) : null}

            {/* Mini-segments por ejercicio (uno por exercise).
                Sin big bar arriba - iPhone sólo muestra esta fila.
                Se oculta en la pantalla de resultado: el progreso de
                sesión no aplica una vez terminado el set. */}
            {!sessionComplete ? (
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
            ) : null}

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
                // Greeting must track the actual score: praising a 0% run with
                // "Nice run" reads as broken. Tier it, and keep it warm without
                // overclaiming at the low end.
                const greeting = isPerfect
                  ? firstName
                    ? `Perfect, ${firstName}.`
                    : "Perfect run."
                  : accuracyPct >= 70
                    ? firstName
                      ? `Nice run, ${firstName}.`
                      : "Nice run."
                    : accuracyPct >= 40
                      ? firstName
                        ? `Good effort, ${firstName}.`
                        : "Good effort."
                      : firstName
                        ? `Keep at it, ${firstName}.`
                        : "Keep at it.";
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
                  // Distinct dark-mode tint for secondary actions ("next" vs
                  // "replay"), so Next-story and Replay don't look identical.
                  accent?: "next" | "replay";
                };
                const actions: ResultAction[] = [];
                let primaryIsReplay = false;
                if (isJourneyCheckpoint && !checkpointPassed) {
                  // "Retry" and "Replay" both just restart the same set, so show
                  // ONE action; flag it so the redundant "Replay" isn't added.
                  primaryIsReplay = true;
                  actions.push({ key: "retry", title: "Try again", subtitle: "Same questions", icon: RotateCcw, primary: true, onClick: restart });
                } else if (isStoryPractice) {
                  // Story practice: lead with fixing what you missed (more useful
                  // than replaying everything), then a forward action (next
                  // story, when known), then replay-all.
                  const missedCount = Math.max(0, total - score);
                  if (missedCount > 0) {
                    actions.push({
                      key: "fix-missed",
                      title: `Fix the ${missedCount}`,
                      subtitle: "you missed",
                      icon: Target,
                      primary: true,
                      onClick: restartMissed,
                    });
                  }
                  // The POOL (extra curated exercises) surfaces here: "Practice"
                  // shows the rest of the story's vocab beyond the featured set.
                  if (!storyPoolMode && poolCount > 0 && storyPracticeSlug) {
                    actions.push({
                      key: "pool",
                      title: "Practice",
                      subtitle: `${poolCount} more word${poolCount === 1 ? "" : "s"}`,
                      icon: BookOpenText,
                      primary: actions.length === 0,
                      href: `/practice?source=story&storySlug=${encodeURIComponent(storyPracticeSlug)}${
                        storyPracticeBookSlug ? `&bookSlug=${encodeURIComponent(storyPracticeBookSlug)}` : ""
                      }&pool=1`,
                    });
                  }
                  // Forward action: always move ahead in the curriculum, never
                  // "back to the story you just read". Prefer the server-resolved
                  // next story (knows topic boundaries); fall back to a URL param.
                  if (nextStoryResolved) {
                    // Carry the journey the current story came from as `returnTo`
                    // so pressing Back inside the NEXT story lands on that journey
                    // (the user already practiced these exercises). Without it the
                    // reader falls through to router.back() → back to /practice.
                    const nextReturnTo =
                      explicitReturnTo && explicitReturnTo.startsWith("/") && !explicitReturnTo.startsWith("//")
                        ? explicitReturnTo
                        : journeyReturnHref;
                    const nextStoryHrefResolved = nextReturnTo
                      ? `/stories/${nextStoryResolved.slug}?returnTo=${encodeURIComponent(nextReturnTo)}&returnLabel=${encodeURIComponent(explicitReturnLabel?.trim() || "Journey")}`
                      : `/stories/${nextStoryResolved.slug}`;
                    actions.push({
                      key: "next-story",
                      title: nextStoryResolved.kind === "topic" ? "Next topic" : "Next story",
                      subtitle: nextStoryResolved.title?.trim() || "Continue",
                      icon: ArrowRight,
                      accent: "next",
                      primary: actions.length === 0,
                      href: nextStoryHrefResolved,
                    });
                  } else if (storyNextHref) {
                    actions.push({
                      key: "next-story",
                      title: storyNextKind === "topic" ? "Next topic" : "Next story",
                      subtitle: storyNextTitle?.trim() || "Continue",
                      icon: ArrowRight,
                      accent: "next",
                      primary: actions.length === 0,
                      href: storyNextHref,
                    });
                  }
                  actions.push({ key: "replay", title: "Replay", subtitle: `All ${total}`, icon: RotateCcw, accent: "replay", primary: actions.length === 0, onClick: restart });
                  primaryIsReplay = true; // a replay action is already present
                } else if (isJourneyPractice && journeyReturnHref) {
                  actions.push({
                    key: "journey",
                    title: isJourneyCheckpoint && checkpointPassed && !checkpointNeedsSave ? "Continue" : "Journey",
                    subtitle: explicitReturnLabel?.trim() || "Back to journey",
                    icon: ArrowRight,
                    primary: true,
                    href: journeyReturnHref,
                  });
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
                // A failed checkpoint should always offer a sensible second
                // action. Prefer teasing the next story by name (intrigue);
                // otherwise fall back to a plain exit.
                if (isJourneyCheckpoint && !checkpointPassed && actions.length < 2) {
                  if (storyNextHref) {
                    actions.push({
                      key: "next-story",
                      title: storyNextKind === "topic" ? "Next topic" : "Next story",
                      subtitle: storyNextTitle?.trim() || "Keep going",
                      icon: ArrowRight,
                      href: storyNextHref,
                    });
                  } else {
                    actions.push({ key: "back", title: "Back", subtitle: "Exit practice", icon: Home, onClick: closeSession });
                  }
                }
                if (actions.length < 3 && !isStoryPractice && !isJourneyPractice) {
                  actions.push({ key: "favorites", title: "Words", subtitle: "Favorites", icon: BookOpenText, href: "/favorites" });
                }

                // Words practiced this session (es word + en gloss), deduped, for
                // a quick end-of-session review. Pulls from every exercise type.
                const practicedWords: { es: string; en: string }[] = [];
                const seenWords = new Set<string>();
                const addWord = (es: string, en: string) => {
                  const key = (es || "").toLowerCase();
                  if (!es || seenWords.has(key)) return;
                  seenWords.add(key);
                  practicedWords.push({ es, en: en || "" });
                };
                for (const exItem of exercises) {
                  if (exItem.type === "meaning_in_context") addWord(exItem.word, exItem.answer);
                  else if (exItem.type === "fill_blank") {
                    const ai = exItem.options.indexOf(exItem.answer);
                    addWord(exItem.answer, exItem.optionTranslations?.[ai] ?? "");
                  } else if (exItem.type === "listen_choose") {
                    const ai = exItem.options.indexOf(exItem.answer);
                    addWord(exItem.answer, exItem.optionTranslations?.[ai] ?? "");
                  } else if (exItem.type === "match_meaning") {
                    for (const p of exItem.pairs) addWord(p.word, p.answer);
                  }
                }

                return (
                  <div
                    className="dp-practice-session relative flex h-full w-full flex-col items-center justify-start gap-3"
                    style={{ animation: "practice-result-in 280ms ease-out both" }}
                  >
                    <Confetti active={isPerfect} />

                    {/* Celebration block (chips, ring, greeting) — fixed, always
                        fully visible (never clipped). */}
                    <div className="flex w-full shrink-0 flex-col items-center gap-3">
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
                        <circle cx={RING / 2} cy={RING / 2} r={R} fill="none" stroke="var(--practice-ring-track)" strokeWidth={STROKE} />
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
                    </div>
                    </div>

                    {/* Stat cards */}
                    <div className="flex w-full shrink-0 gap-2.5">
                      <div className="flex flex-1 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5">
                        <Target size={20} className="text-[color:var(--practice-audio-icon)]" />
                        <div>
                          <p className="text-[18px] font-black leading-none text-white">{accuracyPct}%</p>
                          <p className="mt-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white/60">Accuracy</p>
                        </div>
                      </div>
                      <div className="flex flex-1 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5">
                        <Clock size={20} className="text-[#f8c15c]" />
                        <div>
                          <p className="text-[18px] font-black leading-none text-white">{durationLabel}</p>
                          <p className="mt-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white/60">Time</p>
                        </div>
                      </div>
                    </div>

                    {/* Checkpoint recovery words (only on failed checkpoint) */}
                    {isJourneyCheckpoint && !checkpointPassed && checkpointRecoveryWords.length > 0 ? (
                      <div className="w-full shrink-0 rounded-2xl border border-rose-200/20 bg-rose-300/[0.08] px-4 py-3">
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-rose-100">Review these first</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {checkpointRecoveryWords.map((word) => (
                            <span key={word} className="rounded-full border border-rose-200/20 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-rose-50">
                              {word}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {/* Words you practiced — fixed-height, always visible. Tap a
                        chip to save that word; the box scrolls only if there are
                        more rows than fit. */}
                    {practicedWords.length > 0 ? (
                      <div className="w-full shrink-0">
                        <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.2em] text-white/50">
                          Words you practiced
                          <span className="ml-2 font-bold normal-case tracking-normal text-white/35">tap to save</span>
                        </p>
                        <div
                          className="overflow-x-auto overscroll-contain pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                          style={{
                            display: "grid",
                            gridTemplateRows: "repeat(3, auto)",
                            gridAutoFlow: "column",
                            gridAutoColumns: "max-content",
                            gap: "8px",
                            justifyContent: "start",
                            // rows at content height (no stretch → chips not tall)
                            alignContent: "start",
                            // each chip keeps its own width → varied, not a rigid grid
                            justifyItems: "start",
                          }}
                        >
                          {practicedWords.map((w) => {
                            const isSaved = savedWords.has(w.es.toLowerCase());
                            return (
                              <button
                                key={w.es}
                                type="button"
                                onClick={() => toggleWord(w.es, w.en)}
                                aria-label={isSaved ? `Remove ${w.es}` : `Save ${w.es}`}
                                className={`inline-flex h-fit shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-left transition ${
                                  isSaved
                                    ? "border-emerald-300/40 bg-emerald-300/[0.10]"
                                    : "dp-word-pill border-white/10 bg-white/[0.05] hover:bg-white/[0.09]"
                                }`}
                              >
                                <span className="text-[12.5px] font-bold leading-none text-white">{w.es}</span>
                                {w.en ? <span className="dp-prac-chip-tr text-[11px] leading-none">{w.en}</span> : null}
                                {isSaved ? (
                                  <BookmarkCheck size={14} className="shrink-0 text-emerald-400" />
                                ) : (
                                  <Bookmark size={14} className="shrink-0 text-white/60" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}

                    {/* Actions */}
                    <div className="w-full shrink-0">
                      {/* Equal-width buttons on one row (items-stretch → same
                          height). The name wraps to as many lines as it needs, so
                          the text adapts to its length without squashing the other
                          button. min-w-0 keeps both at 50/50. */}
                      <div className="flex items-stretch gap-2.5">
                        {actions.slice(0, 3).map((action) => {
                          const Icon = action.icon;
                          // Dark-mode secondary tint: Next-story reads cobalt,
                          // Replay reads amber, so they don't look identical.
                          // Light mode overrides both to amber via
                          // `.dp-result-secondary` (!important), so this is
                          // dark-only by construction.
                          const secondaryTint =
                            action.accent === "next"
                              ? "border-[#2256c9]/40 bg-[#2256c9]/[0.18] hover:bg-[#2256c9]/[0.26]"
                              : action.accent === "replay"
                                ? "border-amber-400/30 bg-amber-400/[0.10] hover:bg-amber-400/[0.17]"
                                : "border-white/10 bg-white/[0.04] hover:bg-white/[0.07]";
                          const cardClass = `flex min-w-0 flex-1 items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left transition ${
                            action.primary
                              ? "border-[var(--color-gold)] bg-[var(--color-gold)] hover:brightness-105"
                              : `dp-result-secondary ${secondaryTint}`
                          }`;
                          const iconWrapClass = `grid h-8 w-8 shrink-0 place-items-center rounded-[10px] ${
                            action.primary ? "bg-black/15" : "bg-white/[0.06]"
                          }`;
                          const titleClass = `text-[14px] font-black leading-tight tracking-tight ${action.primary ? "text-[#0a1424]" : "text-white"}`;
                          const subClass = `break-words text-[11px] font-bold leading-snug ${action.primary ? "text-[#0a1424]/70" : "text-white/60"}`;
                          const inner = (
                            <>
                              <span className={iconWrapClass}>
                                <Icon size={16} className={action.primary ? "text-[#0a1424]" : "text-white/80"} />
                              </span>
                              <span className="flex min-w-0 flex-col">
                                <span className={titleClass}>{action.title}</span>
                                <span className={subClass}>{action.subtitle}</span>
                              </span>
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
                className="dp-practice-session relative flex h-full min-h-0 flex-col rounded-3xl border border-[var(--card-border)] bg-[var(--card-bg)] p-5 shadow-md"
                style={{ animation: "practice-exercise-in 280ms cubic-bezier(0.22,1,0.36,1) both" }}
              >
                {activeModeTheme ? (
                  <>
                    <div
                      aria-hidden="true"
                      className={`pointer-events-none absolute inset-x-0 top-0 h-28 rounded-t-3xl bg-gradient-to-b ${activeModeTheme.panelGlow}`}
                    />
                    <div
                      aria-hidden="true"
                      className={`absolute inset-x-0 top-0 h-1 rounded-t-3xl bg-gradient-to-r ${activeModeTheme.accentBar}`}
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
                      const isContext = ex.type === "fill_blank";
                      const isListening = ex.type === "listen_choose";
                      const audioActive =
                        isListening
                          ? // a real story-segment clip plays via playingClipId;
                            // the TTS fallback uses speakingClipId — cover both.
                            isContextAudioActive(ex.id)
                          : isContextAudioActive(ex.id);
                      const accentColors = ["#fbbf24", "#60a5fa", "#a78bfa", "#34d399"];
                      return (
                        <div className="flex min-h-0 flex-1 flex-col gap-4">
                          {/* ── Hero ── */}
                          <div className="flex shrink-0 flex-col items-center gap-3 pt-1">
                            {isListening ? (
                              <div className="flex flex-col items-center gap-3 py-3">
                                <button
                                  type="button"
                                  onClick={() =>
                                    ex.type === "listen_choose" && ex.audioClip
                                      ? playContextAudio(ex.id, ex.audioClip)
                                      : playListenPrompt()
                                  }
                                  aria-label={audioActive ? "Pause" : "Play"}
                                  className="grid h-24 w-24 place-items-center rounded-full border-2 transition active:scale-95"
                                  style={{
                                    background: "var(--practice-audio-bg)",
                                    borderColor: "var(--practice-audio-border)",
                                    boxShadow: "0 0 36px var(--practice-audio-glow)",
                                  }}
                                >
                                  {audioActive ? (
                                    <Pause size={40} className="text-[color:var(--practice-audio-icon)]" fill="currentColor" />
                                  ) : (
                                    <Volume2 size={40} className="text-[color:var(--practice-audio-icon)]" />
                                  )}
                                </button>
                                <span className="text-[12px] font-black uppercase tracking-[0.2em] text-white/70">
                                  {audioActive ? "Tap to pause" : "Tap to listen"}
                                </span>
                              </div>
                            ) : isContext ? (
                              <div className="flex w-full flex-col items-center gap-3">
                                {ex.prompt ? (
                                  <p
                                    className={`text-center ${
                                      ex.sentence
                                        ? "text-[13px] font-semibold text-white/55"
                                        : "text-[clamp(1.15rem,2.4vw,1.5rem)] font-extrabold leading-[1.3] tracking-tight text-white"
                                    }`}
                                  >
                                    {ex.prompt}
                                  </p>
                                ) : null}
                                {ex.sentence ? (
                                  <div
                                    className="flex w-full min-w-0 items-center justify-center gap-3 rounded-[20px] px-4 py-4"
                                    style={{ background: "var(--practice-box-bg)" }}
                                  >
                                    <p className="min-w-0 flex-1 text-center [overflow-wrap:anywhere] text-[clamp(1.05rem,2.2vw,1.45rem)] font-extrabold leading-[1.35] tracking-tight text-white">
                                      {ex.sentence.split(/(_{3,})/).map((part, i) =>
                                        /^_{3,}$/.test(part) ? (
                                          revealed ? (
                                            <strong
                                              key={i}
                                              className="dp-prac-uline dp-prac-answer underline decoration-2 underline-offset-4"
                                              style={{
                                                ["--prac-answer-accent" as string]:
                                                  selectedOption === ex.answer ? "#16a34a" : "#dc2626",
                                              }}
                                            >
                                              {ex.answer}
                                            </strong>
                                          ) : (
                                            <span key={i} className="dp-prac-blank">{part}</span>
                                          )
                                        ) : (
                                          part
                                        ),
                                      )}
                                    </p>
                                    {revealed && ex.audioClip ? (
                                      <button
                                        type="button"
                                        onClick={() => playContextAudio(ex.id, ex.audioClip)}
                                        aria-label={audioActive ? "Pause" : "Listen"}
                                        className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-full border transition"
                                        style={{
                                          background: "var(--practice-audio-bg-soft)",
                                          borderColor: "var(--practice-audio-border-soft)",
                                        }}
                                      >
                                        {audioActive ? (
                                          <Pause size={18} fill="currentColor" className="text-[color:var(--practice-audio-icon)]" />
                                        ) : (
                                          <Volume2 size={18} className="text-[color:var(--practice-audio-icon)]" />
                                        )}
                                      </button>
                                    ) : null}
                                  </div>
                                ) : null}
                                {ex.type === "fill_blank" && ex.translation ? (
                                  <p className="px-2 text-center text-[12px] italic leading-snug text-white/40">
                                    {(() => {
                                      const t = ex.translation as string;
                                      const ai = ex.options.indexOf(ex.answer);
                                      const en = ex.optionTranslations?.[ai];
                                      return t.split(/(_{3,})/).map((part, i) =>
                                        /^_{3,}$/.test(part) ? (
                                          revealed && en ? (
                                            <strong key={i} className="font-semibold not-italic text-white/70 dp-prac-uline underline decoration-2 underline-offset-2">
                                              {en}
                                            </strong>
                                          ) : (
                                            <span key={i} className="dp-prac-blank">{part}</span>
                                          )
                                        ) : (
                                          part
                                        ),
                                      );
                                    })()}
                                  </p>
                                ) : null}
                              </div>
                            ) : isMeaning ? (
                              <>
                                <p className="text-[13px] font-semibold text-white/55">
                                  What does this word mean?
                                </p>
                                <div className="flex w-full min-w-0 items-center justify-center gap-3">
                                  <span
                                    className="min-w-0 max-w-full text-center [overflow-wrap:anywhere] text-[clamp(1.4rem,7vw,2.9rem)] font-black leading-[1.05] tracking-tight text-white dp-prac-uline underline decoration-[3px] underline-offset-[10px]"
                                  >
                                    {ex.word}
                                  </span>
                                  {ex.audioClip ? (
                                    (() => {
                                      const wordOwnerId = `${ex.id}:word`;
                                      const wordActive = wordClipId === wordOwnerId;
                                      return (
                                        <button
                                          type="button"
                                          onClick={() => playWordTts(wordOwnerId, ex.word, ex.audioClip)}
                                          aria-label={wordActive ? "Stop" : "Listen to the word"}
                                          className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-full border transition"
                                          style={{
                                            background: "var(--practice-audio-bg-soft)",
                                            borderColor: "var(--practice-audio-border-soft)",
                                          }}
                                        >
                                          {wordActive ? (
                                            <Pause size={18} fill="currentColor" className="text-[color:var(--practice-audio-icon)]" />
                                          ) : (
                                            <Volume2 size={18} className="text-[color:var(--practice-audio-icon)]" />
                                          )}
                                        </button>
                                      );
                                    })()
                                  ) : null}
                                </div>
                                {ex.sentence ? (
                                  <div
                                    className="mt-1 flex w-full items-center gap-3 rounded-[20px] px-4 py-4"
                                    style={{ background: "var(--practice-box-bg)" }}
                                  >
                                    <p className="flex-1 text-center text-[15px] font-semibold leading-6 text-white/75">
                                      {markTargetWordInSentence(ex.sentence, ex.word).split(/\[\[(.+?)\]\]/).map((part, i) =>
                                        i % 2 === 1 ? (
                                          <strong key={i} className="font-extrabold text-white dp-prac-uline underline decoration-2 underline-offset-4">
                                            {part}
                                          </strong>
                                        ) : (
                                          part
                                        ),
                                      )}
                                    </p>
                                    {ex.audioClip ? (
                                      <button
                                        type="button"
                                        onClick={() => playContextAudio(ex.id, ex.audioClip)}
                                        aria-label={isContextAudioActive(ex.id) ? "Stop" : "Listen to the example"}
                                        className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full border transition"
                                        style={{
                                          background: "var(--practice-audio-bg-soft)",
                                          borderColor: "var(--practice-audio-border-soft)",
                                        }}
                                      >
                                        {isContextAudioActive(ex.id) ? (
                                          <Pause size={16} fill="currentColor" className="text-[color:var(--practice-audio-icon)]" />
                                        ) : (
                                          <Volume2 size={16} className="text-[color:var(--practice-audio-icon)]" />
                                        )}
                                      </button>
                                    ) : null}
                                  </div>
                                ) : null}
                              </>
                            ) : null}
                          </div>

                          {/* ── 2×2 option grid ── */}
                          <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-3">
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
                                    : "var(--practice-option-bg)";
                              const border = isCorrect
                                ? "#6ee7b7"
                                : isWrong
                                  ? "#fb7185"
                                  : isSelected
                                    ? "#67b5ff"
                                    : "var(--practice-option-border)";
                              return (
                                <button
                                  key={option}
                                  type="button"
                                  onClick={() => chooseOption(option)}
                                  disabled={revealed}
                                  className="relative flex h-full min-h-0 flex-col items-center justify-center gap-2 rounded-[22px] border-[1.5px] px-4 py-3 text-center transition disabled:cursor-not-allowed"
                                  style={{ background: bg, borderColor: border }}
                                >
                                  {isCorrect || isWrong ? (
                                    <span
                                      aria-hidden
                                      className="absolute right-2.5 top-2.5 grid h-6 w-6 place-items-center rounded-full"
                                      style={{
                                        background: isCorrect ? "rgba(22,163,74,0.15)" : "rgba(220,38,38,0.13)",
                                        color: isCorrect ? "#16a34a" : "#dc2626",
                                        boxShadow: isCorrect
                                          ? "inset 0 0 0 1px rgba(22,163,74,0.35)"
                                          : "inset 0 0 0 1px rgba(220,38,38,0.32)",
                                      }}
                                    >
                                      {isCorrect ? <Check size={14} strokeWidth={3} /> : <X size={14} strokeWidth={3} />}
                                    </span>
                                  ) : null}
                                  <span
                                    aria-hidden
                                    className="block shrink-0 rounded-full"
                                    style={{ width: 44, height: 10, background: accent }}
                                  />
                                  <span className="text-[16px] font-extrabold leading-[1.4] text-[color:var(--foreground)]">
                                    {option}
                                  </span>
                                  {revealed && (ex.type === "fill_blank" || ex.type === "listen_choose") && ex.optionTranslations?.[idx] ? (
                                    <span className="text-[12px] italic leading-snug text-white/45">
                                      {ex.optionTranslations[idx]}
                                    </span>
                                  ) : null}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()
                  : null}

                {currentExercise.type === "match_meaning" ? (
                  <div className="flex min-h-0 flex-1 flex-col gap-3">
                    <p className="shrink-0 text-center text-[13px] font-semibold text-white/60">
                      Tap a word, then its meaning.
                    </p>
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
                            <div
                              role="button"
                              tabIndex={revealed ? -1 : 0}
                              onClick={() => {
                                if (revealed) return;
                                if (currentValue) {
                                  unassignMatchWord(pair.word);
                                  return;
                                }
                                setActiveMatchWord((prev) => (prev === pair.word ? null : pair.word));
                              }}
                              className={`relative flex h-full min-h-0 w-full cursor-pointer items-center justify-center rounded-[1.2rem] border px-[clamp(0.4rem,0.8vw,0.7rem)] py-[clamp(0.4rem,0.8vw,0.7rem)] text-center transition ${
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
                              {/* Listen to the target-language word. */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // #6 (audit 2026-07-24): pasar un clip con la voz del par
                                  // (narrador, ahora estampado server-side) y el wordClipUrl
                                  // pre-horneado si existe, en vez de clip=null (que caía a la
                                  // voz fija WORD_AUDIO_VOICE_ID, no la del narrador).
                                  void playWordTts(
                                    `${currentExercise.id}:m:${pair.word}`,
                                    pair.word,
                                    {
                                      storySlug: "",
                                      sentence: pair.word,
                                      storySource: "user",
                                      voiceId: pair.voiceId ?? pair.wordVoiceId ?? null,
                                      language: pair.language ?? null,
                                      wordClipUrl: pair.wordClipUrl ?? null,
                                    },
                                    pair.language,
                                  );
                                }}
                                aria-label="Listen to the word"
                                className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full border border-current/30 bg-white/10 text-current transition hover:bg-white/20"
                              >
                                {wordClipId === `${currentExercise.id}:m:${pair.word}` ? (
                                  <Pause size={12} fill="currentColor" />
                                ) : (
                                  <Volume2 size={12} />
                                )}
                              </button>
                              <div className="min-w-0 max-w-full">
                                <p className="[overflow-wrap:anywhere] text-[clamp(0.85rem,2.4vw,1.9rem)] font-semibold leading-[1.1] tracking-tight">
                                  {pair.word}
                                </p>
                              </div>
                            </div>

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
                                <p className="text-[clamp(0.95rem,1.7vw,1.3rem)] leading-[1.22]">
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
                  className={`flex w-full items-center justify-center gap-2.5 rounded-2xl px-6 py-[18px] text-[13px] font-black uppercase tracking-[0.18em] transition hover:brightness-95 ${
                    lastResult === "correct"
                      ? "dp-prac-next-ok shadow-[0_8px_20px_-8px_rgba(16,185,129,0.5)]"
                      : "dp-prac-next-bad shadow-[0_8px_20px_-8px_rgba(244,63,94,0.5)]"
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
                  className={`flex w-full items-center justify-center gap-2.5 rounded-2xl px-6 py-[18px] text-[13px] font-black uppercase tracking-[0.18em] transition ${
                    canSubmitAnswer
                      ? "bg-[var(--color-gold)] text-[#2a1a02] shadow-[0_8px_20px_-8px_rgba(245,158,11,0.5)] hover:bg-[#f59e0b]"
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
        {/* 3-2-1 overlay ENCIMA del primer ejercicio (sesión ya abierta al venir
            de una historia). Translúcido para que se vea el ejercicio de fondo. */}
        {pendingCountdownMode ? (
          <PracticeCountdown
            translucent
            onComplete={() => {
              setPendingCountdownMode(null);
            }}
          />
        ) : null}
      </div>
    );
  }

  // Al venir de una historia (source=story) NUNCA se debe pintar el hub de
  // práctica: el efecto de auto-start abre la sesión + countdown, pero hasta que
  // corre habría un frame de hub. Mientras tanto renderizamos el skeleton de
  // carga (no el hub) para que el hub no aparezca nunca.
  if (
    isStoryPractice &&
    !onlyExerciseParam &&
    !selectedMode &&
    !pendingCountdownMode &&
    favorites.length > 0
  ) {
    return (
      <div className="min-h-screen p-6 pb-24 text-[var(--foreground)]">
        <div className="mb-4 h-9 w-48 animate-pulse rounded bg-[var(--card-bg)]" />
        <div className="mb-3 h-4 w-80 animate-pulse rounded bg-[var(--card-bg)]" />
        <div className="h-72 animate-pulse rounded-3xl bg-[var(--card-bg)]" />
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

  // iPhone parity: 4 practice modes shown on every viewport.
  const visibleModeCards = modeCards;
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

      {/* ── 2×2 iPhone-style skill cards (4 modes) ── */}
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
