import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Audio, InterruptionModeIOS, type AVPlaybackStatus } from "expo-av";
import {
  Animated,
  Easing,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import { Image } from "react-native";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import {
  CEFR_LEVEL_LABELS,
  LEVEL_LABELS,
  formatLanguage,
  formatLanguageCode,
  formatLevel,
  formatRegion,
  formatTopic,
  formatVariant,
  formatVariantLabel,
  VARIANT_OPTIONS_BY_LANGUAGE,
  type Book,
  type Level,
  type Story,
  type VocabItem,
} from "@digital-polyglot/domain";
import { requireOptionalNativeModule } from "expo-modules-core";
import { ReaderScreen } from "./ReaderScreen";
import {
  BookHomeCard,
  BookWebCard,
  ExploreStoryListCard,
  FeatureStoryCard,
  StoryHeroCard,
  type BookCardModel,
  type StoryCardModel,
} from "./MobileCards";
import { MobileBookDetail } from "./MobileBookDetail";
import { MobileSettingsScreen } from "./MobileSettingsScreen";
import { JourneyLanguageHub, type LanguageInsightsSummary } from "./MobileJourneyLanguageHub";
import { MobileCreateScreen } from "./MobileCreateScreen";
import { ProgressiveImage } from "./ProgressiveImage";
import { mobileCatalog } from "./catalog";
import { fullMobileCatalog } from "./fullCatalog";
import { mobileConfig } from "../config";
import { apiFetch, isApiErrorStatus } from "../lib/api";
import {
  loadMobilePreviewState,
  saveMobilePreviewState,
  type ReadingProgress,
} from "./mobileLocalState";
import {
  clearPendingCreate,
  loadPendingCreate,
  savePendingCreate,
} from "./mobileCreateState";
import {
  loadSeenGamificationCelebrations,
  saveSeenGamificationCelebrations,
} from "./mobileGamificationState";
import {
  loadOfflineSnapshot,
  removeStoryOffline,
  saveStoryOffline,
  saveStandaloneStoryOffline,
  type OfflineLibrarySnapshot,
} from "../lib/offlineStore";
import type { PushRegistrationState } from "../notifications/registerPush";
import { syncDailyReminderSchedule, type ReminderDestination } from "../notifications/dailyReminder";
import {
  addFavoriteOnServer,
  loadLocalFavorites,
  removeFavoriteOnServer,
  saveLocalFavorites,
  syncFavoritesFromServer,
  updateFavoriteReviewOnServer,
  type MobileFavoriteItem,
} from "./vocabFavorites";
import {
  buildMixedPracticeSession,
  buildPracticeSession,
  getRecommendedPracticeModeFromOnboarding,
  getDuePracticeItems,
  getSpeechSynthesisLang,
  type PracticeAudioClip,
  type PracticeFavoriteItem,
} from "../../../../src/lib/practiceExercises";
import {
  coerceAudioSegments,
  findBestAudioSegment,
  findBestAudioSegmentLegacy,
  type AudioSegment,
} from "../../../../src/lib/audioSegments";
import type { GamificationSummary } from "../../../../src/lib/gamification";
import {
  REMINDER_HOUR_OPTIONS,
  buildDailyReminderCopy,
  formatReminderHour,
  normalizeReminderHour,
  normalizeRemindersEnabled,
} from "../../../../src/lib/reminders";
import {
  buildGamificationCelebrations,
  type GamificationCelebration,
} from "../../../../src/lib/gamificationCelebrations";
import {
  JOURNEY_FOCUS_OPTIONS,
  getCreateFocusForGoal,
  getDefaultCreateTopic,
  getJourneyFocusFromLearningGoal,
  getJourneyVariantFromPreferences,
  getLearningGoalFromJourneyFocus,
  ONBOARDING_DAILY_MINUTES_OPTIONS,
  ONBOARDING_GOAL_OPTIONS,
  ONBOARDING_INTEREST_OPTIONS,
  ONBOARDING_LEVEL_OPTIONS,
  normalizeJourneyFocus,
  pickOnboardingTopicPreference,
  PRODUCT_TOUR_MESSAGES,
  scoreReadTimeFit,
  sortPracticeItemsByOnboarding,
  scoreTopicLabelAgainstOnboarding,
  type JourneyFocus,
  type OnboardingGoal,
} from "../../../../src/lib/onboarding";
import { buildJourneyTrackInsights } from "./journeyTrackInsights";
import { JOURNEY_MILESTONE_CHIME_URI, PRACTICE_CORRECT_SOUND_URI, PRACTICE_WRONG_SOUND_URI } from "../../../../src/lib/journeyMilestone";

type ReaderSelection = {
  book: Book;
  story: Story;
  resolvedAudioUrl?: string | null;
};

type MobileScreen =
  | "home"
  | "explore"
  | "practice"
  | "favorites"
  | "journey"
  | "library"
  | "settings"
  | "create"
  | "progress";

type BottomTab = "home" | "explore" | "practice" | "favorites" | "journey" | "signin";
type MenuIconName =
  | "progress"
  | "settings"
  | "library"
  | "story"
  | "upgrade"
  | "signout"
  | "signin"
  | "legal"
  | "journey"
  | "create";
type HomeFeedMode = "stories" | "books";
type SaveStatus = "idle" | "saving" | "saved" | "error";
type CreateSection = "language" | "level" | "region" | "topic";
type SettingsSection =
  | CreateSection
  | "variant"
  | "interests"
  | "goal"
  | "journeyFocus"
  | "dailyMinutes";
type ExploreSection = "language" | "region";
type Plan = "free" | "basic" | "premium" | "polyglot";

const PREVIEW_OFFLINE_USER_ID = "preview-ios";
const CATALOG_BOOKS = fullMobileCatalog.length > 0 ? fullMobileCatalog : mobileCatalog;

type OptionalSpeechModule = {
  stop: () => void;
  speak: (
    text: string,
    options?: {
      language?: string;
      rate?: number;
      pitch?: number;
      onDone?: () => void;
      onStopped?: () => void;
      onError?: () => void;
    }
  ) => void;
};

type NativeExpoSpeechModule = {
  speak: (
    id: string,
    text: string,
    options?: {
      language?: string;
      rate?: number;
      pitch?: number;
    }
  ) => void | Promise<void>;
  stop: () => void | Promise<void>;
  addListener?: (eventName: string, listener: (payload: { id?: string }) => void) => void;
  removeAllListeners?: (eventName: string) => void;
};

const speechCallbacks = new Map<
  string,
  {
    onDone?: () => void;
    onStopped?: () => void;
    onError?: () => void;
  }
>();
let speechListenersBound = false;
let speechNextId = 1;

function toQaSegment(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function bindSpeechListeners(module: NativeExpoSpeechModule) {
  if (speechListenersBound || !module.addListener || !module.removeAllListeners) return;

  const doneEvent = "Exponent.speakingDone";
  const stoppedEvent = "Exponent.speakingStopped";
  const errorEvent = "Exponent.speakingError";

  module.removeAllListeners(doneEvent);
  module.removeAllListeners(stoppedEvent);
  module.removeAllListeners(errorEvent);

  module.addListener(doneEvent, ({ id }) => {
    if (!id) return;
    const callbacks = speechCallbacks.get(id);
    speechCallbacks.delete(id);
    callbacks?.onDone?.();
  });

  module.addListener(stoppedEvent, ({ id }) => {
    if (!id) return;
    const callbacks = speechCallbacks.get(id);
    speechCallbacks.delete(id);
    callbacks?.onStopped?.();
  });

  module.addListener(errorEvent, ({ id }) => {
    if (!id) return;
    const callbacks = speechCallbacks.get(id);
    speechCallbacks.delete(id);
    callbacks?.onError?.();
  });

  speechListenersBound = true;
}

function getOptionalSpeechModule(): OptionalSpeechModule | null {
  const nativeModule = requireOptionalNativeModule<NativeExpoSpeechModule>("ExpoSpeech");
  if (!nativeModule || typeof nativeModule.speak !== "function" || typeof nativeModule.stop !== "function") {
    return null;
  }

  bindSpeechListeners(nativeModule);

  return {
    stop: () => {
      void nativeModule.stop();
    },
    speak: (text, options) => {
      const id = `mobile-speech-${speechNextId++}`;
      speechCallbacks.set(id, {
        onDone: options?.onDone,
        onStopped: options?.onStopped,
        onError: options?.onError,
      });
      void nativeModule.speak(id, text, {
        language: options?.language,
        rate: options?.rate,
        pitch: options?.pitch,
      });
    },
  };
}

function stripHtml(input?: string): string {
  return (input ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function estimateReadMinutes(text?: string): number {
  const words = stripHtml(text).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 180));
}

function truncateText(input?: string, max = 132): string {
  const clean = stripHtml(input);
  if (!clean) return "";
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max).trimEnd()}...`;
}

function getBookStoryTopic(story: Story, book: Book): string {
  return formatTopic(story.topic ?? book.topic ?? "General");
}

type MobileBillingEntitlement = {
  hasEntitlement: boolean;
  plan: string;
  source: string | null;
  status: string;
  books?: string[];
  interests?: string[];
  targetLanguages?: string[];
};

type RemoteContinueListeningItem = {
  bookSlug: string;
  storySlug: string;
  lastPlayedAt: string;
  progressSec?: number;
  audioDurationSec?: number;
};

type MobilePreferences = {
  targetLanguages: string[];
  interests: string[];
  preferredLevel: string | null;
  preferredRegion: string | null;
  preferredVariant: string | null;
  learningGoal: OnboardingGoal | null;
  journeyFocus: JourneyFocus | null;
  dailyMinutes: number | null;
  remindersEnabled: boolean;
  reminderHour: number | null;
  journeyPlacementLevel: string | null;
  onboardingSurveyCompletedAt: string | null;
  onboardingTourCompletedAt: string | null;
};

type MobileProgressPayload = {
  minutesListened: number;
  storiesFinished: number;
  booksFinished: number;
  wordsLearned: number;
  weeklyGoalMinutes: number;
  weeklyMinutesListened: number;
  weeklyGoalStories: number;
  weeklyStoriesFinished: number;
  monthlyStoriesFinished: number;
  storyStreakDays: number;
  regionsExplored: number;
  practiceSessionsCompleted: number;
  weeklyPracticeSessions: number;
  weeklyGoalPracticeSessions: number;
  practiceAccuracy: number;
  practiceStreakDays: number;
  streakDays: number;
  gamification: GamificationSummary;
};

type RemoteLibraryBook = {
  id: string;
  bookId: string;
  title: string;
  coverUrl: string;
};

type RemoteLibraryStory = {
  id: string;
  storyId: string;
  title: string;
  coverUrl: string;
  bookId: string;
  storySlug?: string;
  language?: string;
  region?: string;
  level?: string;
  topic?: string;
  audioUrl?: string | null;
};

type MobileCreatedStory = {
  id: string;
  slug: string;
  title: string;
  text: string;
  vocab?: VocabItem[];
  language?: string;
  variant?: string | null;
  region?: string | null;
  level?: string;
  cefrLevel?: string;
  topic?: string;
  audioStatus?: string | null;
  audioUrl?: string | null;
  coverUrl?: string | null;
};

type CreateStatus =
  | "idle"
  | "generating_text"
  | "generating_audio"
  | "ready"
  | "audio_failed"
  | "error";

type MobileStandaloneStory = {
  id: string;
  slug: string;
  title: string;
  text: string;
  language?: string | null;
  variant?: string | null;
  region?: string | null;
  level?: string | null;
  cefrLevel?: string | null;
  topic?: string | null;
  coverUrl?: string | null;
  audioUrl?: string | null;
};

type MobileJourneyTopicSummary = {
  id: string;
  slug: string;
  label: string;
  unlocked: boolean;
  complete: boolean;
  practiced: boolean;
  checkpointPassed: boolean;
  storyCount: number;
  storyTarget: number | null;
  completedStoryCount: number;
  requiredStoryCount: number;
  dueReviewCount: number;
  hasDueReview: boolean;
  unlockedStoryCount: number;
  stories: Array<{
    id: string;
    storySlug: string;
    title: string;
    coverUrl: string | null;
    progressKey: string;
    language: string | null;
    region: string | null;
    unlocked: boolean;
    completed: boolean;
  }>;
};

type MobileJourneyLevelSummary = {
  id: string;
  title: string;
  subtitle: string;
  unlocked: boolean;
  unlockedTopicCount: number;
  totalTopicCount: number;
  topics: MobileJourneyTopicSummary[];
};

type MobileJourneyTrackInsights = {
  score: number;
  completedSteps: number;
  totalSteps: number;
  completedRequiredStories: number;
  totalRequiredStories: number;
  practicedTopicCount: number;
  totalTopicCount: number;
  passedCheckpointCount: number;
  totalCheckpointCount: number;
  dueReviewCount: number;
  dueTopicCount: number;
  reviewTopics: Array<{
    levelId: string;
    levelTitle: string;
    topicSlug: string;
    topicLabel: string;
    dueCount: number;
    complete: boolean;
    practiced: boolean;
    checkpointPassed: boolean;
  }>;
  currentLevelId: string | null;
  currentLevelTitle: string | null;
  nextMilestone: string;
};

type MobileJourneyTrackSummary = {
  id: string;
  label: string;
  insights: MobileJourneyTrackInsights;
  unlockedLevelCount: number;
  totalLevelCount: number;
  levels: MobileJourneyLevelSummary[];
};

type MobileJourneyPayload = {
  language: string;
  dueReviewCount: number;
  tracks: MobileJourneyTrackSummary[];
};

type JourneyMilestone = {
  title: string;
  body: string;
  cta: string;
  onPress: () => void;
};

type BookDetailTab = "stories" | "vocab" | "reviews" | "about";
type BookStorySortKey = "recommended" | "shortest" | "longest" | "title";
type BookStoryPickerSection = "topic" | "sort";

type ExploreSuggestion =
  | {
      kind: "book";
      id: string;
      title: string;
      subtitle: string;
      coverUrl: string;
      onPress: () => void;
    }
  | {
      kind: "bookStory";
      id: string;
      title: string;
      subtitle: string;
      coverUrl: string;
      onPress: () => void;
    }
  | {
      kind: "standaloneStory";
      id: string;
      title: string;
      subtitle: string;
      coverUrl: string;
      onPress: () => void;
    };

type ProgressStat = {
  label: string;
  value: string;
  icon: React.ComponentProps<typeof Feather>["name"];
};

type PracticeModeKey = "meaning" | "context" | "listening" | "match";

type PracticeModeCard = {
  key: PracticeModeKey;
  title: string;
  eyebrow: string;
  detail: string;
  caption: string;
  accent: string;
  background: string;
  icon: React.ComponentProps<typeof Feather>["name"] | "brain" | "headphones";
};

type PracticeMultipleChoiceExercise = {
  id: string;
  mode: Exclude<PracticeModeKey, "match">;
  kind: "multiple-choice";
  prompt: string;
  helper: string;
  sentence: string | null;
  options: string[];
  answer: string;
  audioClip?: PracticeAudioClip | null;
  favorite: Pick<
    PracticeFavoriteItem,
    "word" | "translation" | "wordType" | "exampleSentence" | "language" | "storySlug" | "storyTitle" | "sourcePath"
  >;
  speechText?: string;
  language?: string | null;
};

type PracticeMatchExercise = {
  id: string;
  mode: "match";
  kind: "match";
  prompt: string;
  helper: string;
  pairs: Array<{
    word: string;
    answer: string;
  }>;
};

type PracticeExercise = PracticeMultipleChoiceExercise | PracticeMatchExercise;
type ReviewScore = "again" | "good";
type StoryAudioData = {
  audioUrl: string | null;
  audioSegments: AudioSegment[];
};
type PracticeLaunchContext =
  | { source: "favorites"; kind?: "due" | "all" | "related" }
  | {
      source: "story";
      storySlug: string;
      bookSlug?: string | null;
      storyTitle?: string | null;
    }
  | {
      source: "journey";
      variantId?: string | null;
      levelId: string;
      topicId: string;
      topicLabel?: string | null;
      kind?: "topic" | "checkpoint";
      reviewFocus?: boolean;
      reviewDueCount?: number;
      focusWords?: string[];
    };

type JourneyReviewMeta = {
  dueCount: number;
  totalCount: number;
  focusWords?: string[];
};

const PRACTICE_MODE_CARDS: PracticeModeCard[] = [
  {
    key: "meaning",
    title: "Meaning",
    eyebrow: "Word quest",
    detail: "Choose the meaning that fits a word in context.",
    caption: "Best for locking in definitions with real usage.",
    accent: "#f8d48a",
    background: "#4b4f32",
    icon: "zap",
  },
  {
    key: "context",
    title: "Context",
    eyebrow: "Sentence run",
    detail: "Complete real phrases and choose what sounds natural in context.",
    caption: "Best for recall, sentence flow, and natural usage.",
    accent: "#9ce5c1",
    background: "#234c42",
    icon: "message-circle",
  },
  {
    key: "listening",
    title: "Listening",
    eyebrow: "Sound check",
    detail: "Hear a word and choose what was said.",
    caption: "Best for audio recognition and fast review.",
    accent: "#f0a8d7",
    background: "#5a3c67",
    icon: "headphones",
  },
  {
    key: "match",
    title: "Match",
    eyebrow: "Rapid pairs",
    detail: "Connect words and meanings in a timed matching round.",
    caption: "Best for repetition and confidence under pressure.",
    accent: "#8fd8ff",
    background: "#22495f",
    icon: "brain",
  },
];

const MIN_RELATED_PRACTICE_ITEMS = 3;
const RELATED_PRACTICE_MAX = 20;
const RELATED_DEFINITION_STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "be",
  "by",
  "de",
  "del",
  "der",
  "die",
  "el",
  "en",
  "for",
  "from",
  "in",
  "la",
  "las",
  "los",
  "mit",
  "of",
  "on",
  "or",
  "the",
  "to",
  "un",
  "una",
  "und",
  "with",
]);

const LANGUAGE_OPTIONS = [
  "English",
  "Spanish",
  "French",
  "German",
  "Italian",
  "Portuguese",
  "Japanese",
  "Korean",
  "Chinese",
] as const;

const LEVEL_OPTIONS = ["Beginner", "Intermediate", "Advanced"] as const;

const REGION_OPTIONS = [
  "Colombia",
  "Mexico",
  "Argentina",
  "Peru",
  "Germany",
  "France",
  "Brazil",
  "Portugal",
  "Italy",
  "Spain",
] as const;

const REGION_OPTIONS_BY_LANGUAGE: Partial<Record<(typeof LANGUAGE_OPTIONS)[number], readonly string[]>> = {
  Spanish: ["Colombia", "Mexico", "Argentina", "Peru", "Spain"],
  German: ["Germany"],
  French: ["France"],
  Portuguese: ["Brazil", "Portugal"],
  Italian: ["Italy"],
};
const CLIP_START_PADDING_SEC = 0.08;
const CLIP_END_TRIM_SEC = 0.5;
const CHECKPOINT_PASS_THRESHOLD = 0.8;

const SUGGESTED_INTERESTS = [
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

function getRegionOptionsForLanguage(language: string): readonly string[] {
  return REGION_OPTIONS_BY_LANGUAGE[language as (typeof LANGUAGE_OPTIONS)[number]] ?? REGION_OPTIONS;
}

function normalizePracticeWord(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isExpressionLikeFavorite(item: Pick<PracticeFavoriteItem, "word" | "wordType">): boolean {
  const word = typeof item.word === "string" ? item.word.trim() : "";
  const wordType = typeof item.wordType === "string" ? item.wordType.toLowerCase() : "";
  return word.includes(" ") || /expression|phrase|idiom|chunk|connector/.test(wordType);
}

function computeNextReview(score: ReviewScore, streak: number): { nextReviewAt: number; streak: number } {
  const now = Date.now();
  if (score === "again") {
    return { nextReviewAt: now + 10 * 60 * 1000, streak: 0 };
  }

  const nextStreak = streak + 1;
  const days = nextStreak >= 4 ? 14 : nextStreak >= 2 ? 7 : 3;
  return { nextReviewAt: now + days * 24 * 60 * 60 * 1000, streak: nextStreak };
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
  const exactById = segmentId
    ? storyAudio.audioSegments.find((segment) => segment.id === segmentId) ?? null
    : null;

  if (exactById) return exactById;

  return findBestAudioSegment(storyAudio.audioSegments, clip.sentence, {
    targetWord: clip.targetWord,
    mode: "strict",
  });
}

function toClipPlaybackLoadedSnapshot(status: AVPlaybackStatus) {
  if (!status.isLoaded) return null;
  return {
    positionMillis: status.positionMillis ?? 0,
    durationMillis: status.durationMillis ?? 0,
  };
}

function buildPracticeFavorites(items: MobileFavoriteItem[]): PracticeFavoriteItem[] {
  return items
    .filter((item) => item.word.trim() && item.translation.trim())
    .map((item) => ({
      word: item.word.trim(),
      translation: item.translation.trim(),
      wordType: item.wordType ?? null,
      exampleSentence: item.exampleSentence ?? null,
      storySlug: item.storySlug ?? null,
      storyTitle: item.storyTitle ?? null,
      sourcePath: item.sourcePath ?? null,
      language: item.language ?? null,
      nextReviewAt: item.nextReviewAt ?? null,
      practiceSource: "user_saved" as const,
    }));
}

function mapSharedExerciseToMobile(exercise: ReturnType<typeof buildPracticeSession>[number]): PracticeExercise {
  switch (exercise.type) {
    case "meaning_in_context":
      return {
        id: exercise.id,
        mode: "meaning",
        kind: "multiple-choice",
        prompt: exercise.prompt,
        helper: "Choose the meaning that fits this word.",
        sentence: exercise.sentence,
        options: exercise.options,
        answer: exercise.answer,
        audioClip: exercise.audioClip ?? null,
        favorite: {
          word: exercise.word,
          translation: exercise.answer,
          wordType: null,
          exampleSentence: exercise.sentence,
          language: null,
          storySlug: exercise.storySlug ?? null,
          storyTitle: null,
          sourcePath: null,
        },
      };
    case "fill_blank":
      return {
        id: exercise.id,
        mode: "context",
        kind: "multiple-choice",
        prompt: exercise.prompt,
        helper: "Complete the sentence with the right word or expression.",
        sentence: exercise.sentence,
        options: exercise.options,
        answer: exercise.answer,
        audioClip: exercise.audioClip ?? null,
        favorite: {
          word: exercise.answer,
          translation: "",
          wordType: null,
          exampleSentence: exercise.sentence,
          language: null,
          storySlug: exercise.storySlug ?? null,
          storyTitle: null,
          sourcePath: null,
        },
      };
    case "natural_expression":
      return {
        id: exercise.id,
        mode: "context",
        kind: "multiple-choice",
        prompt: exercise.prompt,
        helper: "Choose the expression that sounds natural here.",
        sentence: exercise.sentence,
        options: exercise.options,
        answer: exercise.answer,
        audioClip: exercise.audioClip ?? null,
        favorite: {
          word: exercise.answer,
          translation: "",
          wordType: null,
          exampleSentence: exercise.sentence,
          language: null,
          storySlug: exercise.storySlug ?? null,
          storyTitle: null,
          sourcePath: null,
        },
      };
    case "listen_choose":
      return {
        id: exercise.id,
        mode: "listening",
        kind: "multiple-choice",
        prompt: exercise.prompt,
        helper: "Press play, then choose the word you hear.",
        sentence: null,
        options: exercise.options,
        answer: exercise.answer,
        speechText: exercise.speechText,
        language: exercise.language ?? null,
        favorite: {
          word: exercise.speechText,
          translation: "",
          wordType: null,
          exampleSentence: null,
          language: exercise.language ?? null,
          storySlug: null,
          storyTitle: null,
          sourcePath: null,
        },
      };
    case "match_meaning":
      return {
        id: exercise.id,
        mode: "match",
        kind: "match",
        prompt: exercise.prompt,
        helper: "Tap a word, then choose its meaning.",
        pairs: exercise.pairs.map((pair) => ({
          word: pair.word,
          answer: pair.answer,
        })),
      };
  }
}

function buildPracticeExercises(
  favorites: MobileFavoriteItem[],
  mode: PracticeModeKey,
  review = false
): PracticeExercise[] {
  return buildPracticeExercisesFromItems(buildPracticeFavorites(favorites), mode, review);
}

function buildPracticeExercisesFromItems(
  source: PracticeFavoriteItem[],
  mode: PracticeModeKey,
  review = false,
  prefs?: { interests: readonly string[]; learningGoal: OnboardingGoal | null; dailyMinutes: number | null }
): PracticeExercise[] {
  if (source.length === 0) return [];

  const dueItems = getDuePracticeItems(source);
  const prioritizedBase = review && dueItems.length > 0 ? dueItems : source;
  const prioritySeed = prefs ? sortPracticeItemsByOnboarding(prioritizedBase, prefs, review) : prioritizedBase;
  const prioritized = [...prioritySeed].sort((a, b) => {
    const aDue = a.nextReviewAt ? Date.parse(a.nextReviewAt) : Number.NaN;
    const bDue = b.nextReviewAt ? Date.parse(b.nextReviewAt) : Number.NaN;
    if (Number.isFinite(aDue) && Number.isFinite(bDue) && aDue !== bDue) return aDue - bDue;
    if (Number.isFinite(aDue)) return -1;
    if (Number.isFinite(bDue)) return 1;
    return a.word.localeCompare(b.word);
  });

  const sharedExercises =
    mode === "context"
      ? buildMixedPracticeSession(prioritized, ["context", "natural"], 10, prefs)
      : buildPracticeSession(prioritized, mode, prefs);

  return sharedExercises.map(mapSharedExerciseToMobile);
}

function getRecommendedPracticeModeFromItems(source: PracticeFavoriteItem[]): PracticeModeKey {
  const dueItems = getDuePracticeItems(source);
  if (dueItems.length === 0) {
    if (source.some((item) => item.exampleSentence?.trim())) return "context";
    if (source.length >= 6) return "match";
    return "meaning";
  }

  const counts: Record<PracticeModeKey, number> = {
    meaning: 0,
    context: 0,
    listening: 0,
    match: 0,
  };

  for (const item of dueItems) {
    counts.meaning += 1;
    if (item.exampleSentence?.trim()) counts.context += 2;
    if (item.storySlug || item.language) counts.listening += 1;
    if (isExpressionLikeFavorite(item)) counts.context += 1;
  }

  if (dueItems.length >= 6) {
    counts.match += 2;
  }

  return (Object.entries(counts) as Array<[PracticeModeKey, number]>)
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? "meaning";
}

function getPracticeModeLabel(mode: PracticeModeKey): string {
  return PRACTICE_MODE_CARDS.find((card) => card.key === mode)?.title ?? "Practice";
}

function findCatalogStory(storyId: string, catalogBooks: Book[]): ReaderSelection | null {
  for (const book of catalogBooks) {
    const story = book.stories.find((candidate) => candidate.id === storyId);
    if (story) {
      return {
        book,
        story,
        resolvedAudioUrl: story.audio,
      };
    }
  }

  return null;
}

function resolveStorySelection(storyId: string, fallbackBook?: Book, fallbackStory?: Story): ReaderSelection | null {
  const fullSelection = findCatalogStory(storyId, CATALOG_BOOKS);
  if (fullSelection) {
    return fullSelection;
  }

  if (fallbackBook && fallbackStory) {
    return {
      book: fallbackBook,
      story: fallbackStory,
      resolvedAudioUrl: fallbackStory.audio,
    };
  }

  return findCatalogStory(storyId, mobileCatalog);
}

function resolveStorySelectionBySlugs(bookSlug: string, storySlug: string): ReaderSelection | null {
  const catalogs = [CATALOG_BOOKS, mobileCatalog];
  for (const catalog of catalogs) {
    for (const book of catalog) {
      if (book.slug !== bookSlug) continue;
      const story = book.stories.find((candidate) => candidate.slug === storySlug);
      if (!story) continue;
      return {
        book,
        story,
        resolvedAudioUrl: story.audio,
      };
    }
  }

  return null;
}

function getCoverUrl(input?: string | null, width = 400): string {
  if (typeof input !== "string" || !input.trim()) {
    return "https://reader.digitalpolyglot.com/covers/default.jpg";
  }
  if (input.includes("cdn.sanity.io/images/")) {
    const sep = input.includes("?") ? "&" : "?";
    return `${input}${sep}w=${width}&q=75&auto=format&fit=max`;
  }
  return input;
}

function normalizeFavoriteWord(word: string): string {
  return word.trim().toLowerCase();
}

function getFavoriteType(item: MobileFavoriteItem): string {
  return item.wordType?.trim().toLowerCase() || "other";
}

function getFavoriteTypeLabel(type: string): string {
  if (type === "all") return "All types";
  if (type === "noun") return "Noun";
  if (type === "verb") return "Verb";
  if (type === "phrase") return "Phrase";
  if (type === "adjective") return "Adjective";
  if (type === "adverb") return "Adverb";
  if (type === "expression") return "Expression";
  if (type === "other") return "Other";
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function buildFavoriteIdentity(item: MobileFavoriteItem): string {
  return `${normalizeFavoriteWord(item.word)}::${item.storySlug ?? ""}`;
}

function normalizeTokenValue(value?: string | null): string | null {
  if (!value) return null;
  const clean = value.trim().toLowerCase();
  return clean.length > 0 ? clean : null;
}

function getDefinitionTokens(value?: string | null): string[] {
  if (!value) return [];
  return value
    .toLowerCase()
    .split(/[^a-záéíóúüñäöß]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4 && !RELATED_DEFINITION_STOPWORDS.has(token));
}

function getWordStem(value: string): string {
  const normalized = normalizeFavoriteWord(value).replace(/[^a-záéíóúüñäöß]+/gi, "");
  return normalized.slice(0, 5);
}

function createRelatedFavoriteIdentity(item: Pick<MobileFavoriteItem, "word" | "language">): string {
  return `${normalizeFavoriteWord(item.word)}::${normalizeTokenValue(item.language) ?? ""}`;
}

function getPlan(plan?: string | null): Plan {
  if (plan === "basic" || plan === "premium" || plan === "polyglot") return plan;
  return "free";
}

function toDomainLevel(level?: string | null): Level {
  if (typeof level !== "string") return "intermediate";
  const normalized = level.trim().toLowerCase();
  if (normalized === "beginner" || normalized === "advanced") return normalized;
  return "intermediate";
}

function defaultCefrForLevel(level?: string | null): string {
  const normalized = typeof level === "string" ? level.trim().toLowerCase() : "";
  if (normalized === "beginner") return "A2";
  if (normalized === "advanced") return "C1";
  return "B1";
}

const CREATE_PENDING_TTL_MS = 1000 * 60 * 60 * 6;
const CREATE_AUDIO_REFRESH_INTERVAL_MS = 5000;
const CREATE_AUDIO_COME_BACK_LATER_MS = 12000;

function isCreateAudioReady(story?: Pick<MobileCreatedStory, "audioStatus" | "audioUrl"> | null) {
  if (!story) return false;
  return !!story.audioUrl || story.audioStatus === "ready";
}

function createSelectionFromGeneratedStory(story: MobileCreatedStory): ReaderSelection {
  const language = story.language?.trim() || "Spanish";
  const region = story.region?.trim() || undefined;
  const level = toDomainLevel(story.level);
  const cefrLevel = typeof story.cefrLevel === "string" ? story.cefrLevel.toLowerCase() : undefined;
  const cover = story.coverUrl || undefined;
  const mobileBook: Book = {
    id: `generated-book-${story.id}`,
    slug: `generated-book-${story.slug}`,
    title: "Created on iPhone",
    description: "A story you generated from the iPhone create flow.",
    language,
    region,
    level,
    cefrLevel: cefrLevel as Book["cefrLevel"],
    topic: story.topic || "Daily life",
    audioFolder: "generated",
    cover,
    stories: [],
  };
  const mobileStory: Story = {
    id: story.id,
    slug: story.slug,
    title: story.title,
    text: story.text,
    audio: story.audioUrl || "",
    vocab: story.vocab ?? [],
    language,
    region,
    level,
    cefrLevel: cefrLevel as Story["cefrLevel"],
    topic: story.topic || "Daily life",
    cover,
    coverUrl: cover,
    book: mobileBook,
    overrideMetadata: true,
  };
  mobileBook.stories = [mobileStory];

  return {
    book: mobileBook,
    story: mobileStory,
    resolvedAudioUrl: story.audioUrl ?? null,
  };
}

function createSelectionFromStandaloneStory(story: MobileStandaloneStory): ReaderSelection {
  const language = story.language?.trim() || "Spanish";
  const region = story.region?.trim() || undefined;
  const level = toDomainLevel(story.level);
  const cefrLevel = typeof story.cefrLevel === "string" ? story.cefrLevel.toLowerCase() : undefined;
  const cover = story.coverUrl || undefined;
  const mobileBook: Book = {
    id: "standalone-book",
    slug: "standalone-stories",
    title: "Individual stories",
    description: "Standalone stories available outside the book catalog.",
    language,
    region,
    variant: story.variant?.trim() || undefined,
    level,
    cefrLevel: cefrLevel as Book["cefrLevel"],
    topic: story.topic || "Daily life",
    audioFolder: "standalone",
    cover,
    stories: [],
  };
  const mobileStory: Story = {
    id: story.id,
    slug: story.slug,
    title: story.title,
    text: story.text,
    audio: story.audioUrl || "",
    vocab: [],
    language,
    region,
    variant: story.variant?.trim() || undefined,
    level,
    cefrLevel: cefrLevel as Story["cefrLevel"],
    topic: story.topic || "Daily life",
    cover,
    coverUrl: cover,
    book: mobileBook,
    overrideMetadata: true,
  };
  mobileBook.stories = [mobileStory];

  return {
    book: mobileBook,
    story: mobileStory,
    resolvedAudioUrl: story.audioUrl ?? null,
  };
}

function formatStreakLabel(days: number): string {
  if (days <= 1) return "1-day streak";
  return `${days}-day streak`;
}

function normalizeLanguageSelection(items: string[]): string[] {
  const allowed = new Set(LANGUAGE_OPTIONS);
  return Array.from(new Set(items.filter((item): item is (typeof LANGUAGE_OPTIONS)[number] => allowed.has(item as never))));
}

function normalizeInterestSelection(items: string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const raw of items) {
    const cleaned = raw.trim().replace(/\s+/g, " ");
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(cleaned);
    if (next.length >= 12) break;
  }
  return next;
}

function normalizeLearningGoal(value: unknown): OnboardingGoal | null {
  if (typeof value !== "string") return null;
  const match = ONBOARDING_GOAL_OPTIONS.find((option) => option.toLowerCase() === value.trim().toLowerCase());
  return match ?? null;
}

function normalizeJourneyFocusPreference(value: unknown): JourneyFocus | null {
  return normalizeJourneyFocus(value);
}

function normalizeDailyMinutes(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return ONBOARDING_DAILY_MINUTES_OPTIONS.includes(value as never) ? value : null;
}

function normalizeExploreSearch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function scoreExploreMatch(haystack: string, tokens: string[]): number {
  let score = 0;

  for (const token of tokens) {
    const index = haystack.indexOf(token);
    if (index === -1) return 0;
    score += 50;
    score += Math.max(0, 30 - index);
    score += Math.min(20, token.length * 2);
  }

  return score;
}

function formatReadingProgressLabel(progress?: ReadingProgress | null): string | undefined {
  if (!progress) return undefined;

  const ratio =
    typeof progress.progressRatio === "number" && Number.isFinite(progress.progressRatio)
      ? Math.min(1, Math.max(0, progress.progressRatio))
      : null;
  const currentBlock =
    typeof progress.currentBlockIndex === "number" && Number.isFinite(progress.currentBlockIndex)
      ? Math.max(0, progress.currentBlockIndex) + 1
      : null;
  const totalBlocks =
    typeof progress.totalBlocks === "number" && Number.isFinite(progress.totalBlocks) && progress.totalBlocks > 0
      ? progress.totalBlocks
      : null;

  if (ratio !== null && ratio >= 0.98) {
    return "Almost finished";
  }

  if (ratio !== null && totalBlocks) {
    const percent = Math.max(1, Math.round(ratio * 100));
    if (percent <= 5) {
      return "Just getting started";
    }
    if (percent <= 35) {
      return `${percent}% through this story`;
    }
    if (percent <= 75) {
      return `Keep going · ${percent}% done`;
    }
    return `Almost there · ${percent}% done`;
  }

  if (ratio !== null) {
    const percent = Math.max(1, Math.round(ratio * 100));
    return percent <= 5 ? "Just getting started" : `${percent}% through this story`;
  }

  if (currentBlock !== null && totalBlocks) {
    return currentBlock <= 1 ? "Just getting started" : "Pick up where you left off";
  }

  return undefined;
}

function preferencesEqual(a: MobilePreferences, b: MobilePreferences): boolean {
  if (a.preferredLevel !== b.preferredLevel) return false;
  if (a.preferredRegion !== b.preferredRegion) return false;
  if (a.preferredVariant !== b.preferredVariant) return false;
  if (a.learningGoal !== b.learningGoal) return false;
  if (a.journeyFocus !== b.journeyFocus) return false;
  if (a.dailyMinutes !== b.dailyMinutes) return false;
  if (a.remindersEnabled !== b.remindersEnabled) return false;
  if (a.reminderHour !== b.reminderHour) return false;
  if (a.journeyPlacementLevel !== b.journeyPlacementLevel) return false;
  if (a.targetLanguages.length !== b.targetLanguages.length) return false;
  if (a.interests.length !== b.interests.length) return false;
  const langSet = new Set(a.targetLanguages);
  const interestSet = new Set(a.interests.map((item) => item.toLowerCase()));
  return (
    b.targetLanguages.every((item) => langSet.has(item)) &&
    b.interests.every((item) => interestSet.has(item.toLowerCase()))
  );
}

export function MobileLibraryShell(args: {
  sessionToken?: string | null;
  sessionUserId?: string | null;
  sessionName?: string | null;
  sessionEmail?: string | null;
  sessionPlan?: string | null;
  sessionTargetLanguages?: string[];
  sessionBooksCount?: number;
  sessionStoriesCount?: number;
  pushState?: PushRegistrationState;
  pendingReminderNavigation?: { key: string; target: ReminderDestination } | null;
  onHandledReminderNavigation?: () => void;
  onSignOut?: () => void;
  onRequestSignIn?: () => void;
}) {
  const {
    sessionToken,
    sessionUserId,
    sessionName,
    sessionEmail,
    sessionPlan,
    sessionTargetLanguages,
    sessionBooksCount,
    sessionStoriesCount,
    pushState,
    pendingReminderNavigation,
    onHandledReminderNavigation,
    onSignOut,
    onRequestSignIn,
  } = args;
  const isSignedIn = Boolean(sessionToken);
  const shellScrollRef = useRef<ScrollView | null>(null);
  const [activeScreen, setActiveScreen] = useState<MobileScreen>("home");
  const [menuOpen, setMenuOpen] = useState(false);
  const [exploreQuery, setExploreQuery] = useState("");
  const [isExploreSearchFocused, setIsExploreSearchFocused] = useState(false);
  const [homeFeedMode, setHomeFeedMode] = useState<HomeFeedMode>("stories");
  const [explorePickerSection, setExplorePickerSection] = useState<ExploreSection | null>(null);
  const [expandedExploreSection, setExpandedExploreSection] = useState<"stories" | "books" | "standalone" | null>(null);
  const [selectedExploreLanguage, setSelectedExploreLanguage] = useState<string>("All");
  const [selectedExploreRegion, setSelectedExploreRegion] = useState<string>("All");
  const [selectedExploreTopic, setSelectedExploreTopic] = useState<string>("All");
  const [selection, setSelection] = useState<ReaderSelection | null>(null);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [selectedBookTab, setSelectedBookTab] = useState<BookDetailTab>("stories");
  const [selectedBookStoryQuery, setSelectedBookStoryQuery] = useState("");
  const [selectedBookStoryTopicFilter, setSelectedBookStoryTopicFilter] = useState("all");
  const [selectedBookStorySortKey, setSelectedBookStorySortKey] = useState<BookStorySortKey>("recommended");
  const [selectedBookStoryPickerSection, setSelectedBookStoryPickerSection] = useState<BookStoryPickerSection | null>(null);
  const [selectedBookDescriptionExpanded, setSelectedBookDescriptionExpanded] = useState(false);
  const bookDetailScrollRef = useRef<ScrollView | null>(null);
  const exploreSearchBlurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activePracticeMode, setActivePracticeMode] = useState<PracticeModeKey | null>(null);
  const [lastPracticeActivityAt, setLastPracticeActivityAt] = useState<string | null>(null);
  const [practiceExercises, setPracticeExercises] = useState<PracticeExercise[]>([]);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [practiceScore, setPracticeScore] = useState(0);
  const [practiceSelectedOption, setPracticeSelectedOption] = useState<string | null>(null);
  const [practiceRevealed, setPracticeRevealed] = useState(false);
  const [practiceComplete, setPracticeComplete] = useState(false);
  const [speakingPracticePromptId, setSpeakingPracticePromptId] = useState<string | null>(null);
  const [playingPracticeClipId, setPlayingPracticeClipId] = useState<string | null>(null);
  const [practiceLastResult, setPracticeLastResult] = useState<"correct" | "wrong" | null>(null);
  const [practiceSessionStreak, setPracticeSessionStreak] = useState(0);
  const [activeMatchWord, setActiveMatchWord] = useState<string | null>(null);
  const [matchedWords, setMatchedWords] = useState<string[]>([]);
  const [practiceLaunchContext, setPracticeLaunchContext] = useState<PracticeLaunchContext>({
    source: "favorites",
  });
  const [practiceSeedItems, setPracticeSeedItems] = useState<PracticeFavoriteItem[] | null>(null);
  const [practiceLoadError, setPracticeLoadError] = useState<string | null>(null);
  const [practiceReturnSelection, setPracticeReturnSelection] = useState<ReaderSelection | null>(null);
  const [practiceReviewScores, setPracticeReviewScores] = useState<Record<string, ReviewScore>>({});
  const [practiceCheckpointToken, setPracticeCheckpointToken] = useState<string | null>(null);
  const [practiceCheckpointResponses, setPracticeCheckpointResponses] = useState<Record<string, string>>({});
  const [practiceCheckpointSaveState, setPracticeCheckpointSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [practiceJourneyReviewMeta, setPracticeJourneyReviewMeta] = useState<JourneyReviewMeta | null>(null);
  const [favoritePracticeModeKind, setFavoritePracticeModeKind] = useState<"due" | "all" | "related">("due");
  const [selectedFavoriteType, setSelectedFavoriteType] = useState<string>("all");
  const [savedBookIds, setSavedBookIds] = useState<string[]>(() =>
    CATALOG_BOOKS.map((book) => book.id).slice(0, 2)
  );
  const [savedStoryIds, setSavedStoryIds] = useState<string[]>(() =>
    CATALOG_BOOKS.flatMap((book) => book.stories.slice(0, 1).map((story) => story.id))
  );
  const [readingProgress, setReadingProgress] = useState<ReadingProgress[]>([]);
  const [favoriteWords, setFavoriteWords] = useState<MobileFavoriteItem[]>([]);
  const [didHydrateState, setDidHydrateState] = useState(false);
  const [offlineSnapshot, setOfflineSnapshot] = useState<OfflineLibrarySnapshot | null>(null);
  const [offlineStoryIdInFlight, setOfflineStoryIdInFlight] = useState<string | null>(null);
  const [remoteBooks, setRemoteBooks] = useState<RemoteLibraryBook[]>([]);
  const [remoteStories, setRemoteStories] = useState<RemoteLibraryStory[]>([]);
  const [remoteContinueListening, setRemoteContinueListening] = useState<RemoteContinueListeningItem[]>([]);
  const [remoteEntitlement, setRemoteEntitlement] = useState<MobileBillingEntitlement | null>(
    sessionPlan
      ? {
          hasEntitlement: true,
          plan: sessionPlan,
          source: "mobile_token",
          status: "active",
          targetLanguages: sessionTargetLanguages ?? [],
        }
      : null
  );
  const [preferences, setPreferences] = useState<MobilePreferences>({
    targetLanguages: normalizeLanguageSelection(sessionTargetLanguages ?? []),
    interests: [],
    preferredLevel: null,
    preferredRegion: null,
    preferredVariant: null,
    learningGoal: null,
    journeyFocus: null,
    dailyMinutes: null,
    remindersEnabled: false,
    reminderHour: null,
    journeyPlacementLevel: null,
    onboardingSurveyCompletedAt: null,
    onboardingTourCompletedAt: null,
  });
  const [savedPreferences, setSavedPreferences] = useState<MobilePreferences>({
    targetLanguages: normalizeLanguageSelection(sessionTargetLanguages ?? []),
    interests: [],
    preferredLevel: null,
    preferredRegion: null,
    preferredVariant: null,
    learningGoal: null,
    journeyFocus: null,
    dailyMinutes: null,
    remindersEnabled: false,
    reminderHour: null,
    journeyPlacementLevel: null,
    onboardingSurveyCompletedAt: null,
    onboardingTourCompletedAt: null,
  });
  const [preferencesStatus, setPreferencesStatus] = useState<SaveStatus>("idle");
  const [preferencesLoading, setPreferencesLoading] = useState(false);
  const [didHydratePreferences, setDidHydratePreferences] = useState(false);
  const [preferencesHint, setPreferencesHint] = useState<string | null>(null);
  const [reminderHint, setReminderHint] = useState<string | null>(null);
  const [customInterestInput, setCustomInterestInput] = useState("");
  const [loadingRemote, setLoadingRemote] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [remoteProgress, setRemoteProgress] = useState<MobileProgressPayload | null>(null);
  const [activeGamificationCelebration, setActiveGamificationCelebration] = useState<GamificationCelebration | null>(null);
  const [dismissedCelebrationIds, setDismissedCelebrationIds] = useState<Set<string>>(new Set());
  const celebrationAnim = useRef(new Animated.Value(0)).current;
  const journeyMilestoneAnim = useRef(new Animated.Value(0)).current;
  const journeyMilestoneSoundRef = useRef<Audio.Sound | null>(null);
  const [remoteBooksLoading, setRemoteBooksLoading] = useState(false);
  const [remoteStoriesLoading, setRemoteStoriesLoading] = useState(false);
  const [remoteEntitlementLoading, setRemoteEntitlementLoading] = useState(false);
  const [remoteProgressLoading, setRemoteProgressLoading] = useState(false);
  const [remoteJourney, setRemoteJourney] = useState<MobileJourneyPayload | null>(null);
  const [userStoryAudioBySlug, setUserStoryAudioBySlug] = useState<Record<string, StoryAudioData>>({});
  const [standaloneStoryAudioBySlug, setStandaloneStoryAudioBySlug] = useState<Record<string, StoryAudioData>>({});
  const [selectedJourneyTrackId, setSelectedJourneyTrackId] = useState<string | null>(null);
  const [selectedJourneyLevelId, setSelectedJourneyLevelId] = useState<string | null>(null);
  const [selectedJourneyTopicId, setSelectedJourneyTopicId] = useState<string | null>(null);
  const [journeyDetailTopicId, setJourneyDetailTopicId] = useState<string | null>(null);
  const [journeyMilestone, setJourneyMilestone] = useState<JourneyMilestone | null>(null);
  const [activeJourneyLanguage, setActiveJourneyLanguage] = useState<string | null>(null);
  const [journeyLanguageLoading, setJourneyLanguageLoading] = useState(false);
  const [journeyVariantPickerOpen, setJourneyVariantPickerOpen] = useState(false);
  const [journeyInsightsByLanguage, setJourneyInsightsByLanguage] = useState<Record<string, LanguageInsightsSummary | null>>({});
  const effectivePlan = getPlan(remoteEntitlement?.plan ?? sessionPlan);
  const canDownloadOffline = effectivePlan === "premium" || effectivePlan === "polyglot";
  const [createPickerSection, setCreatePickerSection] = useState<CreateSection | null>(null);
  const [settingsPickerSection, setSettingsPickerSection] = useState<SettingsSection | null>(null);
  const [createStatus, setCreateStatus] = useState<CreateStatus>("idle");
  const [createdStory, setCreatedStory] = useState<MobileCreatedStory | null>(null);
  const [createdStoryHistory, setCreatedStoryHistory] = useState<MobileCreatedStory[]>([]);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createResumeNotice, setCreateResumeNotice] = useState<string | null>(null);
  const [createResumeChecked, setCreateResumeChecked] = useState(false);
  const [showCreateComeBackLater, setShowCreateComeBackLater] = useState(false);
  const [onboardingSurveyStep, setOnboardingSurveyStep] = useState(0);
  const [onboardingTourStep, setOnboardingTourStep] = useState<number | null>(null);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);
  const practiceStartTrackedRef = useRef(false);
  const practiceCompletionTrackedRef = useRef(false);
  const practiceClipSoundRef = useRef<Audio.Sound | null>(null);
  const practiceClipStopAtMillisRef = useRef<number | null>(null);
  const practiceFeedbackSoundRef = useRef<Audio.Sound | null>(null);
  const storyCompletionShownRef = useRef(new Set<string>());
  const [storyCompletionPopup, setStoryCompletionPopup] = useState(false);
  const hasSeededExplorePreferencesRef = useRef(false);
  const practiceSpeechAvailable = getOptionalSpeechModule() !== null;

  const effectiveTargetLanguages = preferences.targetLanguages.length > 0
    ? preferences.targetLanguages
    : normalizeLanguageSelection(sessionTargetLanguages ?? []);

  const effectivePreferenceInterests = preferences.interests;

  useEffect(() => {
    let cancelled = false;

    async function hydratePreviewState() {
      const fallback = {
        savedBookIds: CATALOG_BOOKS.map((book) => book.id).slice(0, 2),
        savedStoryIds: CATALOG_BOOKS.flatMap((book) => book.stories.slice(0, 1).map((story) => story.id)),
        readingProgress: [],
      };
      const storedState = await loadMobilePreviewState(fallback);
      if (cancelled) return;

      setSavedBookIds(storedState.savedBookIds);
      setSavedStoryIds(storedState.savedStoryIds);
      setReadingProgress(storedState.readingProgress);
      setDidHydrateState(true);
    }

    void hydratePreviewState();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (exploreSearchBlurTimeoutRef.current) {
        clearTimeout(exploreSearchBlurTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setExpandedExploreSection(null);
  }, [exploreQuery, selectedExploreLanguage, selectedExploreRegion, selectedExploreTopic]);

  useEffect(() => {
    let cancelled = false;

    async function hydrateFavorites() {
      const local = await loadLocalFavorites(sessionUserId);
      if (!cancelled) setFavoriteWords(local);

      if (!sessionToken) return;

      try {
        const remote = await syncFavoritesFromServer(sessionToken);
        if (cancelled) return;
        setFavoriteWords(remote);
        await saveLocalFavorites(sessionUserId, remote);
      } catch {
        // Keep local cache.
      }
    }

    void hydrateFavorites();

    return () => {
      cancelled = true;
    };
  }, [sessionToken, sessionUserId]);

  useEffect(() => {
    if (!didHydrateState) return;

    void saveMobilePreviewState({
      savedBookIds,
      savedStoryIds,
      readingProgress,
    });
  }, [didHydrateState, readingProgress, savedBookIds, savedStoryIds]);

  const handleUnauthorizedSession = useCallback(
    (message = "Your session expired. Please sign in again.") => {
      setRemoteError(message);
      setPreferencesStatus("error");
      setPreferencesHint(message);
      setOnboardingError(message);
      onSignOut?.();
    },
    [onSignOut]
  );

  useEffect(() => {
    if (!sessionToken) {
      setRemoteBooks([]);
      setRemoteStories([]);
      setRemoteEntitlement(null);
      setRemoteProgress(null);
      const clearedPreferences = {
        targetLanguages: normalizeLanguageSelection(sessionTargetLanguages ?? []),
        interests: [],
        preferredLevel: null,
        preferredRegion: null,
        preferredVariant: null,
        learningGoal: null,
        journeyFocus: null,
        dailyMinutes: null,
        remindersEnabled: false,
        reminderHour: null,
        journeyPlacementLevel: null,
        onboardingSurveyCompletedAt: null,
        onboardingTourCompletedAt: null,
      };
      setPreferences(clearedPreferences);
      setSavedPreferences(clearedPreferences);
      setReminderHint(null);
      setPreferencesStatus("idle");
      setPreferencesHint(null);
      setCustomInterestInput("");
      setRemoteError(null);
      setLoadingRemote(false);
      setRemoteBooksLoading(false);
      setRemoteStoriesLoading(false);
      setRemoteEntitlementLoading(false);
      setRemoteProgressLoading(false);
      setRemoteContinueListening([]);
      setRemoteJourney(null);
      setActiveJourneyLanguage(null);
      setJourneyLanguageLoading(false);
      setJourneyVariantPickerOpen(false);
      setJourneyInsightsByLanguage({});
      return;
    }

    let cancelled = false;

    async function hydrateRemoteLibrary() {
      setLoadingRemote(true);
      setRemoteError(null);
      setRemoteBooksLoading(true);
      setRemoteStoriesLoading(true);
      setRemoteEntitlementLoading(true);
      setRemoteProgressLoading(true);

      const [booksResult, storiesResult, entitlementResult, progressResult, continueResult, journeyResult] = await Promise.allSettled([
        apiFetch<RemoteLibraryBook[]>({
          baseUrl: mobileConfig.apiBaseUrl,
          path: "/api/mobile/library?type=book",
          token: sessionToken,
        }).finally(() => {
          if (!cancelled) setRemoteBooksLoading(false);
        }),
        apiFetch<RemoteLibraryStory[]>({
          baseUrl: mobileConfig.apiBaseUrl,
          path: "/api/mobile/library?type=story",
          token: sessionToken,
        }).finally(() => {
          if (!cancelled) setRemoteStoriesLoading(false);
        }),
        apiFetch<MobileBillingEntitlement>({
          baseUrl: mobileConfig.apiBaseUrl,
          path: "/api/mobile/billing/entitlement",
          token: sessionToken,
        }).finally(() => {
          if (!cancelled) setRemoteEntitlementLoading(false);
        }),
        apiFetch<MobileProgressPayload>({
          baseUrl: mobileConfig.apiBaseUrl,
          path: "/api/mobile/progress",
          token: sessionToken,
        }).finally(() => {
          if (!cancelled) setRemoteProgressLoading(false);
        }),
        apiFetch<RemoteContinueListeningItem[]>({
          baseUrl: mobileConfig.apiBaseUrl,
          path: "/api/continue-listening",
          token: sessionToken,
        }),
        apiFetch<MobileJourneyPayload>({
          baseUrl: mobileConfig.apiBaseUrl,
          path: "/api/mobile/journey",
          token: sessionToken,
        }),
      ]);

      if (cancelled) return;

      const unauthorized = [booksResult, storiesResult, entitlementResult, progressResult, continueResult, journeyResult].some(
        (result) => result.status === "rejected" && isApiErrorStatus(result.reason, 401)
      );
      if (unauthorized) {
        handleUnauthorizedSession();
        setLoadingRemote(false);
        return;
      }

      const errors: string[] = [];

      if (booksResult.status === "fulfilled") {
        setRemoteBooks(booksResult.value);
      } else {
        setRemoteBooks([]);
        if (!sessionBooksCount) {
          errors.push(`Books: ${booksResult.reason instanceof Error ? booksResult.reason.message : "Unable to load"}`);
        }
      }

      if (storiesResult.status === "fulfilled") {
        setRemoteStories(storiesResult.value);
      } else {
        setRemoteStories([]);
        if (!sessionStoriesCount) {
          errors.push(
            `Stories: ${storiesResult.reason instanceof Error ? storiesResult.reason.message : "Unable to load"}`
          );
        }
      }

      if (entitlementResult.status === "fulfilled") {
        setRemoteEntitlement(entitlementResult.value);
      } else if (!sessionPlan) {
        setRemoteEntitlement(null);
        errors.push(
          `Plan: ${entitlementResult.reason instanceof Error ? entitlementResult.reason.message : "Unable to load"}`
        );
      }

      if (progressResult.status === "fulfilled") {
        setRemoteProgress(progressResult.value);
      } else {
        setRemoteProgress(null);
      }

      if (continueResult.status === "fulfilled") {
        setRemoteContinueListening(continueResult.value);
      } else {
        setRemoteContinueListening([]);
      }

      if (journeyResult.status === "fulfilled") {
        const journeyPayload = journeyResult.value;
        setRemoteJourney(journeyPayload);
        const firstTrackInsights = journeyPayload.tracks?.[0]?.insights ?? null;
        const journeyLang = journeyPayload.language ?? "Spanish";
        setJourneyInsightsByLanguage((prev) => ({
          ...prev,
          [journeyLang]: firstTrackInsights
            ? {
                score: firstTrackInsights.score,
                completedSteps: firstTrackInsights.completedSteps,
                totalSteps: firstTrackInsights.totalSteps,
                currentLevelId: firstTrackInsights.currentLevelId ?? null,
                nextMilestone: firstTrackInsights.nextMilestone,
              }
            : null,
        }));
      } else {
        setRemoteJourney(null);
      }

      setRemoteError(errors.length > 0 ? errors.join("  ") : null);
      setLoadingRemote(false);
    }

    void hydrateRemoteLibrary();

    return () => {
      cancelled = true;
    };
  }, [handleUnauthorizedSession, sessionBooksCount, sessionPlan, sessionStoriesCount, sessionToken]);

  const loadJourneyForLanguage = useCallback(
    async (language: string) => {
      if (!sessionToken) return;
      setActiveJourneyLanguage(language);
      setSelectedJourneyTrackId(null);
      setSelectedJourneyLevelId(null);
      setSelectedJourneyTopicId(null);
      setJourneyDetailTopicId(null);
      setJourneyVariantPickerOpen(false);
      setRemoteJourney(null);
      setJourneyLanguageLoading(true);
      try {
        const payload = await apiFetch<MobileJourneyPayload>({
          baseUrl: mobileConfig.apiBaseUrl,
          path: `/api/mobile/journey?language=${encodeURIComponent(language)}`,
          token: sessionToken,
        });
        setRemoteJourney(payload);
        const firstTrackInsights = payload.tracks?.[0]?.insights ?? null;
        setJourneyInsightsByLanguage((prev) => ({
          ...prev,
          [language]: firstTrackInsights
            ? {
                score: firstTrackInsights.score,
                completedSteps: firstTrackInsights.completedSteps,
                totalSteps: firstTrackInsights.totalSteps,
                currentLevelId: firstTrackInsights.currentLevelId ?? null,
                nextMilestone: firstTrackInsights.nextMilestone,
              }
            : null,
        }));
        if (payload.tracks.length >= 2) {
          setJourneyVariantPickerOpen(true);
        }
      } catch {
        setRemoteJourney(null);
      } finally {
        setJourneyLanguageLoading(false);
      }
    },
    [sessionToken]
  );

  useEffect(() => {
    if (preferences.targetLanguages.length === 1) {
      setActiveJourneyLanguage(preferences.targetLanguages[0]);
    } else {
      setActiveJourneyLanguage(null);
    }
  }, [preferences.targetLanguages]);

  useEffect(() => {
    setSelectedBookDescriptionExpanded(false);
  }, [selectedBook?.id]);

  useEffect(() => {
    if (!sessionToken) {
      setDidHydratePreferences(false);
    }
  }, [sessionToken]);

  useEffect(() => {
    if (!sessionToken) return;

    let cancelled = false;

    async function hydratePreferences() {
      setPreferencesLoading(true);
      try {
        const next = await apiFetch<MobilePreferences>({
          baseUrl: mobileConfig.apiBaseUrl,
          path: "/api/mobile/preferences",
          token: sessionToken,
        });
        if (cancelled) return;
        const normalized: MobilePreferences = {
          targetLanguages: normalizeLanguageSelection(next.targetLanguages ?? []),
          interests: normalizeInterestSelection(next.interests ?? []),
          preferredLevel: next.preferredLevel ?? null,
          preferredRegion: next.preferredRegion ?? null,
          preferredVariant: next.preferredVariant ?? null,
          learningGoal: normalizeLearningGoal(next.learningGoal),
          journeyFocus:
            normalizeJourneyFocusPreference(next.journeyFocus) ??
            getJourneyFocusFromLearningGoal(normalizeLearningGoal(next.learningGoal)),
          dailyMinutes: normalizeDailyMinutes(next.dailyMinutes),
          remindersEnabled: normalizeRemindersEnabled(next.remindersEnabled),
          reminderHour: normalizeReminderHour(next.reminderHour),
          journeyPlacementLevel:
            typeof next.journeyPlacementLevel === "string" ? next.journeyPlacementLevel : null,
          onboardingSurveyCompletedAt:
            typeof next.onboardingSurveyCompletedAt === "string" ? next.onboardingSurveyCompletedAt : null,
          onboardingTourCompletedAt:
            typeof next.onboardingTourCompletedAt === "string" ? next.onboardingTourCompletedAt : null,
        };
        setPreferences(normalized);
        setSavedPreferences(normalized);
        setDidHydratePreferences(true);
        setPreferencesStatus("idle");
        setPreferencesHint(null);
        const reminderState = await syncDailyReminderSchedule({
          enabled: normalized.remindersEnabled,
          hour: normalized.reminderHour,
          learningGoal: normalized.learningGoal,
          dailyMinutes: normalized.dailyMinutes,
          context: null,
          activeToday: false,
          requestPermissions: false,
        });
        if (!cancelled) setReminderHint(reminderState.message);
      } catch (error) {
        if (cancelled) return;
        if (isApiErrorStatus(error, 401)) {
          handleUnauthorizedSession();
          return;
        }
        setPreferencesStatus("error");
        setPreferencesHint(error instanceof Error ? error.message : "Could not load settings.");
      } finally {
        if (!cancelled) setPreferencesLoading(false);
      }
    }

    void hydratePreferences();

    return () => {
      cancelled = true;
    };
  }, [handleUnauthorizedSession, sessionToken]);

  useEffect(() => {
    let cancelled = false;

    async function resolveCelebration() {
      if (!sessionUserId || !remoteProgress?.gamification) {
        if (!cancelled) setActiveGamificationCelebration(null);
        return;
      }

      const seenIds = await loadSeenGamificationCelebrations(sessionUserId);
      if (cancelled) return;
      const seen = new Set([...seenIds, ...dismissedCelebrationIds]);
      const next =
        buildGamificationCelebrations(remoteProgress.gamification).find((item) => !seen.has(item.id)) ?? null;
      setActiveGamificationCelebration(next);
    }

    void resolveCelebration();
    return () => {
      cancelled = true;
    };
  }, [dismissedCelebrationIds, remoteProgress, sessionUserId]);

  useEffect(() => {
    if (!activeGamificationCelebration) {
      celebrationAnim.setValue(0);
      return;
    }

    Animated.sequence([
      Animated.timing(celebrationAnim, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(celebrationAnim, {
        toValue: 0.82,
        duration: 220,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
    const autoDismiss = setTimeout(() => {
      Animated.timing(celebrationAnim, {
        toValue: 0,
        duration: 300,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start(() => {
        void dismissGamificationCelebration(activeGamificationCelebration.id);
      });
    }, 4000);
    return () => clearTimeout(autoDismiss);
  }, [activeGamificationCelebration, celebrationAnim]);

  useEffect(() => {
    if (!journeyMilestone) {
      journeyMilestoneAnim.setValue(0);
      return;
    }

    Animated.sequence([
      Animated.timing(journeyMilestoneAnim, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(journeyMilestoneAnim, {
        toValue: 0.9,
        duration: 220,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
    const autoDismiss = setTimeout(() => {
      Animated.timing(journeyMilestoneAnim, {
        toValue: 0,
        duration: 300,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start(() => {
        setJourneyMilestone(null);
      });
    }, 5000);

    let cancelled = false;
    void (async () => {
      try {
        if (journeyMilestoneSoundRef.current) {
          await journeyMilestoneSoundRef.current.unloadAsync();
          journeyMilestoneSoundRef.current = null;
        }

        const { sound } = await Audio.Sound.createAsync(
          { uri: JOURNEY_MILESTONE_CHIME_URI },
          { shouldPlay: true, volume: 0.22 }
        );
        if (cancelled) {
          await sound.unloadAsync();
          return;
        }
        journeyMilestoneSoundRef.current = sound;
      } catch {
        // Best-effort payoff only.
      }
    })();

    return () => {
      clearTimeout(autoDismiss);
      cancelled = true;
    };
  }, [journeyMilestone, journeyMilestoneAnim]);

  useEffect(() => {
    let cancelled = false;

    async function hydrateOfflineState() {
      const snapshot = await loadOfflineSnapshot(PREVIEW_OFFLINE_USER_ID);
      if (!cancelled) setOfflineSnapshot(snapshot);
    }

    void hydrateOfflineState();

    return () => {
      cancelled = true;
    };
  }, []);

  const continueReading = useMemo(
    () => {
      const localSelections = readingProgress
        .map((entry) => {
          const resolved = resolveStorySelection(entry.storyId);
          if (!resolved) return null;
          const offlineStory = offlineSnapshot?.stories.find((item) => item.storyId === entry.storyId);
          return {
            key: `${resolved.book.slug}:${resolved.story.slug}`,
            updatedAt: entry.updatedAt,
            selection: {
              ...resolved,
              resolvedAudioUrl: offlineStory?.localAudioUri ?? resolved.story.audio,
            },
          };
        })
        .filter(Boolean);

      const remoteSelections = remoteContinueListening
        .map((entry) => {
          const resolved = resolveStorySelectionBySlugs(entry.bookSlug, entry.storySlug);
          if (!resolved) return null;
          const offlineStory = offlineSnapshot?.stories.find((item) => item.storyId === resolved.story.id);
          return {
            key: `${resolved.book.slug}:${resolved.story.slug}`,
            updatedAt: entry.lastPlayedAt,
            selection: {
              ...resolved,
              resolvedAudioUrl: offlineStory?.localAudioUri ?? resolved.story.audio,
            },
          };
        })
        .filter(Boolean);

      const merged = [...remoteSelections, ...localSelections] as Array<{
        key: string;
        updatedAt: string;
        selection: ReaderSelection;
      }>;

      return merged
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
        .filter((entry, index, items) => items.findIndex((candidate) => candidate.key === entry.key) === index)
        .slice(0, 8)
        .map((entry) => entry.selection);
    },
    [offlineSnapshot?.stories, readingProgress, remoteContinueListening]
  );

  const offlineStoriesById = useMemo(
    () => new Map((offlineSnapshot?.stories ?? []).map((story) => [story.storyId, story])),
    [offlineSnapshot?.stories]
  );

  const favoriteWordsByKey = useMemo(
    () => new Map(favoriteWords.map((item) => [buildFavoriteIdentity(item), item])),
    [favoriteWords]
  );
  const favoriteIdentitySet = useMemo(
    () => new Set(favoriteWords.map((item) => createRelatedFavoriteIdentity(item))),
    [favoriteWords]
  );

  const effectiveRemoteBooksCount = remoteBooks.length > 0 ? remoteBooks.length : (sessionBooksCount ?? 0);
  const effectiveRemoteStoriesCount = remoteStories.length > 0 ? remoteStories.length : (sessionStoriesCount ?? 0);
  const dueFavoritesCount = useMemo(
    () =>
      favoriteWords.filter((item) => {
        if (!item.nextReviewAt) return true;
        const dueAt = Date.parse(item.nextReviewAt);
        return Number.isNaN(dueAt) || dueAt <= Date.now();
      }).length,
    [favoriteWords]
  );
  const maxFavoriteStreak = useMemo(
    () => favoriteWords.reduce((best, item) => Math.max(best, item.streak ?? 0), 0),
    [favoriteWords]
  );
  const favoriteTypeCounts = useMemo(
    () =>
      favoriteWords.reduce<Record<string, number>>((acc, item) => {
        const type = getFavoriteType(item);
        acc[type] = (acc[type] ?? 0) + 1;
        return acc;
      }, {}),
    [favoriteWords]
  );
  const availableFavoriteTypes = useMemo(
    () => ["all", ...Object.keys(favoriteTypeCounts).sort()],
    [favoriteTypeCounts]
  );
  const allCatalogRelatedFavorites = useMemo<MobileFavoriteItem[]>(() => {
    const items: MobileFavoriteItem[] = [];

    for (const book of CATALOG_BOOKS) {
      for (const story of book.stories ?? []) {
        for (const vocab of story.vocab ?? []) {
          if (!vocab.word || !vocab.definition) continue;
          items.push({
            word: vocab.word,
            translation: vocab.definition,
            wordType: vocab.type ?? null,
            exampleSentence: typeof vocab.note === "string" ? vocab.note : null,
            storySlug: story.id,
            storyTitle: story.title,
            sourcePath: `/books/${book.slug}/${story.slug}`,
            language: story.language ?? book.language ?? null,
          });
        }
      }
    }

    return items;
  }, []);
  const remoteSummaryItems = [
    { label: "Saved books", value: `${effectiveRemoteBooksCount}` },
    { label: "Saved stories", value: `${effectiveRemoteStoriesCount}` },
    { label: "Favorites", value: `${remoteProgress?.wordsLearned ?? favoriteWords.length}` },
    { label: "Plan", value: remoteEntitlement?.plan ?? sessionPlan ?? "free" },
  ];
  const progressStats = useMemo<ProgressStat[]>(
    () => [
      {
        label: "Stories finished",
        value: `${remoteProgress?.storiesFinished ?? continueReading.length}`,
        icon: "book-open",
      },
      {
        label: "Saved words",
        value: `${remoteProgress?.wordsLearned ?? favoriteWords.length}`,
        icon: "star",
      },
      {
        label: "Practice sessions",
        value: `${remoteProgress?.practiceSessionsCompleted ?? dueFavoritesCount}`,
        icon: "clock",
      },
      {
        label: "Offline stories",
        value: `${offlineSnapshot?.stories.length ?? 0}`,
        icon: "download",
      },
    ],
    [continueReading.length, dueFavoritesCount, favoriteWords.length, offlineSnapshot?.stories.length, remoteProgress]
  );
  const weeklyGoalStories = remoteProgress?.weeklyGoalStories ?? 3;
  const weeklyStoriesFinished = remoteProgress?.weeklyStoriesFinished ?? Math.min(savedStoryIds.length, weeklyGoalStories);
  const weeklyStoriesPercent = Math.min(100, (weeklyStoriesFinished / weeklyGoalStories) * 100);
  const onboardingPracticePrefs = useMemo(
    () => ({
      interests: preferences.interests,
      learningGoal: preferences.learningGoal,
      dailyMinutes: preferences.dailyMinutes,
    }),
    [preferences.dailyMinutes, preferences.interests, preferences.learningGoal]
  );
  const duePracticeItems = useMemo(
    () => sortPracticeItemsByOnboarding(getDuePracticeItems(buildPracticeFavorites(favoriteWords)), onboardingPracticePrefs, true),
    [favoriteWords, onboardingPracticePrefs]
  );

  const recommendedPracticeMode = useMemo<PracticeModeKey>(() => {
    const base = getRecommendedPracticeModeFromItems(buildPracticeFavorites(favoriteWords));
    const personalized = getRecommendedPracticeModeFromOnboarding(
      buildPracticeFavorites(favoriteWords),
      base,
      onboardingPracticePrefs
    );
    return personalized === "natural" ? "context" : personalized;
  }, [favoriteWords, onboardingPracticePrefs]);

  const recommendedPracticeLabel =
    PRACTICE_MODE_CARDS.find((card) => card.key === recommendedPracticeMode)?.title ?? "Meaning";
  const preferredPracticeMinutes =
    typeof preferences.dailyMinutes === "number" && preferences.dailyMinutes > 0 ? preferences.dailyMinutes : 5;
  const hasDailyLoopActivityToday = useMemo(() => {
    const now = new Date();
    const isSameLocalDay = (value?: string | null) => {
      if (!value) return false;
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return false;
      return (
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate()
      );
    };

    if (isSameLocalDay(lastPracticeActivityAt)) return true;
    if (readingProgress.some((entry) => isSameLocalDay(entry.updatedAt))) return true;
    if (remoteContinueListening.some((entry) => isSameLocalDay(entry.lastPlayedAt))) return true;
    return false;
  }, [lastPracticeActivityAt, readingProgress, remoteContinueListening]);
  const homeLoopSummary = useMemo(() => {
    if (continueReading.length > 0) {
      return {
        title: "Resume, review, then keep moving",
        body:
          dueFavoritesCount > 0
            ? `${dueFavoritesCount} due ${dueFavoritesCount === 1 ? "word is" : "words are"} waiting after your story.`
            : `You already have a story in motion. A quick ${preferredPracticeMinutes}-minute review after reading will keep the rhythm alive.`,
        primaryLabel: "Resume story",
        secondaryLabel: "Start review",
      };
    }

    if (dueFavoritesCount > 0) {
      return {
        title: "Clear your due review first",
        body: `${dueFavoritesCount} saved ${dueFavoritesCount === 1 ? "word is" : "words are"} ready for a fast ${preferredPracticeMinutes}-minute session.`,
        primaryLabel: "Start review",
        secondaryLabel: "Open Journey",
      };
    }

    return {
      title: "Pick one story and one short review",
      body: `Aim for one authentic story and a ${preferredPracticeMinutes}-minute practice pass today.`,
      primaryLabel: "Open Journey",
      secondaryLabel: "Browse stories",
    };
  }, [continueReading, dueFavoritesCount, preferredPracticeMinutes]);
  const favoritesLoopSummary = useMemo(() => {
    if (dueFavoritesCount > 0) {
      return {
        title: "Clear your due review first",
        body: `${dueFavoritesCount} saved ${dueFavoritesCount === 1 ? "word is" : "words are"} ready for a fast ${preferredPracticeMinutes}-minute round.`,
        primaryLabel: "Practice due",
        secondaryLabel: "Back to Journey",
      };
    }
    return {
      title: "Grow the next review round",
      body: `You are clear for now. Read one more story and save a few words to keep your ${preferredPracticeMinutes}-minute habit alive.`,
      primaryLabel: "Practice all",
      secondaryLabel: "Open Journey",
    };
  }, [dueFavoritesCount, preferredPracticeMinutes]);
  const practiceLoopSummary = useMemo(() => {
    if (dueFavoritesCount > 0) {
      return `${dueFavoritesCount} saved ${dueFavoritesCount === 1 ? "word is" : "words are"} ready. ${recommendedPracticeLabel} is the best quick review for your ${preferredPracticeMinutes}-minute plan.`;
    }
    return `Pick one fast mode and keep the loop moving. This setup is tuned for a ${preferredPracticeMinutes}-minute practice pass.`;
  }, [dueFavoritesCount, preferredPracticeMinutes, recommendedPracticeLabel]);
  const activePracticeCard =
    PRACTICE_MODE_CARDS.find((card) => card.key === activePracticeMode) ?? null;
  const visiblePracticeCards = PRACTICE_MODE_CARDS;
  const currentPracticeExercise = practiceExercises[practiceIndex] ?? null;
  const currentPracticeFavoriteItem = useMemo<MobileFavoriteItem | null>(() => {
    if (!currentPracticeExercise || currentPracticeExercise.kind !== "multiple-choice") return null;
    return {
      word: currentPracticeExercise.favorite.word,
      translation: currentPracticeExercise.favorite.translation,
      wordType: currentPracticeExercise.favorite.wordType ?? null,
      exampleSentence: currentPracticeExercise.favorite.exampleSentence ?? null,
      storySlug: currentPracticeExercise.favorite.storySlug ?? null,
      storyTitle: currentPracticeExercise.favorite.storyTitle ?? null,
      sourcePath: currentPracticeExercise.favorite.sourcePath ?? null,
      language: currentPracticeExercise.favorite.language ?? null,
    };
  }, [currentPracticeExercise]);
  const currentPracticeFavoriteSaved = currentPracticeFavoriteItem
    ? favoriteWordsByKey.has(buildFavoriteIdentity(currentPracticeFavoriteItem))
    : false;
  const practiceProgressLabel =
    practiceExercises.length > 0 ? `${Math.min(practiceIndex + 1, practiceExercises.length)}/${practiceExercises.length}` : "0/0";
  const checkpointPassed =
    practiceLaunchContext.source === "journey" &&
    practiceLaunchContext.kind === "checkpoint" &&
    practiceExercises.length > 0 &&
    practiceScore / practiceExercises.length >= CHECKPOINT_PASS_THRESHOLD;
  const checkpointMissedItems = useMemo(() => {
    if (
      practiceLaunchContext.source !== "journey" ||
      practiceLaunchContext.kind !== "checkpoint"
    ) {
      return [] as PracticeFavoriteItem[];
    }

    const wordMap = new Map(
      (practiceSeedItems ?? []).map((item) => [normalizePracticeWord(item.word), item] as const)
    );
    const missedWords = new Set<string>();

    for (const exercise of practiceExercises) {
      if (exercise.kind !== "multiple-choice") continue;
      const response = practiceCheckpointResponses[exercise.id];
      if (response === exercise.answer) continue;
      const fallbackWord = exercise.favorite.word || exercise.answer;
      missedWords.add(normalizePracticeWord(fallbackWord));
    }

    return Array.from(missedWords)
      .map((word) => wordMap.get(word))
      .filter((item): item is PracticeFavoriteItem => Boolean(item));
  }, [practiceCheckpointResponses, practiceExercises, practiceLaunchContext, practiceSeedItems]);
  const checkpointRecoveryWords = checkpointMissedItems.slice(0, 4).map((item) => item.word);
  const checkpointRecoveryMode = useMemo<PracticeModeKey | null>(() => {
    if (checkpointMissedItems.length === 0) return null;
    return getRecommendedPracticeModeFromItems(checkpointMissedItems);
  }, [checkpointMissedItems]);

  const savedBooks = useMemo(
    () => CATALOG_BOOKS.filter((book) => savedBookIds.includes(book.id)),
    [savedBookIds]
  );
  const regionsExplored = useMemo(
    () =>
      remoteProgress?.regionsExplored ??
      new Set(
        savedBooks
          .map((book) => formatVariant(book.variant ?? book.region ?? ""))
          .filter((value) => value && value !== "Unknown")
      ).size,
    [remoteProgress?.regionsExplored, savedBooks]
  );

  const savedStories = useMemo(
    () =>
      CATALOG_BOOKS.flatMap((book) =>
        book.stories
          .filter((story) => savedStoryIds.includes(story.id))
          .map((story) => ({
            selection: resolveStorySelection(story.id, book, story),
            offlineStory: offlineStoriesById.get(story.id),
          }))
          .filter(
            (
              entry
            ): entry is {
              selection: ReaderSelection;
              offlineStory: OfflineLibrarySnapshot["stories"][number] | undefined;
            } => entry.selection !== null
          )
      ),
    [offlineStoriesById, savedStoryIds]
  );

  const remoteOpenableStories = useMemo(
    () =>
      remoteStories
        .map((story) => {
          const selection = resolveStorySelection(story.storyId);
          if (!selection) return null;
          const offlineStory = offlineStoriesById.get(story.storyId);
          return { remote: story, selection, offlineStory };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null),
    [offlineStoriesById, remoteStories]
  );

  const favoriteCards = useMemo(
    () =>
      sortPracticeItemsByOnboarding(favoriteWords, onboardingPracticePrefs, true)
        .map((item) => {
          const selection = item.storySlug ? resolveStorySelection(item.storySlug) : null;
          return {
            key: buildFavoriteIdentity(item),
            item,
            selection,
          };
        }),
    [favoriteWords, onboardingPracticePrefs]
  );
  const filteredFavoriteCards = useMemo(
    () =>
      favoriteCards.filter(({ item }) =>
        selectedFavoriteType === "all" ? true : getFavoriteType(item) === selectedFavoriteType
      ),
    [favoriteCards, selectedFavoriteType]
  );
  const showFavoriteLanguageChip = useMemo(() => {
    const langs = new Set(favoriteWords.map((w) => w.language).filter(Boolean));
    return langs.size > 1;
  }, [favoriteWords]);
  const relatedPracticeCandidates = useMemo(() => {
    const base = favoriteWords.filter((item) =>
      selectedFavoriteType === "all" ? true : getFavoriteType(item) === selectedFavoriteType
    );

    if (base.length === 0) return [] as MobileFavoriteItem[];

    const scored = new Map<string, { item: MobileFavoriteItem; score: number }>();

    for (const seed of base) {
      const seedLanguage = normalizeTokenValue(seed.language);
      const seedStory = normalizeTokenValue(seed.storySlug);
      const seedType = getFavoriteType(seed);
      const seedDefinitionTokens = new Set(getDefinitionTokens(seed.translation));
      const seedStem = getWordStem(seed.word);

      for (const candidate of allCatalogRelatedFavorites) {
        const candidateLanguage = normalizeTokenValue(candidate.language);
        if (!seedLanguage || candidateLanguage !== seedLanguage) continue;
        if (favoriteIdentitySet.has(createRelatedFavoriteIdentity(candidate))) continue;
        if (seedStory && normalizeTokenValue(candidate.storySlug) === seedStory) continue;

        const candidateType = getFavoriteType(candidate);
        const candidateTokens = getDefinitionTokens(candidate.translation);
        const sharedDefinitionTokens = candidateTokens.filter((token) => seedDefinitionTokens.has(token));
        const candidateStem = getWordStem(candidate.word);

        let score = 0;
        if (candidateType === seedType) score += 3;
        if (sharedDefinitionTokens.length > 0) score += Math.min(4, sharedDefinitionTokens.length * 2);
        if (seedStem.length >= 4 && candidateStem.length >= 4 && seedStem === candidateStem) score += 2;

        if (score < 4) continue;

        const key = `${createRelatedFavoriteIdentity(candidate)}::${normalizeTokenValue(candidate.storySlug) ?? ""}`;
        const existing = scored.get(key);
        if (!existing || score > existing.score) {
          scored.set(key, { item: candidate, score });
        }
      }
    }

    return [...scored.values()]
      .sort((a, b) => b.score - a.score || a.item.word.localeCompare(b.item.word))
      .slice(0, RELATED_PRACTICE_MAX)
      .map((entry) => entry.item);
  }, [allCatalogRelatedFavorites, favoriteIdentitySet, favoriteWords, selectedFavoriteType]);
  const relatedPracticeAvailable = relatedPracticeCandidates.length >= MIN_RELATED_PRACTICE_ITEMS;

  const continueReadingCards = useMemo<StoryCardModel[]>(
    () =>
      continueReading.map((item) => {
        const progress = readingProgress.find((entry) => entry.storyId === item.story.id) ?? null;
        return {
          key: `continue-${item.story.id}`,
          title: item.story.title,
          subtitle: progress ? formatReadingProgressLabel(progress) ?? item.book.title : item.book.title,
          coverUrl: getCoverUrl(item.story.cover ?? item.book.cover),
          meta: `${formatLanguage(item.story.language ?? item.book.language)} · ${formatTopic(item.story.topic ?? item.book.topic)}`,
          badge: offlineStoriesById.has(item.story.id) ? "Offline ready" : item.story.audio ? "Audio" : "Read",
          progressLabel: formatReadingProgressLabel(progress),
          onPress: () => setSelection(item),
        };
      }),
    [continueReading, offlineStoriesById, readingProgress]
  );

  const savedStoryCards = useMemo<StoryCardModel[]>(
    () =>
      savedStories.map(({ selection, offlineStory }) => {
        const progress = readingProgress.find((entry) => entry.storyId === selection.story.id) ?? null;
        return {
          key: `saved-${selection.story.id}`,
          title: selection.story.title,
          subtitle: progress ? formatReadingProgressLabel(progress) ?? selection.book.title : selection.book.title,
          coverUrl: getCoverUrl(selection.story.cover ?? selection.book.cover),
          meta: `${formatLanguage(selection.story.language ?? selection.book.language)} · ${formatTopic(selection.story.topic ?? selection.book.topic)}`,
          badge: offlineStory ? "Offline ready" : selection.story.audio ? "Audio ready" : "Text",
          progressLabel: formatReadingProgressLabel(progress),
          onPress: () =>
            setSelection({
              book: selection.book,
              story: selection.story,
              resolvedAudioUrl: offlineStory?.localAudioUri ?? selection.story.audio,
            }),
        };
      }),
    [savedStories, readingProgress]
  );

  const remoteStoryCards = useMemo<StoryCardModel[]>(
    () =>
      remoteOpenableStories.map(({ remote, selection, offlineStory }) => {
        const progress = readingProgress.find((entry) => entry.storyId === selection.story.id) ?? null;
        return {
          key: `remote-${remote.storyId}`,
          title: remote.title,
          subtitle: progress ? formatReadingProgressLabel(progress) ?? selection.book.title : selection.book.title,
          coverUrl: getCoverUrl(selection.story.cover || remote.coverUrl || selection.book.cover),
          meta: `${formatLanguage(remote.language ?? selection.story.language ?? selection.book.language)} · ${formatTopic(remote.topic ?? selection.story.topic ?? selection.book.topic)}`,
          badge: offlineStory ? "Offline ready" : remote.audioUrl ? "Audio ready" : "Read",
          progressLabel: formatReadingProgressLabel(progress),
          onPress: () =>
            setSelection({
              book: selection.book,
              story: selection.story,
              resolvedAudioUrl: offlineStory?.localAudioUri ?? remote.audioUrl ?? selection.story.audio,
            }),
        };
      }),
    [remoteOpenableStories, readingProgress]
  );

  const filteredRemoteStoryCards = useMemo<StoryCardModel[]>(() => {
    const query = exploreQuery.trim().toLowerCase();

    return remoteOpenableStories
      .filter(({ remote, selection }) => {
        const language = formatLanguage(remote.language ?? selection.story.language ?? selection.book.language);
        const region = formatRegion(selection.story.region ?? selection.book.region ?? "");
        const topic = formatTopic(remote.topic ?? selection.story.topic ?? selection.book.topic);

        if (selectedExploreLanguage !== "All" && language !== selectedExploreLanguage) return false;
        if (selectedExploreRegion !== "All" && region !== selectedExploreRegion) return false;
        if (selectedExploreTopic !== "All" && topic !== selectedExploreTopic) return false;

        if (!query) return true;

        const haystack = [
          remote.title,
          selection.book.title,
          language,
          region,
          topic,
          remote.storySlug,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(query);
      })
      .map(({ remote, selection, offlineStory }) => ({
        key: `remote-filtered-${remote.storyId}`,
        title: remote.title,
        subtitle: selection.book.title,
        coverUrl: getCoverUrl(selection.story.cover || remote.coverUrl || selection.book.cover),
        meta: `${formatLanguage(remote.language ?? selection.story.language ?? selection.book.language)} · ${formatTopic(remote.topic ?? selection.story.topic ?? selection.book.topic)}`,
        badge: offlineStory ? "Offline ready" : remote.audioUrl ? "Audio ready" : "Read",
        onPress: () =>
          setSelection({
            book: selection.book,
            story: selection.story,
            resolvedAudioUrl: offlineStory?.localAudioUri ?? remote.audioUrl ?? selection.story.audio,
          }),
      }));
  }, [
    exploreQuery,
    remoteOpenableStories,
    selectedExploreLanguage,
    selectedExploreRegion,
    selectedExploreTopic,
  ]);

  const filteredStandaloneStoryCards = useMemo<StoryCardModel[]>(() => {
    const query = exploreQuery.trim().toLowerCase();

    return remoteStories
      .filter((story) => story.bookId === "standalone")
      .filter((story) => {
        const language = formatLanguage(story.language ?? "");
        const region = formatRegion(story.region ?? "");
        const topic = formatTopic(story.topic ?? "");

        if (selectedExploreLanguage !== "All" && language !== selectedExploreLanguage) return false;
        if (selectedExploreRegion !== "All" && region !== selectedExploreRegion) return false;
        if (selectedExploreTopic !== "All" && topic !== selectedExploreTopic) return false;

        if (!query) return true;

        const haystack = [story.title, language, region, topic, story.storySlug]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(query);
      })
      .map((story) => ({
        key: `standalone-${story.storyId}`,
        title: story.title,
        subtitle: [formatLanguage(story.language ?? ""), formatRegion(story.region ?? "")]
          .filter((value) => value && value !== "Unknown")
          .join(" · ") || "Standalone story",
        coverUrl: getCoverUrl(story.coverUrl),
        meta: [story.level ? LEVEL_LABELS[toDomainLevel(story.level)] : null, formatTopic(story.topic ?? "")]
          .filter(Boolean)
          .join(" · "),
        badge: story.audioUrl ? "Audio ready" : "Read",
        onPress: () => {
          void openStandaloneStory(story);
        },
      }));
  }, [
    exploreQuery,
    remoteStories,
    selectedExploreLanguage,
    selectedExploreRegion,
    selectedExploreTopic,
  ]);

  const homeStandaloneStoryCards = useMemo<StoryCardModel[]>(
    () =>
      remoteStories
        .filter((story) => story.bookId === "standalone")
        .map((story) => ({
          key: `home-standalone-${story.storyId}`,
          title: story.title,
          subtitle: [formatLanguage(story.language ?? ""), formatRegion(story.region ?? "")]
            .filter((value) => value && value !== "Unknown")
            .join(" · ") || "Standalone story",
          coverUrl: getCoverUrl(story.coverUrl),
          meta: [story.level ? LEVEL_LABELS[toDomainLevel(story.level)] : null, formatTopic(story.topic ?? "")]
            .filter(Boolean)
            .join(" · "),
          badge: story.audioUrl ? "Audio ready" : "Read",
          onPress: () => {
            void openStandaloneStory(story);
          },
        }))
        .slice(0, 6),
    [remoteStories]
  );

  const remoteBookCards = useMemo(
    () =>
      remoteBooks
        .map((item) => {
          const book = CATALOG_BOOKS.find((entry) => entry.id === item.bookId);
          if (!book) return null;
          return {
            key: `remote-book-${item.bookId}`,
            title: item.title,
            coverUrl: getCoverUrl(item.coverUrl || book.cover),
            language: formatLanguage(book.language),
            region: formatRegion(book.region),
            level: book.level,
            statsLine: `${book.stories.length} stories`,
            topicsLine: formatTopic(book.topic),
            description: book.description ?? book.subtitle ?? undefined,
            onPress: () => {
              openBook(book);
            },
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null),
    [remoteBooks]
  );

  const bottomTabs: { key: BottomTab; label: string }[] = isSignedIn
    ? [
        { key: "home", label: "Home" },
        { key: "explore", label: "Explore" },
        { key: "practice", label: "Practice" },
        { key: "favorites", label: "Favorites" },
        { key: "journey", label: "Journey" },
      ]
    : [
        { key: "home", label: "Home" },
        { key: "explore", label: "Explore" },
        { key: "practice", label: "Practice" },
          { key: "favorites", label: "Favorites" },
          { key: "signin", label: "Sign in" },
        ];
  const preferencesDirty = !preferencesEqual(preferences, savedPreferences);
  const settingsPrimaryLanguage = preferences.targetLanguages[0] ?? "";
  const settingsAvailableVariants =
    VARIANT_OPTIONS_BY_LANGUAGE[settingsPrimaryLanguage.trim().toLowerCase()] ?? [];
  const createAvailableRegions = getRegionOptionsForLanguage(settingsPrimaryLanguage);
  const settingsAvailableRegions = getRegionOptionsForLanguage(settingsPrimaryLanguage);
  const shouldShowOnboardingSurvey =
    isSignedIn &&
    didHydratePreferences &&
    !preferencesLoading &&
    !preferences.onboardingSurveyCompletedAt;
  const shouldShowOnboardingTour =
    isSignedIn &&
    didHydratePreferences &&
    !preferencesLoading &&
    Boolean(preferences.onboardingSurveyCompletedAt) &&
    !preferences.onboardingTourCompletedAt &&
    onboardingTourStep !== null;
  const activeOnboardingTourMessage =
    shouldShowOnboardingTour && onboardingTourStep !== null ? PRODUCT_TOUR_MESSAGES[onboardingTourStep] : null;
  const activeOnboardingTourTarget = activeOnboardingTourMessage?.target ?? null;

  function tourTargetMatchesTab(tab: BottomTab) {
    if (!activeOnboardingTourTarget) return false;
    if (activeOnboardingTourTarget === "practice-favorites") {
      return tab === "practice" || tab === "favorites";
    }
    if (activeOnboardingTourTarget === "explore") return tab === "explore";
    if (activeOnboardingTourTarget === "journey") return tab === "journey";
    if (activeOnboardingTourTarget === "home") return tab === "home";
    return false;
  }

  useEffect(() => {
    if (!activeOnboardingTourTarget) return;
    if (activeOnboardingTourTarget === "home" || activeOnboardingTourTarget === "reader") {
      setActiveScreen("home");
    } else if (activeOnboardingTourTarget === "explore") {
      setActiveScreen("explore");
    } else if (activeOnboardingTourTarget === "practice-favorites") {
      setActiveScreen("practice");
    } else if (activeOnboardingTourTarget === "journey") {
      setActiveScreen("journey");
    }
    requestAnimationFrame(() => {
      shellScrollRef.current?.scrollTo({ y: 0, animated: true });
    });
  }, [activeOnboardingTourTarget]);

  useEffect(() => {
    if (!isSignedIn || preferencesLoading) return;
    if (!preferences.onboardingSurveyCompletedAt) {
      setOnboardingTourStep(null);
      return;
    }
    if (!preferences.onboardingTourCompletedAt) {
      setOnboardingTourStep((current) => current ?? 0);
      return;
    }
    setOnboardingTourStep(null);
  }, [
    isSignedIn,
    preferences.onboardingSurveyCompletedAt,
    preferences.onboardingTourCompletedAt,
    preferencesLoading,
  ]);

  function openSelection(selection: ReaderSelection) {
    setSelection(selection);
    setMenuOpen(false);
  }

  function openBook(book: Book) {
    setSelectedBook(book);
    setSelectedBookTab("stories");
    setMenuOpen(false);
  }

  useEffect(() => {
    if (!selectedBook) return;
    requestAnimationFrame(() => {
      bookDetailScrollRef.current?.scrollTo({ y: 0, animated: false });
    });
  }, [selectedBook?.id]);

  useEffect(() => {
    setSelectedBookStoryQuery("");
    setSelectedBookStoryTopicFilter("all");
    setSelectedBookStorySortKey("recommended");
    setSelectedBookStoryPickerSection(null);
  }, [selectedBook?.id]);

  async function openStandaloneStory(story: RemoteLibraryStory) {
    if (!story.storySlug) return;

    try {
      const payload = await apiFetch<{ stories?: MobileStandaloneStory[] }>({
        baseUrl: mobileConfig.apiBaseUrl,
        path: `/api/standalone-stories?slugs=${encodeURIComponent(story.storySlug)}`,
        token: sessionToken,
        timeoutMs: 15000,
      });
      const standalone = payload.stories?.[0];
      if (!standalone) return;
      openSelection(createSelectionFromStandaloneStory(standalone));
    } catch (error) {
      console.error("[mobile explore] failed to open standalone story", error);
    }
  }

  function toggleBookSaved(book: Book) {
    const isSaved = savedBookIds.includes(book.id);
    setSavedBookIds((current) => (isSaved ? current.filter((id) => id !== book.id) : [...current, book.id]));
  }

  function toggleStorySaved(_book: Book, story: Story) {
    const isSaved = savedStoryIds.includes(story.id);
    setSavedStoryIds((current) => (isSaved ? current.filter((id) => id !== story.id) : [...current, story.id]));
  }

  function recordProgress(
    book: Book,
    story: Story,
    details?: {
      progressRatio?: number;
      currentBlockIndex?: number;
      totalBlocks?: number;
    }
  ) {
    setReadingProgress((current) =>
      [
        {
          bookId: book.id,
          storyId: story.id,
          title: story.title,
          updatedAt: new Date().toISOString(),
          progressRatio: details?.progressRatio,
          currentBlockIndex: details?.currentBlockIndex,
          totalBlocks: details?.totalBlocks,
        },
        ...current.filter((entry) => entry.storyId !== story.id),
      ].slice(0, 8)
    );

    // Show "what's next" popup for standalone/journey stories when nearing completion
    if (
      book.id === "standalone-book" &&
      (details?.progressRatio ?? 0) >= 0.92 &&
      !storyCompletionShownRef.current.has(story.id)
    ) {
      storyCompletionShownRef.current.add(story.id);
      setStoryCompletionPopup(true);
    }
  }

  async function savePreferences() {
    if (!sessionToken) {
      setPreferencesStatus("error");
      setPreferencesHint("Sign in to save settings.");
      return;
    }

    try {
      setPreferencesStatus("saving");
      const next = await apiFetch<MobilePreferences>({
        baseUrl: mobileConfig.apiBaseUrl,
        path: "/api/mobile/preferences",
        token: sessionToken,
        method: "POST",
        body: preferences,
      });
      const normalized: MobilePreferences = {
        targetLanguages: normalizeLanguageSelection(next.targetLanguages ?? []),
        interests: normalizeInterestSelection(next.interests ?? []),
        preferredLevel: next.preferredLevel ?? null,
        preferredRegion: next.preferredRegion ?? null,
        preferredVariant: next.preferredVariant ?? null,
        learningGoal: normalizeLearningGoal(next.learningGoal),
        journeyFocus:
          normalizeJourneyFocusPreference(next.journeyFocus) ??
          getJourneyFocusFromLearningGoal(normalizeLearningGoal(next.learningGoal)),
        dailyMinutes: normalizeDailyMinutes(next.dailyMinutes),
        remindersEnabled: normalizeRemindersEnabled(next.remindersEnabled),
        reminderHour: normalizeReminderHour(next.reminderHour),
        journeyPlacementLevel:
          typeof next.journeyPlacementLevel === "string" ? next.journeyPlacementLevel : null,
        onboardingSurveyCompletedAt:
          typeof next.onboardingSurveyCompletedAt === "string" ? next.onboardingSurveyCompletedAt : null,
        onboardingTourCompletedAt:
          typeof next.onboardingTourCompletedAt === "string" ? next.onboardingTourCompletedAt : null,
      };
      setPreferences(normalized);
      setSavedPreferences(normalized);
      setPreferencesStatus("saved");
      setPreferencesHint("Preferences saved.");
      const reminderState = await syncDailyReminderSchedule({
        enabled: normalized.remindersEnabled,
        hour: normalized.reminderHour,
        learningGoal: normalized.learningGoal,
        dailyMinutes: normalized.dailyMinutes,
        context:
          continueReading.length > 0
            ? {
                continueStoryTitle: continueReading[0]?.story.title,
                continueBookTitle: continueReading[0]?.book.title,
                continueBookSlug: continueReading[0]?.book.slug,
                continueStorySlug: continueReading[0]?.story.slug,
              }
            : dueFavoritesCount > 0
              ? { dueReviewCount: dueFavoritesCount }
              : activeJourneyPrimaryAction
                ? {
                    journeyActionTitle: activeJourneyPrimaryAction.title,
                    journeyActionBody: activeJourneyPrimaryAction.body,
                  }
                : null,
        activeToday: hasDailyLoopActivityToday,
        requestPermissions: normalized.remindersEnabled,
      });
      setReminderHint(reminderState.message);
      if (reminderState.status === "scheduled") {
        const reminderTarget = buildDailyReminderCopy({
          learningGoal: normalized.learningGoal,
          dailyMinutes: normalized.dailyMinutes,
          context:
            continueReading.length > 0
              ? {
                  continueStoryTitle: continueReading[0]?.story.title,
                  continueBookTitle: continueReading[0]?.book.title,
                  continueBookSlug: continueReading[0]?.book.slug,
                  continueStorySlug: continueReading[0]?.story.slug,
                }
              : dueFavoritesCount > 0
                ? { dueReviewCount: dueFavoritesCount }
                : activeJourneyPrimaryAction
                  ? {
                      journeyActionTitle: activeJourneyPrimaryAction.title,
                      journeyActionBody: activeJourneyPrimaryAction.body,
                    }
                  : null,
        }).target;
        void trackReminderMetric("reminder_scheduled", {
          targetKind: reminderTarget.kind,
          activeToday: hasDailyLoopActivityToday,
          scheduledFor: reminderState.scheduledFor,
          reminderHour: normalized.reminderHour,
        });
      }
      setRemoteEntitlement((current) =>
        current
          ? {
              ...current,
              targetLanguages: normalized.targetLanguages,
              interests: normalized.interests,
            }
          : current
      );
    } catch (error) {
      if (isApiErrorStatus(error, 401)) {
        handleUnauthorizedSession();
        return;
      }
      setPreferencesStatus("error");
      setPreferencesHint(error instanceof Error ? error.message : "Could not save settings.");
    }
  }

  async function saveOnboardingPreferences(payload: Partial<MobilePreferences>) {
    if (!sessionToken) {
      setOnboardingError("Sign in to save onboarding.");
      return false;
    }

    try {
      setPreferencesLoading(true);
      setOnboardingError(null);
      const next = await apiFetch<MobilePreferences>({
        baseUrl: mobileConfig.apiBaseUrl,
        path: "/api/mobile/preferences",
        token: sessionToken,
        method: "POST",
        body: payload,
      });
      const normalized: MobilePreferences = {
        targetLanguages: normalizeLanguageSelection(next.targetLanguages ?? []),
        interests: normalizeInterestSelection(next.interests ?? []),
        preferredLevel: next.preferredLevel ?? null,
        preferredRegion: next.preferredRegion ?? null,
        preferredVariant: next.preferredVariant ?? null,
        learningGoal: normalizeLearningGoal(next.learningGoal),
        journeyFocus:
          normalizeJourneyFocusPreference(next.journeyFocus) ??
          getJourneyFocusFromLearningGoal(normalizeLearningGoal(next.learningGoal)),
        dailyMinutes: normalizeDailyMinutes(next.dailyMinutes),
        remindersEnabled: normalizeRemindersEnabled(next.remindersEnabled),
        reminderHour: normalizeReminderHour(next.reminderHour),
        journeyPlacementLevel:
          typeof next.journeyPlacementLevel === "string" ? next.journeyPlacementLevel : null,
        onboardingSurveyCompletedAt:
          typeof next.onboardingSurveyCompletedAt === "string" ? next.onboardingSurveyCompletedAt : null,
        onboardingTourCompletedAt:
          typeof next.onboardingTourCompletedAt === "string" ? next.onboardingTourCompletedAt : null,
      };
      setPreferences(normalized);
      setSavedPreferences(normalized);
      return true;
    } catch (error) {
      if (isApiErrorStatus(error, 401)) {
        handleUnauthorizedSession();
        return false;
      }
      setOnboardingError(error instanceof Error ? error.message : "Could not save onboarding.");
      return false;
    } finally {
      setPreferencesLoading(false);
    }
  }

  function togglePreferenceLanguage(language: string) {
    setPreferences((current) => {
      const nextLanguages = current.targetLanguages.includes(language)
        ? current.targetLanguages.filter((item) => item !== language)
        : [...current.targetLanguages, language];
      const next = { ...current, targetLanguages: normalizeLanguageSelection(nextLanguages) };
      if (
        next.preferredVariant &&
        !((VARIANT_OPTIONS_BY_LANGUAGE[(next.targetLanguages[0] ?? "").toLowerCase()] ?? []).some(
          (option) => option.value === next.preferredVariant
        ))
      ) {
        next.preferredVariant = null;
      }
      return next;
    });
    setPreferencesStatus("idle");
  }

  function togglePreferenceInterest(interest: string) {
    setPreferences((current) => {
      const exists = current.interests.some((item) => item.toLowerCase() === interest.toLowerCase());
      const nextInterests = exists
        ? current.interests.filter((item) => item.toLowerCase() !== interest.toLowerCase())
        : [...current.interests, interest];
      return {
        ...current,
        interests: normalizeInterestSelection(nextInterests),
      };
    });
    setPreferencesStatus("idle");
  }

  function addCustomInterest() {
    const cleaned = customInterestInput.trim().replace(/\s+/g, " ");
    if (!cleaned) return;
    togglePreferenceInterest(cleaned);
    setCustomInterestInput("");
  }

  async function downloadStoryOffline(book: Book, story: Story) {
    if (!canDownloadOffline) {
      void openWebPath("/plans");
      return;
    }
    setOfflineStoryIdInFlight(story.id);
    try {
      const nextSnapshot = await saveStoryOffline(PREVIEW_OFFLINE_USER_ID, book, story);
      setOfflineSnapshot(nextSnapshot);
    } finally {
      setOfflineStoryIdInFlight(null);
    }
  }

  async function downloadJourneyStoryOffline(story: MobileJourneyTopicSummary["stories"][number]) {
    if (!canDownloadOffline) {
      void openWebPath("/plans");
      return;
    }
    if (!story.storySlug) return;
    setOfflineStoryIdInFlight(story.id);
    try {
      const payload = await apiFetch<{ stories?: MobileStandaloneStory[] }>({
        baseUrl: mobileConfig.apiBaseUrl,
        path: `/api/standalone-stories?slugs=${encodeURIComponent(story.storySlug)}`,
        token: sessionToken,
        timeoutMs: 15000,
      });
      const standalone = payload.stories?.[0];
      if (!standalone) return;
      const nextSnapshot = await saveStandaloneStoryOffline(PREVIEW_OFFLINE_USER_ID, standalone);
      setOfflineSnapshot(nextSnapshot);
    } catch (error) {
      console.error("[mobile journey] failed to download journey story offline", error);
    } finally {
      setOfflineStoryIdInFlight(null);
    }
  }

  async function removeStoryFromOffline(story: Story | { id: string }) {
    setOfflineStoryIdInFlight(story.id);
    try {
      const nextSnapshot = await removeStoryOffline(PREVIEW_OFFLINE_USER_ID, story.id);
      setOfflineSnapshot(nextSnapshot);
    } finally {
      setOfflineStoryIdInFlight(null);
    }
  }

  async function toggleFavoriteWord(item: VocabItem, contextSentence?: string) {
    if (!selection) return;

    const favorite: MobileFavoriteItem = {
      word: item.word,
      translation: item.definition ?? "",
      wordType: item.type ?? null,
      exampleSentence: contextSentence ?? null,
      storySlug: selection.story.id,
      storyTitle: selection.story.title,
      sourcePath: `/books/${selection.book.slug}/${selection.story.slug}`,
      language: selection.story.language ?? selection.book.language,
    };
    const identity = buildFavoriteIdentity(favorite);
    const exists = favoriteWordsByKey.has(identity);
    const nextItems = exists
      ? favoriteWords.filter((entry) => buildFavoriteIdentity(entry) !== identity)
      : [...favoriteWords, favorite];

    setFavoriteWords(nextItems);
    await saveLocalFavorites(sessionUserId, nextItems);

    if (sessionToken) {
      try {
        if (exists) {
          await removeFavoriteOnServer(sessionToken, favorite.word);
        } else {
          await addFavoriteOnServer(sessionToken, favorite);
        }
      } catch {
        // keep optimistic state
      }
    }
  }

  async function saveFavoriteItem(item: MobileFavoriteItem) {
    const identity = buildFavoriteIdentity(item);
    if (favoriteWordsByKey.has(identity)) return;
    const nextItems = [...favoriteWords, item];
    setFavoriteWords(nextItems);
    await saveLocalFavorites(sessionUserId, nextItems);

    if (sessionToken) {
      try {
        await addFavoriteOnServer(sessionToken, item);
      } catch {
        // keep optimistic state
      }
    }
  }

  async function removeFavoriteItem(item: MobileFavoriteItem) {
    const identity = buildFavoriteIdentity(item);
    const nextItems = favoriteWords.filter((entry) => buildFavoriteIdentity(entry) !== identity);
    setFavoriteWords(nextItems);
    await saveLocalFavorites(sessionUserId, nextItems);

    if (sessionToken) {
      try {
        await removeFavoriteOnServer(sessionToken, item.word);
      } catch {
        // keep optimistic state
      }
    }
  }

  function isFavoriteWord(word: string) {
    const normalized = normalizeFavoriteWord(word);
    return favoriteWords.some((item) => normalizeFavoriteWord(item.word) === normalized);
  }

  async function openWebPath(path: string) {
    const url = new URL(path, mobileConfig.apiBaseUrl);
    await WebBrowser.openBrowserAsync(url.toString());
    setMenuOpen(false);
  }

  function openJourneyTopicInExplore(args: {
    topicLabel: string;
    trackId?: string | null;
  }) {
    setSelectedExploreLanguage(remoteJourney?.language || settingsPrimaryLanguage || "All");
    setSelectedExploreTopic(args.topicLabel || "All");
    if (args.trackId) {
      const regionFromTrack = formatVariantLabel(args.trackId) ?? args.trackId;
      setSelectedExploreRegion(regionFromTrack || "All");
    }
    setActiveScreen("explore");
  }

  async function openJourneyStory(story: MobileJourneyTopicSummary["stories"][number]) {
    if (!story.storySlug) return;

    // Use locally cached version if available
    const offlineCopy = offlineSnapshot?.stories.find((s) => s.storySlug === story.storySlug);
    if (offlineCopy?.text) {
      const standalone: MobileStandaloneStory = {
        id: offlineCopy.storyId,
        slug: offlineCopy.storySlug ?? story.storySlug,
        title: offlineCopy.title,
        text: offlineCopy.text,
        language: offlineCopy.language ?? null,
        variant: offlineCopy.variant ?? null,
        region: offlineCopy.region ?? null,
        level: offlineCopy.level ?? null,
        cefrLevel: offlineCopy.cefrLevel ?? null,
        topic: offlineCopy.topic ?? null,
        coverUrl: offlineCopy.localCoverUri ?? offlineCopy.coverUrl ?? null,
        audioUrl: offlineCopy.localAudioUri ?? offlineCopy.audioUrl ?? null,
      };
      openSelection(createSelectionFromStandaloneStory(standalone));
      return;
    }

    try {
      const payload = await apiFetch<{ stories?: MobileStandaloneStory[] }>({
        baseUrl: mobileConfig.apiBaseUrl,
        path: `/api/standalone-stories?slugs=${encodeURIComponent(story.storySlug)}`,
        token: sessionToken,
        timeoutMs: 15000,
      });
      const standalone = payload.stories?.[0];
      if (!standalone) return;
      openSelection(createSelectionFromStandaloneStory(standalone));
    } catch (error) {
      console.error("[mobile journey] failed to open journey story", error);
    }
  }

  function buildJourneyMilestoneFromPayload(
    previousPayload: MobileJourneyPayload | null,
    nextPayload: MobileJourneyPayload,
    context: {
      variantId?: string | null;
      levelId: string;
      topicId: string;
      kind: "topic" | "checkpoint";
      topicLabel?: string | null;
    }
  ): JourneyMilestone | null {
    const track =
      nextPayload.tracks.find((entry) => entry.id === (context.variantId ?? entry.id)) ??
      nextPayload.tracks[0] ??
      null;
    if (!track) return null;
    const level = track.levels.find((entry) => entry.id === context.levelId) ?? null;
    const topic = level?.topics.find((entry) => entry.slug === context.topicId) ?? null;
    if (!level || !topic) return null;

    const previousTrack =
      previousPayload?.tracks.find((entry) => entry.id === track.id) ??
      previousPayload?.tracks[0] ??
      null;
    const previousLevel = previousTrack?.levels.find((entry) => entry.id === context.levelId) ?? null;
    const previousTopic = previousLevel?.topics.find((entry) => entry.slug === context.topicId) ?? null;

    if (context.kind === "checkpoint" && topic.checkpointPassed && !previousTopic?.checkpointPassed) {
      const currentIndex = level.topics.findIndex((entry) => entry.slug === topic.slug);
      const nextTopic = currentIndex >= 0 ? level.topics.slice(currentIndex + 1).find((entry) => entry.unlocked && entry.storyCount > 0) ?? null : null;
      if (nextTopic) {
        return {
          title: "Checkpoint cleared",
          body: `${nextTopic.label} is now unlocked. Keep the journey moving.`,
          cta: "Open next topic",
          onPress: () => {
            setActiveScreen("journey");
            setSelectedJourneyLevelId(level.id);
            setSelectedJourneyTopicId(nextTopic.slug);
            setJourneyDetailTopicId(nextTopic.slug);
            setJourneyMilestone(null);
          },
        };
      }

      const nextLevel = track.levels.find((entry, index) => index > track.levels.findIndex((candidate) => candidate.id === level.id) && entry.unlocked) ?? null;
      if (nextLevel) {
        return {
          title: "Level unlocked",
          body: `${nextLevel.title} is open. You cleared the checkpoint for ${topic.label}.`,
          cta: "Open level",
          onPress: () => {
            setActiveScreen("journey");
            setSelectedJourneyLevelId(nextLevel.id);
            setJourneyDetailTopicId(null);
            setJourneyMilestone(null);
          },
        };
      }

      return {
        title: "Checkpoint cleared",
        body: `${topic.label} is fully cleared.`,
        cta: "Back to map",
        onPress: () => {
          setActiveScreen("journey");
          setJourneyDetailTopicId(null);
          setJourneyMilestone(null);
        },
      };
    }

    if (context.kind === "topic" && topic.practiced && !previousTopic?.practiced) {
      return {
        title: "Practice locked in",
        body: topic.checkpointPassed
          ? `${topic.label} is already cleared. Jump into the next topic.`
          : `${topic.label} is ready for its checkpoint now.`,
        cta: topic.checkpointPassed ? "Back to map" : "Start checkpoint",
        onPress: () => {
          setActiveScreen("journey");
          if (!topic.checkpointPassed) {
            void openJourneyPractice({
              variantId: track.id,
              levelId: level.id,
              topicId: topic.slug,
              topicLabel: topic.label,
              kind: "checkpoint",
            });
          } else {
            setSelectedJourneyLevelId(level.id);
            setSelectedJourneyTopicId(topic.slug);
            setJourneyDetailTopicId(topic.slug);
          }
          setJourneyMilestone(null);
        },
      };
    }

    return null;
  }

  async function openBillingPortal() {
    if (!sessionToken) {
      onRequestSignIn?.();
      return;
    }

    try {
      const payload = await apiFetch<{ url?: string; fallbackUrl?: string; error?: string }>({
        baseUrl: mobileConfig.apiBaseUrl,
        path: "/api/stripe/portal",
        token: sessionToken,
        method: "POST",
        timeoutMs: 20000,
      });

      if (payload.url) {
        await WebBrowser.openBrowserAsync(payload.url);
        setMenuOpen(false);
        return;
      }

      if (payload.fallbackUrl) {
        await openWebPath(payload.fallbackUrl);
        return;
      }

      throw new Error(payload.error || "Could not open billing portal.");
    } catch {
      await openWebPath("/settings");
    }
  }

  async function openCreateWithPrefill() {
    const url = new URL("/create", mobileConfig.apiBaseUrl);
    const primaryLanguage = preferences.targetLanguages[0] ?? sessionTargetLanguages?.[0] ?? "";
    const level = preferences.preferredLevel ?? "";
    const region = preferences.preferredRegion ?? "";
    const interest = getDefaultCreateTopic(SUGGESTED_INTERESTS, preferences.interests, preferences.learningGoal) ?? preferences.interests[0] ?? "";
    const focus = getCreateFocusForGoal(preferences.learningGoal);

    if (primaryLanguage) url.searchParams.set("language", primaryLanguage);
    if (level) url.searchParams.set("level", level);
    if (region) url.searchParams.set("region", region);
    if (interest) url.searchParams.set("topic", interest);
    if (focus) url.searchParams.set("focus", focus);

    await WebBrowser.openBrowserAsync(url.toString());
    setMenuOpen(false);
  }

  function syncCreatedStoryState(
    nextStory: MobileCreatedStory,
    options?: {
      notice?: string | null;
      pendingPayload?: {
        language: string;
        variant?: string;
        region?: string;
        level: string;
        cefrLevel: string;
        focus: string;
        topic: string;
      } | null;
    }
  ) {
    setCreatedStory(nextStory);
    if (options && "notice" in options) {
      setCreateResumeNotice(options.notice ?? null);
    }

    if (nextStory.audioStatus === "failed") {
      setCreateStatus("audio_failed");
      void clearPendingCreate(sessionUserId);
      return;
    }

    if (isCreateAudioReady(nextStory)) {
      setCreateStatus("ready");
      void clearPendingCreate(sessionUserId);
      return;
    }

    setCreateStatus("generating_audio");
    void savePendingCreate(sessionUserId, {
      startedAt: Date.now(),
      storyId: nextStory.id,
      lastKnownStory: nextStory,
      payload: options?.pendingPayload ?? null,
    });
  }

  async function refreshCreatedStory(storyId: string, options?: { silent?: boolean; notice?: string | null }) {
    try {
      const payload = await apiFetch<{ story?: MobileCreatedStory | null }>({
        baseUrl: mobileConfig.apiBaseUrl,
        path: `/api/user-stories?id=${encodeURIComponent(storyId)}`,
        token: sessionToken,
        timeoutMs: 15000,
      });

      if (payload.story) {
        syncCreatedStoryState(payload.story, { notice: options?.notice });
        return payload.story;
      }
    } catch {
      if (!options?.silent) {
        setCreateError("Could not refresh the generated story yet.");
      }
    }

    return null;
  }

  useEffect(() => {
    if (!sessionToken) {
      setCreateResumeChecked(true);
      setCreateResumeNotice(null);
      setShowCreateComeBackLater(false);
      return;
    }

    let cancelled = false;

    async function hydratePendingCreatedStory() {
      setCreateResumeChecked(false);

      const pending = await loadPendingCreate(sessionUserId);
      if (cancelled) return;

      if (!pending) {
        setCreateResumeChecked(true);
        return;
      }

      if (Date.now() - pending.startedAt > CREATE_PENDING_TTL_MS) {
        await clearPendingCreate(sessionUserId);
        if (!cancelled) {
          setCreateResumeChecked(true);
          setCreateResumeNotice(null);
        }
        return;
      }

      if (pending.lastKnownStory) {
        setCreatedStory(pending.lastKnownStory);
      }

      if (!pending.storyId) {
        if (pending.payload) {
          try {
            const params = new URLSearchParams({
              mine: "1",
              latestForCreate: "1",
              language: pending.payload.language,
              cefrLevel: pending.payload.cefrLevel,
              level: pending.payload.level,
              focus: pending.payload.focus,
              topic: pending.payload.topic,
              since: String(pending.startedAt),
            });
            if (pending.payload.region) params.set("region", pending.payload.region);
            if (pending.payload.variant) params.set("variant", pending.payload.variant);
            const payload = await apiFetch<{ story?: MobileCreatedStory | null }>({
              baseUrl: mobileConfig.apiBaseUrl,
              path: `/api/user-stories?${params.toString()}`,
              token: sessionToken,
              timeoutMs: 15000,
            });
            if (payload.story && !cancelled) {
              syncCreatedStoryState(payload.story, {
                notice:
                  payload.story.audioStatus === "pending"
                    ? "Recovered the story you started creating."
                    : "Recovered your last generated story.",
                pendingPayload: pending.payload,
              });
            }
          } catch {
            // fall through to local restore copy
          }
        }
        setCreateStatus((current) => (current === "generating_audio" || current === "ready" ? current : "idle"));
        setCreateResumeChecked(true);
        setCreateResumeNotice((current) => current ?? "Previous create draft was restored.");
        return;
      }

      setCreateResumeNotice("Resuming your last generated story...");
      const refreshed = await refreshCreatedStory(pending.storyId, {
        silent: true,
        notice: "Resumed your last generated story.",
      });

      if (!cancelled) {
        if (!refreshed && pending.lastKnownStory) {
          syncCreatedStoryState(pending.lastKnownStory, {
            notice:
              pending.lastKnownStory.audioStatus === "pending"
                ? "Audio is still being prepared. You can keep reading now."
                : "Resumed your last generated story.",
          });
        }
        setCreateResumeChecked(true);
      }
    }

    void hydratePendingCreatedStory();
    return () => {
      cancelled = true;
    };
  }, [sessionToken, sessionUserId]);

  useEffect(() => {
    if (createStatus !== "generating_audio") {
      setShowCreateComeBackLater(false);
      return;
    }

    const timer = setTimeout(() => {
      setShowCreateComeBackLater(true);
    }, CREATE_AUDIO_COME_BACK_LATER_MS);

    return () => clearTimeout(timer);
  }, [createStatus]);

  useEffect(() => {
    if (
      activeScreen !== "create" ||
      createStatus !== "generating_audio" ||
      !createdStory?.id ||
      !sessionToken
    ) {
      return;
    }

    let cancelled = false;
    const interval = setInterval(() => {
      if (cancelled) return;
      void refreshCreatedStory(createdStory.id, { silent: true });
    }, CREATE_AUDIO_REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [activeScreen, createStatus, createdStory?.id, sessionToken]);

  useEffect(() => {
    if (activeScreen !== "create" || !sessionToken) {
      if (!sessionToken) setCreatedStoryHistory([]);
      return;
    }

    let cancelled = false;

    async function hydrateCreateHistory() {
      try {
        const payload = await apiFetch<{ stories?: MobileCreatedStory[] }>({
          baseUrl: mobileConfig.apiBaseUrl,
          path: "/api/user-stories?mine=1&limit=6",
          token: sessionToken,
          timeoutMs: 15000,
        });
        if (!cancelled) {
          setCreatedStoryHistory(Array.isArray(payload.stories) ? payload.stories : []);
        }
      } catch {
        if (!cancelled) {
          setCreatedStoryHistory([]);
        }
      }
    }

    void hydrateCreateHistory();
    return () => {
      cancelled = true;
    };
  }, [activeScreen, sessionToken, createStatus]);

  async function generateStoryOnIPhone() {
    if (!isSignedIn) {
      onRequestSignIn?.();
      return;
    }

    if (effectivePlan !== "polyglot") {
      await openWebPath("/plans");
      return;
    }

    const language = settingsPrimaryLanguage || sessionTargetLanguages?.[0] || "Spanish";
    const level = preferences.preferredLevel || "Intermediate";
    const variant = preferences.preferredVariant || undefined;
    const region = preferences.preferredRegion || "";
    const topic =
      getDefaultCreateTopic(SUGGESTED_INTERESTS, preferences.interests, preferences.learningGoal) ||
      preferences.interests[0] ||
      "Daily life";
    const focus = getCreateFocusForGoal(preferences.learningGoal);
    const createPayload = {
      language,
      variant,
      region,
      level: level.toLowerCase(),
      cefrLevel: defaultCefrForLevel(level),
      focus,
      topic,
    };

    setCreateStatus("generating_text");
    setCreateError(null);
    setCreateResumeNotice(null);
    setCreatedStory(null);
    setShowCreateComeBackLater(false);
    void savePendingCreate(sessionUserId, {
      startedAt: Date.now(),
      storyId: null,
      lastKnownStory: null,
      payload: createPayload,
    });

    try {
      const payload = await apiFetch<{ story?: MobileCreatedStory; error?: string }>({
        baseUrl: mobileConfig.apiBaseUrl,
        path: "/api/user/generate-story",
        token: sessionToken,
        method: "POST",
        timeoutMs: 120000,
        body: createPayload,
      });

      if (!payload.story) {
        throw new Error("Create did not return a story.");
      }

      syncCreatedStoryState(payload.story, {
        notice:
          payload.story.audioStatus === "pending"
            ? "Story text is ready. Audio is still being prepared."
            : "Your story is ready.",
        pendingPayload: createPayload,
      });
      setCreateError(null);
    } catch (error) {
      setCreateStatus("error");
      setCreateError(error instanceof Error ? error.message : "Could not generate the story from iPhone.");
      void clearPendingCreate(sessionUserId);
    }
  }

  async function openPracticeMode(
    mode: PracticeModeKey,
    review = false,
    overrideItems?: PracticeFavoriteItem[] | null,
    favoriteKind?: "due" | "all" | "related"
  ) {
    if (!isSignedIn) {
      onRequestSignIn?.();
      return;
    }
    getOptionalSpeechModule()?.stop();
    setSpeakingPracticePromptId(null);
    const sourceItems = overrideItems ?? practiceSeedItems ?? buildPracticeFavorites(favoriteWords);
    const exercises = buildPracticeExercisesFromItems(sourceItems, mode, review, onboardingPracticePrefs);
    if (exercises.length === 0) return;
    setPracticeSeedItems(sourceItems);
    setPracticeLaunchContext((current) => ({
      source: "favorites",
      kind: favoriteKind ?? (current.source === "favorites" ? current.kind : undefined),
    }));
    setActivePracticeMode(mode);
    setPracticeLoadError(null);
    setPracticeExercises(exercises);
    setPracticeIndex(0);
    setPracticeScore(0);
    setPracticeSelectedOption(null);
    setPracticeRevealed(false);
    setPracticeComplete(false);
    setPracticeLastResult(null);
    setPracticeSessionStreak(0);
    setPracticeReviewScores({});
    setPracticeCheckpointToken(null);
    setPracticeCheckpointResponses({});
    setPracticeCheckpointSaveState("idle");
    setPracticeJourneyReviewMeta(null);
    setActiveMatchWord(null);
    setMatchedWords([]);
    setLastPracticeActivityAt(new Date().toISOString());
    setMenuOpen(false);
  }

  async function openStoryPractice(selection: ReaderSelection) {
    if (!sessionToken) {
      onRequestSignIn?.();
      return;
    }

    try {
      const params = new URLSearchParams({
        storySlug: selection.story.slug,
      });

      if (selection.book.slug && !selection.book.slug.startsWith("generated-book-")) {
        params.set("bookSlug", selection.book.slug);
      }

      const payload = await apiFetch<{ items: PracticeFavoriteItem[] }>({
        baseUrl: mobileConfig.apiBaseUrl,
        path: `/api/story-practice?${params.toString()}`,
        token: sessionToken,
      });

      const items = Array.isArray(payload.items) ? payload.items : [];
      const exercises = buildPracticeExercisesFromItems(items, "context", false, onboardingPracticePrefs);
      if (exercises.length === 0) {
        setPracticeLoadError("This story does not have practice items yet.");
        setActiveScreen("practice");
        setSelection(null);
        return;
      }

      getOptionalSpeechModule()?.stop();
      setSpeakingPracticePromptId(null);
      setPracticeSeedItems(items);
      setPracticeLaunchContext({
        source: "story",
        storySlug: selection.story.slug,
        bookSlug: selection.book.slug ?? null,
        storyTitle: selection.story.title,
      });
      setPracticeReturnSelection(selection);
      setPracticeLoadError(null);
      setActivePracticeMode("context");
      setPracticeExercises(exercises);
      setPracticeIndex(0);
      setPracticeScore(0);
      setPracticeSelectedOption(null);
      setPracticeRevealed(false);
      setPracticeComplete(false);
      setPracticeLastResult(null);
      setPracticeSessionStreak(0);
      setPracticeReviewScores({});
      setPracticeCheckpointToken(null);
      setPracticeCheckpointResponses({});
      setPracticeCheckpointSaveState("idle");
      setPracticeJourneyReviewMeta(null);
      setActiveMatchWord(null);
      setMatchedWords([]);
      setSelection(null);
      setActiveScreen("practice");
    } catch (error) {
      setPracticeSeedItems(null);
      setPracticeLoadError(error instanceof Error ? error.message : "Could not load story practice.");
      setActiveScreen("practice");
      setSelection(null);
    }
  }

  const recentCreatedStories = useMemo(() => {
    const merged = [...(createdStory ? [createdStory] : []), ...createdStoryHistory];
    return merged.filter((story, index, items) => items.findIndex((candidate) => candidate.id === story.id) === index);
  }, [createdStory, createdStoryHistory]);

  async function openJourneyPractice(args: {
    variantId?: string | null;
    levelId: string;
    topicId: string;
    topicLabel?: string | null;
    kind?: "topic" | "checkpoint";
    review?: boolean;
  }) {
    if (!sessionToken) {
      onRequestSignIn?.();
      return;
    }

    try {
      const params = new URLSearchParams({
        levelId: args.levelId,
        topicId: args.topicId,
      });
      if (args.variantId) {
        params.set("variant", args.variantId);
      }
      if (args.kind === "checkpoint") {
        params.set("kind", "checkpoint");
      }

      const payload = await apiFetch<{
        items?: PracticeFavoriteItem[];
        exercises?: import("../../../../src/lib/practiceExercises").PracticeExercise[];
        checkpointToken?: string;
        review?: JourneyReviewMeta | null;
      }>({
        baseUrl: mobileConfig.apiBaseUrl,
        path: `/api/journey/practice?${params.toString()}`,
        token: sessionToken,
      });

      const items = Array.isArray(payload.items) ? payload.items : [];
      const reviewMeta = payload.review && typeof payload.review === "object" ? payload.review : null;
      const defaultMode =
        args.kind === "checkpoint"
          ? "context"
          : args.review
            ? getRecommendedPracticeModeFromItems(items)
            : "context";
      const exercises =
        args.kind === "checkpoint" && Array.isArray(payload.exercises) && payload.exercises.length > 0
          ? payload.exercises.map(mapSharedExerciseToMobile)
          : buildPracticeExercisesFromItems(items, defaultMode, true, onboardingPracticePrefs);
      if (exercises.length === 0) {
        setPracticeLoadError("This journey topic is not ready for practice yet.");
        setActiveScreen("practice");
        return;
      }

      getOptionalSpeechModule()?.stop();
      setSpeakingPracticePromptId(null);
      setPracticeSeedItems(items);
      setPracticeLaunchContext({
        source: "journey",
        variantId: args.variantId,
        levelId: args.levelId,
        topicId: args.topicId,
        kind: args.kind ?? "topic",
        reviewFocus: Boolean(args.review),
        reviewDueCount: reviewMeta?.dueCount ?? 0,
        focusWords: Array.isArray(reviewMeta?.focusWords) ? reviewMeta.focusWords : [],
        topicLabel:
          args.kind === "checkpoint"
            ? `${args.topicLabel ?? "Topic"} checkpoint`
            : args.topicLabel ?? null,
      });
      setPracticeReturnSelection(null);
      setPracticeLoadError(null);
      setActivePracticeMode("context");
      setPracticeExercises(exercises);
      setPracticeIndex(0);
      setPracticeScore(0);
      setPracticeSelectedOption(null);
      setPracticeRevealed(false);
      setPracticeComplete(false);
      setPracticeLastResult(null);
      setPracticeSessionStreak(0);
      setPracticeReviewScores({});
      setPracticeCheckpointToken(
        args.kind === "checkpoint" && typeof payload.checkpointToken === "string"
          ? payload.checkpointToken
          : null
      );
      setPracticeCheckpointResponses({});
      setPracticeCheckpointSaveState("idle");
      setPracticeJourneyReviewMeta(reviewMeta);
      setActiveMatchWord(null);
      setMatchedWords([]);
      setActiveScreen("practice");
    } catch (error) {
      setPracticeSeedItems(null);
      setPracticeLoadError(error instanceof Error ? error.message : "Could not load journey practice.");
      setActiveScreen("practice");
    }
  }

  function closePracticeSession() {
    getOptionalSpeechModule()?.stop();
    setSpeakingPracticePromptId(null);
    setActivePracticeMode(null);
    if (practiceLaunchContext.source === "story" && practiceReturnSelection) {
      setSelection(practiceReturnSelection);
    } else if (practiceLaunchContext.source === "journey") {
      setActiveScreen("journey");
    }
    setPracticeSeedItems(null);
    setPracticeLaunchContext({ source: "favorites" });
    setPracticeReturnSelection(null);
    setPracticeExercises([]);
    setPracticeIndex(0);
    setPracticeScore(0);
    setPracticeSelectedOption(null);
    setPracticeRevealed(false);
    setPracticeComplete(false);
    setPracticeLastResult(null);
    setPracticeSessionStreak(0);
    setPracticeReviewScores({});
    setPracticeCheckpointToken(null);
    setPracticeCheckpointResponses({});
    setPracticeCheckpointSaveState("idle");
    setPracticeJourneyReviewMeta(null);
    setActiveMatchWord(null);
    setMatchedWords([]);
  }

  function advancePractice() {
    void stopPracticeContextClip();
    getOptionalSpeechModule()?.stop();
    setSpeakingPracticePromptId(null);
    if (practiceIndex >= practiceExercises.length - 1) {
      setPracticeComplete(true);
      setPracticeRevealed(false);
      setPracticeSelectedOption(null);
      setActiveMatchWord(null);
      setMatchedWords([]);
      return;
    }

    setPracticeIndex((current) => current + 1);
    setPracticeSelectedOption(null);
    setPracticeRevealed(false);
    setPracticeLastResult(null);
    setActiveMatchWord(null);
    setMatchedWords([]);
  }

  function choosePracticeOption(option: string) {
    if (practiceRevealed || practiceComplete) return;
    const current = practiceExercises[practiceIndex];
    if (!current || current.kind !== "multiple-choice") return;
    setPracticeSelectedOption(option);
  }

  async function playPracticeFeedbackSound(correct: boolean) {
    try {
      const prev = practiceFeedbackSoundRef.current;
      if (prev) {
        practiceFeedbackSoundRef.current = null;
        await prev.stopAsync().catch(() => undefined);
        await prev.unloadAsync().catch(() => undefined);
      }
      const { sound } = await Audio.Sound.createAsync(
        { uri: correct ? PRACTICE_CORRECT_SOUND_URI : PRACTICE_WRONG_SOUND_URI },
        { shouldPlay: true, volume: 0.8 }
      );
      practiceFeedbackSoundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status) => {
        if ("didJustFinish" in status && status.didJustFinish) {
          practiceFeedbackSoundRef.current = null;
          void sound.unloadAsync().catch(() => undefined);
        }
      });
    } catch {
      // Sound is best-effort
    }
  }

  function checkPracticeAnswer() {
    if (practiceRevealed || practiceComplete) return;
    const current = practiceExercises[practiceIndex];
    if (!current || current.kind !== "multiple-choice") return;
    if (!practiceSelectedOption) return;

    const option = practiceSelectedOption;
    setPracticeRevealed(true);
    setPracticeReviewScores((currentScores) => ({
      ...currentScores,
      [normalizePracticeWord(current.favorite.word)]: option === current.answer ? "good" : "again",
    }));
    if (practiceLaunchContext.source === "journey" && practiceLaunchContext.kind === "checkpoint") {
      setPracticeCheckpointResponses((currentResponses) => ({
        ...currentResponses,
        [current.id]: option,
      }));
    }
    if (option === current.answer) {
      setPracticeScore((value) => value + 1);
      setPracticeLastResult("correct");
      setPracticeSessionStreak((value) => value + 1);
    } else {
      setPracticeLastResult("wrong");
      setPracticeSessionStreak(0);
    }
    void playPracticeFeedbackSound(option === current.answer);
  }

  function playPracticePrompt() {
    if (!currentPracticeExercise || currentPracticeExercise.kind !== "multiple-choice") return;
    if (currentPracticeExercise.mode !== "listening") return;
    const speechText = currentPracticeExercise.speechText?.trim();
    if (!speechText) return;
    const Speech = getOptionalSpeechModule();
    if (!Speech) {
      setSpeakingPracticePromptId(null);
      return;
    }

    if (speakingPracticePromptId === currentPracticeExercise.id) {
      Speech.stop();
      setSpeakingPracticePromptId(null);
      return;
    }

    Speech.stop();
    setSpeakingPracticePromptId(currentPracticeExercise.id);
    Speech.speak(speechText, {
      language: getSpeechSynthesisLang(currentPracticeExercise.language),
      rate: 0.95,
      pitch: 1,
      onDone: () =>
        setSpeakingPracticePromptId((current) =>
          current === currentPracticeExercise.id ? null : current
        ),
      onStopped: () =>
        setSpeakingPracticePromptId((current) =>
          current === currentPracticeExercise.id ? null : current
        ),
      onError: () =>
        setSpeakingPracticePromptId((current) =>
          current === currentPracticeExercise.id ? null : current
        ),
    });
  }

  function resolvePracticeAudioUri(value: string | null | undefined): string | null {
    const trimmed = typeof value === "string" ? value.trim() : "";
    if (!trimmed) return null;
    try {
      return new URL(trimmed, mobileConfig.apiBaseUrl).toString();
    } catch {
      return trimmed;
    }
  }

  async function stopPracticeContextClip() {
    const sound = practiceClipSoundRef.current;
    practiceClipStopAtMillisRef.current = null;
    setPlayingPracticeClipId(null);
    if (!sound) return;
    practiceClipSoundRef.current = null;
    try {
      await sound.stopAsync();
    } catch {
      // ignore
    }
    try {
      await sound.unloadAsync();
    } catch {
      // ignore
    }
  }

  async function ensurePracticeClipStoryAudio(
    clip: PracticeAudioClip
  ): Promise<StoryAudioData | null> {
    const normalizedSlug = normalizeStorySlug(clip.storySlug);
    if (!normalizedSlug) return null;

    const cached =
      clip.storySource === "standalone"
        ? standaloneStoryAudioBySlug[normalizedSlug]
        : userStoryAudioBySlug[normalizedSlug];
    if (cached) return cached;

    try {
      if (clip.storySource === "standalone") {
        const payload = await apiFetch<{ stories?: Array<{ slug: string; audioUrl: string | null; audioSegments: unknown }> }>({
          baseUrl: mobileConfig.apiBaseUrl,
          path: `/api/standalone-story-audio?slugs=${encodeURIComponent(normalizedSlug)}`,
          token: sessionToken ?? undefined,
        });
        const story = payload.stories?.[0];
        if (!story) return null;
        const nextValue: StoryAudioData = {
          audioUrl: story.audioUrl,
          audioSegments: coerceAudioSegments(story.audioSegments),
        };
        setStandaloneStoryAudioBySlug((current) => ({ ...current, [normalizedSlug]: nextValue }));
        return nextValue;
      }

      const payload = await apiFetch<{ stories?: Array<{ slug: string; audioUrl: string | null; audioSegments: unknown }> }>({
        baseUrl: mobileConfig.apiBaseUrl,
        path: `/api/user-stories?slugs=${encodeURIComponent(normalizedSlug)}`,
        token: sessionToken ?? undefined,
      });
      const story = payload.stories?.[0];
      if (!story) return null;
      const nextValue: StoryAudioData = {
        audioUrl: story.audioUrl,
        audioSegments: coerceAudioSegments(story.audioSegments),
      };
      setUserStoryAudioBySlug((current) => ({ ...current, [normalizedSlug]: nextValue }));
      return nextValue;
    } catch (error) {
      console.error("[mobile practice] failed to load clip audio metadata", error);
      return null;
    }
  }

  async function playPracticeContextClip() {
    if (!currentPracticeExercise || currentPracticeExercise.kind !== "multiple-choice") return;
    const clip = currentPracticeExercise.audioClip;
    if (!clip) return;

    if (clip.storySource === "user") {
      const speechText = clip.sentence?.trim();
      const Speech = getOptionalSpeechModule();
      if (!speechText || !Speech) {
        setSpeakingPracticePromptId(null);
        return;
      }

      if (speakingPracticePromptId === currentPracticeExercise.id) {
        Speech.stop();
        setSpeakingPracticePromptId(null);
        return;
      }

      await stopPracticeContextClip();
      Speech.stop();
      setSpeakingPracticePromptId(currentPracticeExercise.id);
      Speech.speak(speechText, {
        language: getSpeechSynthesisLang(clip.language),
        rate: 0.92,
        pitch: 1,
        onDone: () =>
          setSpeakingPracticePromptId((current) =>
            current === currentPracticeExercise.id ? null : current
          ),
        onStopped: () =>
          setSpeakingPracticePromptId((current) =>
            current === currentPracticeExercise.id ? null : current
          ),
        onError: () =>
          setSpeakingPracticePromptId((current) =>
            current === currentPracticeExercise.id ? null : current
          ),
      });
      return;
    }

    if (playingPracticeClipId === currentPracticeExercise.id) {
      await stopPracticeContextClip();
      return;
    }

    const storyAudio = await ensurePracticeClipStoryAudio(clip);
    const segment = findSegmentForClip(storyAudio, clip);
    const baseAudioUrl = resolvePracticeAudioUri(storyAudio?.audioUrl);
    const segmentClipUrl = resolvePracticeAudioUri(segment?.clipUrl ?? null);
    const audioUrl = segmentClipUrl ?? baseAudioUrl;
    if (!audioUrl || !segment) return;

    await stopPracticeContextClip();
    getOptionalSpeechModule()?.stop();
    setSpeakingPracticePromptId(null);

    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        allowsRecordingIOS: false,
        interruptionModeIOS: InterruptionModeIOS.DoNotMix,
      });

      const shouldUseDirectClip = Boolean(segmentClipUrl);
      const rawStartSec = shouldUseDirectClip
        ? 0
        : Math.max(0, segment.startSec - CLIP_START_PADDING_SEC);
      const rawEndSec = shouldUseDirectClip
        ? Number.NaN
        : Math.max(rawStartSec + 0.2, segment.endSec - CLIP_END_TRIM_SEC);

      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true, positionMillis: Math.max(0, rawStartSec * 1000) },
        (status) => {
          const loaded = toClipPlaybackLoadedSnapshot(status);
          if (!loaded) {
            if ("didJustFinish" in status && status.didJustFinish) {
              void stopPracticeContextClip();
            }
            return;
          }
          const stopAt = practiceClipStopAtMillisRef.current;
          if (stopAt != null && loaded.positionMillis >= stopAt) {
            void stopPracticeContextClip();
          } else if ("didJustFinish" in status && status.didJustFinish) {
            void stopPracticeContextClip();
          }
        }
      );

      practiceClipSoundRef.current = sound;
      practiceClipStopAtMillisRef.current = shouldUseDirectClip ? null : rawEndSec * 1000;
      setPlayingPracticeClipId(currentPracticeExercise.id);
    } catch (error) {
      console.error("[mobile practice] exact clip playback failed", error);
      await stopPracticeContextClip();
    }
  }

  function chooseMatchValue(value: string) {
    if (practiceComplete) return;
    const current = practiceExercises[practiceIndex];
    if (!current || current.kind !== "match") return;
    if (!activeMatchWord) return;

    const pair = current.pairs.find((entry) => entry.word === activeMatchWord);
    if (!pair) return;
    if (pair.answer !== value) return;

    const nextMatched = [...matchedWords, activeMatchWord];
    setMatchedWords(nextMatched);
    setActiveMatchWord(null);

    if (nextMatched.length === current.pairs.length) {
      setPracticeScore((value) => value + 1);
      setPracticeRevealed(true);
      setPracticeLastResult("correct");
      setPracticeSessionStreak((value) => value + 1);
      setPracticeReviewScores((currentScores) => {
        const nextScores = { ...currentScores };
        for (const pair of current.pairs) {
          nextScores[normalizePracticeWord(pair.word)] = "good";
        }
        return nextScores;
      });
      void playPracticeFeedbackSound(true);
    }
  }

  async function openFeedback() {
    setMenuOpen(false);
    await Linking.openURL(
      "mailto:support@digitalpolyglot.com?subject=Digital%20Polyglot%20iOS%20Feedback"
    );
  }

  function getSpotlightSelection(): ReaderSelection | null {
    const firstBook = CATALOG_BOOKS[0];
    const firstStory = firstBook?.stories[0];
    if (!firstBook || !firstStory) return null;
    return resolveStorySelection(firstStory.id, firstBook, firstStory);
  }

  function handleBottomTabPress(tab: BottomTab) {
    if (tab === "signin") {
      onRequestSignIn?.();
      return;
    }
    setActiveScreen(tab);
  }

  function screenMatchesTab(tab: BottomTab): boolean {
    if (tab === "signin") return false;
    return activeScreen === tab;
  }

  const offlineReadyStoryCards = savedStoryCards.filter((item) =>
    offlineSnapshot?.stories.some((story) => story.storyId === item.key.replace(/^saved-/, ""))
  );
  const syncedOnlyStoryCards = remoteStoryCards.filter(
    (item) => !savedStoryIds.includes(item.key.replace(/^remote-/, ""))
  );
  const savedLibraryCards = savedStoryCards.length > 0 ? savedStoryCards : remoteStoryCards;

  const featuredHomeStory = useMemo(() => {
    const spotlight = getSpotlightSelection();
    if (!spotlight) return null;
    if (effectivePlan === "free") {
      return { label: "Story of the Week", selection: spotlight };
    }
    if (effectivePlan === "basic") {
      return { label: "Story of the Day", selection: spotlight };
    }
    return { label: "Featured Story", selection: spotlight };
  }, [effectivePlan]);

  const latestBookCards = useMemo(
    () =>
      [...CATALOG_BOOKS]
        .sort((a, b) => {
          const scoreBook = (book: Book) =>
            scoreTopicLabelAgainstOnboarding(
              [book.title, book.subtitle ?? "", book.description ?? "", formatTopic(book.topic)].join(" "),
              preferences.interests,
              preferences.learningGoal
            ) + scoreReadTimeFit(
              book.stories.length > 0
                ? Math.round(book.stories.reduce((sum, story) => sum + estimateReadMinutes(story.text), 0) / book.stories.length)
                : null,
              preferences.dailyMinutes
            );
          return scoreBook(b) - scoreBook(a) || a.title.localeCompare(b.title);
        })
        .slice(0, 6)
        .map((book) => ({
        key: `book-${book.id}`,
        title: book.title,
        coverUrl: getCoverUrl(book.cover),
        language: formatLanguage(book.language),
        region: formatRegion(book.region),
        level: book.level,
        statsLine: `${book.stories.length} stories`,
        topicsLine: formatTopic(book.topic),
        description: book.description ?? book.subtitle ?? undefined,
        onPress: () => {
          openBook(book);
        },
      })),
    [preferences.dailyMinutes, preferences.interests, preferences.learningGoal]
  );

  useEffect(() => {
    const urls = [
      ...latestBookCards.slice(0, 4).map((c) => c.coverUrl),
      ...continueReadingCards.slice(0, 3).map((c) => c.coverUrl),
    ].filter(Boolean);
    for (const url of urls) {
      Image.prefetch(url);
    }
  }, [latestBookCards, continueReadingCards]);

  const selectedBookContinueStory = useMemo(() => {
    if (!selectedBook) return null;
    const progressByStoryId = new Map(readingProgress.map((entry) => [entry.storyId, entry] as const));
    return (
      selectedBook.stories.find((story) => {
        const progress = progressByStoryId.get(story.id);
        return (progress?.progressRatio ?? 0) > 0.03;
      }) ?? null
    );
  }, [readingProgress, selectedBook]);

  const selectedBookVocabList = useMemo(() => {
    if (!selectedBook) return [];
    const map = new Map<string, { word: string; count: number }>();
    for (const story of selectedBook.stories) {
      for (const item of story.vocab ?? []) {
        const word = item.word?.trim();
        if (!word) continue;
        const key = word.toLowerCase();
        const prev = map.get(key);
        if (prev) prev.count += 1;
        else map.set(key, { word, count: 1 });
      }
    }
    return Array.from(map.values())
      .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
      .slice(0, 24);
  }, [selectedBook]);

  const selectedBookRelatedBooks = useMemo(() => {
    if (!selectedBook) return [];
    const currentLanguage = (selectedBook.language ?? "").trim().toLowerCase();
    const currentLevel = (selectedBook.level ?? "").trim().toLowerCase();
    const currentRegion = (selectedBook.region ?? "").trim().toLowerCase();
    const currentTopic = formatTopic(selectedBook.topic).trim().toLowerCase();

    return CATALOG_BOOKS
      .filter((candidate) => candidate.id !== selectedBook.id)
      .map((candidate) => {
        let score = 0;
        if ((candidate.language ?? "").trim().toLowerCase() === currentLanguage) score += 4;
        if ((candidate.level ?? "").trim().toLowerCase() === currentLevel) score += 2;
        if ((candidate.region ?? "").trim().toLowerCase() === currentRegion && currentRegion) score += 1;
        if (formatTopic(candidate.topic).trim().toLowerCase() === currentTopic && currentTopic) score += 3;
        return { candidate, score };
      })
      .filter((entry) => entry.score >= 4)
      .sort((a, b) => b.score - a.score || a.candidate.title.localeCompare(b.candidate.title))
      .slice(0, 6)
      .map((entry) => entry.candidate);
  }, [selectedBook]);

  const selectedBookSuggestedStories = useMemo(() => {
    if (!selectedBook) return [];
    const currentLanguage = (selectedBook.language ?? "").trim().toLowerCase();
    const currentLevel = (selectedBook.level ?? "").trim().toLowerCase();
    const currentTopic = formatTopic(selectedBook.topic).trim().toLowerCase();

    return CATALOG_BOOKS
      .filter((candidate) => candidate.id !== selectedBook.id)
      .flatMap((candidate) =>
        candidate.stories.map((story) => {
          let score = 0;
          const storyLanguage = (story.language ?? candidate.language ?? "").trim().toLowerCase();
          const storyLevel = (story.level ?? candidate.level ?? "").trim().toLowerCase();
          const storyTopic = formatTopic(story.topic ?? candidate.topic).trim().toLowerCase();
          if (storyLanguage === currentLanguage) score += 4;
          if (storyLevel === currentLevel) score += 2;
          if (storyTopic === currentTopic && currentTopic) score += 3;
          const resolved = resolveStorySelection(story.id, candidate, story);
          return resolved ? { score, resolved } : null;
        })
      )
      .filter((entry): entry is { score: number; resolved: ReaderSelection } => Boolean(entry && entry.score >= 5))
      .sort((a, b) => b.score - a.score || a.resolved.story.title.localeCompare(b.resolved.story.title))
      .slice(0, 6)
      .map((entry) => entry.resolved);
  }, [selectedBook]);

  const selectedBookStoryTopics = useMemo(() => {
    if (!selectedBook) return [];
    return Array.from(new Set(selectedBook.stories.map((story) => getBookStoryTopic(story, selectedBook)))).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [selectedBook]);

  const selectedBookFilteredStories = useMemo(() => {
    if (!selectedBook) return [];

    const query = selectedBookStoryQuery.trim().toLowerCase();
    const filtered = selectedBook.stories.filter((story) => {
      const matchesQuery =
        query.length === 0 ||
        story.title.toLowerCase().includes(query) ||
        stripHtml(story.text).toLowerCase().includes(query);
      const matchesTopic =
        selectedBookStoryTopicFilter === "all" ||
        getBookStoryTopic(story, selectedBook).toLowerCase() === selectedBookStoryTopicFilter;
      return matchesQuery && matchesTopic;
    });

    const withIndex = filtered
      .map((story, index) => {
        const resolved = resolveStorySelection(story.id, selectedBook, story);
        if (!resolved) return null;
        return {
          story,
          index,
          resolved,
          readMinutes: estimateReadMinutes(story.text),
          topic: getBookStoryTopic(story, selectedBook),
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    withIndex.sort((a, b) => {
      if (selectedBookStorySortKey === "title") return a.story.title.localeCompare(b.story.title);
      if (selectedBookStorySortKey === "shortest") return a.readMinutes - b.readMinutes;
      if (selectedBookStorySortKey === "longest") return b.readMinutes - a.readMinutes;
      return a.index - b.index;
    });

    return withIndex;
  }, [selectedBook, selectedBookStoryQuery, selectedBookStorySortKey, selectedBookStoryTopicFilter]);

  const personalizedBooks = useMemo(() => {
    const interestTerms = effectivePreferenceInterests.map((item) => item.toLowerCase());

    const scored = CATALOG_BOOKS.map((book) => {
      let score = 0;
      const bookLanguage = formatLanguage(book.language);
      const bookRegion = formatVariant(book.variant ?? book.region ?? "");
      const bookLevel = String(book.level ?? "").toLowerCase();
      const bookTopic = formatTopic(book.topic);
      const topicHaystack = [
        bookTopic,
        book.title,
        book.subtitle ?? "",
        book.description ?? "",
        ...book.stories.map((story) => {
          const storyDescription =
            "description" in story && typeof story.description === "string" ? story.description : "";
          return `${story.title} ${storyDescription} ${story.topic ?? ""}`;
        }),
      ]
        .join(" ")
        .toLowerCase();

      if (effectiveTargetLanguages.length > 0 && effectiveTargetLanguages.includes(bookLanguage)) score += 4;
      if (preferences.preferredLevel && bookLevel === preferences.preferredLevel.toLowerCase()) score += 3;
      if (preferences.preferredRegion && bookRegion === preferences.preferredRegion) score += 2;
      if (
        preferences.preferredVariant &&
        (bookRegion === formatVariantLabel(preferences.preferredVariant) ||
          String(book.variant ?? "").toLowerCase() === preferences.preferredVariant.toLowerCase())
      ) {
        score += 2;
      }
      if (interestTerms.length > 0 && interestTerms.some((term) => topicHaystack.includes(term))) score += 3;
      score += scoreTopicLabelAgainstOnboarding(
        [bookTopic, book.title, book.description ?? "", book.subtitle ?? ""].join(" "),
        preferences.interests,
        preferences.learningGoal
      );
      const avgReadMinutes =
        book.stories.length > 0
          ? Math.round(book.stories.reduce((sum, story) => sum + estimateReadMinutes(story.text), 0) / book.stories.length)
          : null;
      score += scoreReadTimeFit(avgReadMinutes, preferences.dailyMinutes);

      return { book, score };
    })
      .sort((a, b) => b.score - a.score || a.book.title.localeCompare(b.book.title))
      .filter((entry) => entry.score > 0)
      .map((entry) => entry.book);

    return scored;
  }, [
    effectivePreferenceInterests,
    effectiveTargetLanguages,
    preferences.dailyMinutes,
    preferences.interests,
    preferences.learningGoal,
    preferences.preferredLevel,
    preferences.preferredRegion,
    preferences.preferredVariant,
  ]);

  const personalizedStoryCards = useMemo(
    () =>
      personalizedBooks
        .flatMap((book) =>
          book.stories.map<StoryCardModel | null>((story) => {
            const resolved = resolveStorySelection(story.id, book, story);
            if (!resolved) return null;
            return {
              key: `personalized-${story.id}`,
              title: story.title,
              subtitle: book.title,
              coverUrl: getCoverUrl(story.cover ?? book.cover),
              meta: `${formatLanguage(story.language ?? book.language)} · ${formatTopic(story.topic ?? book.topic)}`,
              badge: LEVEL_LABELS[story.level ?? book.level],
              onPress: () => openSelection(resolved),
            };
          })
        )
        .filter((item): item is StoryCardModel => item !== null)
        .slice(0, 8),
    [personalizedBooks]
  );

  const activePracticeSeedFavorite = useMemo(() => {
    const multipleChoiceSeed = practiceExercises.find(
      (exercise): exercise is Extract<PracticeExercise, { kind: "multiple-choice" }> =>
        exercise.kind === "multiple-choice"
    );
    return multipleChoiceSeed?.favorite ?? favoriteWords[0] ?? null;
  }, [favoriteWords, practiceExercises]);

  async function trackPracticeMetric(
    eventType: "practice_session_started" | "practice_session_completed",
    extra?: Record<string, unknown>
  ) {
    if (!sessionToken || !activePracticeSeedFavorite) return;

    try {
      await apiFetch<{ success: true }>({
        baseUrl: mobileConfig.apiBaseUrl,
        path: "/api/mobile/metrics",
        token: sessionToken,
        method: "POST",
        body: {
          storySlug: activePracticeSeedFavorite.storySlug ?? "practice",
          eventType,
            metadata: {
              mode: activePracticeMode ?? "mixed",
              itemsCount: practiceExercises.length,
              score: practiceScore,
              accuracyPercent:
                practiceExercises.length > 0
                  ? Math.round((practiceScore / practiceExercises.length) * 100)
                  : 0,
            source:
              practiceLaunchContext.source === "journey"
                ? "journey"
                : practiceLaunchContext.source === "story"
                  ? "mobile_story_practice"
                  : "mobile_practice",
            storyTitle: activePracticeSeedFavorite.storyTitle ?? null,
            language: activePracticeSeedFavorite.language ?? null,
            levelId:
              practiceLaunchContext.source === "journey" ? practiceLaunchContext.levelId : null,
            topicId:
              practiceLaunchContext.source === "journey" ? practiceLaunchContext.topicId : null,
            variantId:
              practiceLaunchContext.source === "journey" ? practiceLaunchContext.variantId ?? null : null,
            ...extra,
          },
        },
      });
    } catch (error) {
      console.error("[mobile practice] failed to track practice metric", error);
    }
  }

  async function trackReminderMetric(
    eventType: "reminder_scheduled" | "reminder_destination_opened",
    extra?: Record<string, unknown>
  ) {
    if (!sessionToken) return;

    try {
      await apiFetch<{ success: true }>({
        baseUrl: mobileConfig.apiBaseUrl,
        path: "/api/mobile/metrics",
        token: sessionToken,
        method: "POST",
        body: {
          storySlug: "daily-loop",
          bookSlug: "mobile",
          eventType,
          metadata: extra ?? {},
        },
      });
    } catch (error) {
      console.error("[mobile reminder] failed to track reminder metric", error);
    }
  }

  useEffect(() => {
    practiceStartTrackedRef.current = false;
    practiceCompletionTrackedRef.current = false;
  }, [activePracticeMode, practiceExercises.length]);

  useEffect(() => {
    if (practiceExercises.length === 0) return;

    const standaloneSlugs = Array.from(
      new Set(
        practiceExercises
          .filter(
            (exercise): exercise is Extract<PracticeExercise, { kind: "multiple-choice" }> =>
              exercise.kind === "multiple-choice" &&
              Boolean(exercise.audioClip) &&
              exercise.audioClip?.storySource === "standalone"
          )
          .map((exercise) => normalizeStorySlug(exercise.audioClip?.storySlug))
          .filter((slug) => slug && !standaloneStoryAudioBySlug[slug])
      )
    );

    const userSlugs = Array.from(
      new Set(
        practiceExercises
          .filter(
            (exercise): exercise is Extract<PracticeExercise, { kind: "multiple-choice" }> =>
              exercise.kind === "multiple-choice" &&
              Boolean(exercise.audioClip) &&
              exercise.audioClip?.storySource === "user"
          )
          .map((exercise) => normalizeStorySlug(exercise.audioClip?.storySlug))
          .filter((slug) => slug && !userStoryAudioBySlug[slug])
      )
    );

    if (standaloneSlugs.length === 0 && userSlugs.length === 0) return;

    let cancelled = false;

    void (async () => {
      try {
        if (standaloneSlugs.length > 0) {
          const payload = await apiFetch<{ stories?: Array<{ slug: string; audioUrl: string | null; audioSegments: unknown }> }>({
            baseUrl: mobileConfig.apiBaseUrl,
            path: `/api/standalone-story-audio?slugs=${encodeURIComponent(standaloneSlugs.join(","))}`,
            token: sessionToken ?? undefined,
          });
          if (!cancelled && payload.stories?.length) {
            setStandaloneStoryAudioBySlug((current) => {
              const next = { ...current };
              for (const story of payload.stories ?? []) {
                next[normalizeStorySlug(story.slug)] = {
                  audioUrl: story.audioUrl,
                  audioSegments: coerceAudioSegments(story.audioSegments),
                };
              }
              return next;
            });
          }
        }

        if (userSlugs.length > 0) {
          const payload = await apiFetch<{ stories?: Array<{ slug: string; audioUrl: string | null; audioSegments: unknown }> }>({
            baseUrl: mobileConfig.apiBaseUrl,
            path: `/api/user-stories?slugs=${encodeURIComponent(userSlugs.join(","))}`,
            token: sessionToken ?? undefined,
          });
          if (!cancelled && payload.stories?.length) {
            setUserStoryAudioBySlug((current) => {
              const next = { ...current };
              for (const story of payload.stories ?? []) {
                next[normalizeStorySlug(story.slug)] = {
                  audioUrl: story.audioUrl,
                  audioSegments: coerceAudioSegments(story.audioSegments),
                };
              }
              return next;
            });
          }
        }
      } catch (error) {
        console.error("[mobile practice] failed to prefetch clip metadata", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [practiceExercises, sessionToken, standaloneStoryAudioBySlug, userStoryAudioBySlug]);

  useEffect(() => {
    return () => {
      void stopPracticeContextClip();
      getOptionalSpeechModule()?.stop();
      void journeyMilestoneSoundRef.current?.unloadAsync();
    };
  }, []);

  useEffect(() => {
    void stopPracticeContextClip();
    getOptionalSpeechModule()?.stop();
    setSpeakingPracticePromptId(null);
  }, [practiceIndex]);

  useEffect(() => {
    if (
      !activePracticeMode ||
      practiceExercises.length === 0 ||
      practiceComplete ||
      practiceStartTrackedRef.current
    ) {
      return;
    }

    practiceStartTrackedRef.current = true;
    void trackPracticeMetric("practice_session_started");
  }, [activePracticeMode, practiceComplete, practiceExercises.length, sessionToken]);

  useEffect(() => {
    if (!practiceComplete || practiceExercises.length === 0 || practiceCompletionTrackedRef.current) {
      return;
    }

    practiceCompletionTrackedRef.current = true;
    void (async () => {
      await trackPracticeMetric("practice_session_completed");

      if (
        sessionToken &&
        practiceLaunchContext.source === "journey" &&
        practiceLaunchContext.kind === "checkpoint" &&
        practiceCheckpointToken
      ) {
        setPracticeCheckpointSaveState("saving");
        try {
          await apiFetch<{ success: true; score: number; total: number }>({
            baseUrl: mobileConfig.apiBaseUrl,
            path: "/api/mobile/journey/checkpoint",
            token: sessionToken,
            method: "POST",
            body: {
              token: practiceCheckpointToken,
              responses: practiceCheckpointResponses,
            },
          });
          setPracticeCheckpointSaveState("saved");
        } catch (error) {
          console.error("[mobile practice] failed to save checkpoint", error);
          setPracticeCheckpointSaveState("error");
        }
      }

      const reviewableFavorites = favoriteWords.filter((item) =>
        Object.prototype.hasOwnProperty.call(practiceReviewScores, normalizePracticeWord(item.word))
      );

      if (reviewableFavorites.length > 0) {
        const nowIso = new Date().toISOString();
        const nextFavorites = favoriteWords.map((item) => {
          const reviewScore = practiceReviewScores[normalizePracticeWord(item.word)];
          if (!reviewScore) return item;
          const next = computeNextReview(reviewScore, item.streak ?? 0);
          return {
            ...item,
            nextReviewAt: new Date(next.nextReviewAt).toISOString(),
            lastReviewedAt: nowIso,
            streak: next.streak,
          };
        });

        setFavoriteWords(nextFavorites);
        await saveLocalFavorites(sessionUserId, nextFavorites);

        if (sessionToken) {
          await Promise.all(
            reviewableFavorites.map(async (item) => {
              const reviewScore = practiceReviewScores[normalizePracticeWord(item.word)];
              if (!reviewScore) return;
              const next = computeNextReview(reviewScore, item.streak ?? 0);
              try {
                await updateFavoriteReviewOnServer(sessionToken, {
                  word: item.word,
                  nextReviewAt: new Date(next.nextReviewAt).toISOString(),
                  lastReviewedAt: nowIso,
                  streak: next.streak,
                });
              } catch {
                // Keep local SRS state even if the server update fails.
              }
            })
          );
        }
      }

      if (!sessionToken) return;

      try {
        const payload = await apiFetch<MobileProgressPayload>({
          baseUrl: mobileConfig.apiBaseUrl,
          path: "/api/mobile/progress",
          token: sessionToken,
        });
        setRemoteProgress(payload);
      } catch (error) {
        console.error("[mobile practice] failed to refresh progress", error);
      }

      if (practiceLaunchContext.source === "journey") {
        try {
          const previousJourneyPayload = remoteJourney;
          const payload = await apiFetch<MobileJourneyPayload>({
            baseUrl: mobileConfig.apiBaseUrl,
            path: "/api/mobile/journey",
            token: sessionToken,
          });
          setRemoteJourney(payload);
          const milestone = buildJourneyMilestoneFromPayload(previousJourneyPayload, payload, {
            variantId: practiceLaunchContext.variantId,
            levelId: practiceLaunchContext.levelId,
            topicId: practiceLaunchContext.topicId,
            kind: practiceLaunchContext.kind ?? "topic",
            topicLabel: practiceLaunchContext.topicLabel,
          });
          if (milestone) {
            setJourneyMilestone(milestone);
          }
        } catch (error) {
          console.error("[mobile practice] failed to refresh journey", error);
        }
      }
    })();
  }, [
    favoriteWords,
    practiceComplete,
    practiceCheckpointResponses,
    practiceCheckpointToken,
    practiceExercises.length,
    practiceLaunchContext,
    practiceReviewScores,
    practiceScore,
    remoteJourney,
    sessionToken,
    sessionUserId,
  ]);

  const latestStoryCards = useMemo<StoryCardModel[]>(
    () =>
      CATALOG_BOOKS.flatMap((book) =>
        book.stories.slice(0, 2).map<StoryCardModel | null>((story) => {
          const resolved = resolveStorySelection(story.id, book, story);
          return resolved
            ? {
                key: `latest-${story.id}`,
                title: story.title,
                subtitle: book.title,
                coverUrl: getCoverUrl(story.cover ?? book.cover),
                meta: `${formatLanguage(story.language ?? book.language)} · ${formatTopic(story.topic ?? book.topic)}`,
                badge: story.audio ? "Audio ready" : "Read",
                onPress: () => openSelection(resolved),
              }
            : null;
        })
      )
        .filter((item): item is StoryCardModel => item !== null)
        .sort((a, b) => {
          const scoreStory = (item: StoryCardModel) =>
            scoreTopicLabelAgainstOnboarding(
              [item.title, item.subtitle, item.meta].join(" "),
              preferences.interests,
              preferences.learningGoal
            );
          return scoreStory(b) - scoreStory(a) || a.title.localeCompare(b.title);
        })
        .slice(0, 8),
    [preferences.interests, preferences.learningGoal]
  );

  const exploreFilters = useMemo(() => {
    const languages = Array.from(
      new Set(
        [
          ...CATALOG_BOOKS.map((book) => formatLanguage(book.language)),
          ...CATALOG_BOOKS.flatMap((book) => book.stories.map((story) => formatLanguage(story.language ?? book.language))),
          ...remoteStories.map((story) => formatLanguage(story.language ?? "")),
        ].filter(Boolean)
      )
    ).sort();
    const variantOnlyIds = new Set(
      Object.values(VARIANT_OPTIONS_BY_LANGUAGE)
        .flat()
        .filter((v) => !["spain", "brazil", "portugal", "germany", "austria", "france", "italy", "south-korea"].includes(v.value))
        .map((v) => v.value.toLowerCase())
    );
    const regions = Array.from(
      new Set(
        [
          ...CATALOG_BOOKS.filter((b) => !variantOnlyIds.has((b.region ?? "").trim().toLowerCase())).map((book) => formatRegion(book.region ?? "")),
          ...remoteStories.filter((s) => !variantOnlyIds.has((s.region ?? "").trim().toLowerCase())).map((story) => formatRegion(story.region ?? "")),
        ].filter((value) => value && value !== "Unknown")
      )
    ).sort();

    return {
      languages: ["All", ...languages],
      regions: ["All", ...regions],
    };
  }, [remoteStories]);

  const exploreSuggestions = useMemo<ExploreSuggestion[]>(() => {
    const normalizedQuery = normalizeExploreSearch(exploreQuery);
    if (normalizedQuery.length < 2) return [];

    const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return [];

    const results: Array<{ item: ExploreSuggestion; score: number }> = [];

    for (const book of CATALOG_BOOKS) {
      const language = formatLanguage(book.language);
      const region = formatRegion(book.region ?? "");
      const level = formatLevel(book.level);
      const haystack = normalizeExploreSearch(
        [book.title, book.slug, language, region, level, formatTopic(book.topic), book.description ?? ""]
          .filter(Boolean)
          .join(" · ")
      );
      const score = scoreExploreMatch(haystack, tokens);
      if (score <= 0) continue;

      results.push({
        item: {
          kind: "book",
          id: `book:${book.id}`,
          title: book.title,
          subtitle: [language, region, level].filter(Boolean).join(" · "),
          coverUrl: getCoverUrl(book.cover),
          onPress: () => openBook(book),
        },
        score,
      });
    }

    for (const book of CATALOG_BOOKS) {
      for (const story of book.stories) {
        const resolved = resolveStorySelection(story.id, book, story);
        if (!resolved) continue;
        const language = formatLanguage(story.language ?? book.language);
        const region = formatRegion(story.region ?? book.region ?? "");
        const level = formatLevel(story.level ?? book.level);
        const haystack = normalizeExploreSearch(
          [
            story.title,
            story.slug,
            book.title,
            book.slug,
            language,
            region,
            level,
            formatTopic(story.topic ?? book.topic),
          ]
            .filter(Boolean)
            .join(" · ")
        );
        const score = scoreExploreMatch(haystack, tokens);
        if (score <= 0) continue;

        results.push({
          item: {
            kind: "bookStory",
            id: `book-story:${book.id}:${story.id}`,
            title: story.title,
            subtitle: [book.title, language, region, level].filter(Boolean).join(" · "),
            coverUrl: getCoverUrl(story.cover ?? book.cover),
            onPress: () => openSelection(resolved),
          },
          score: score + 10,
        });
      }
    }

    for (const story of remoteStories.filter((item) => item.bookId === "standalone")) {
      const language = formatLanguage(story.language ?? "");
      const region = formatRegion(story.region ?? "");
      const level = formatLevel(toDomainLevel(story.level));
      const haystack = normalizeExploreSearch(
        [story.title, story.storySlug, language, region, level, formatTopic(story.topic ?? "")]
          .filter(Boolean)
          .join(" · ")
      );
      const score = scoreExploreMatch(haystack, tokens);
      if (score <= 0) continue;

      results.push({
        item: {
          kind: "standaloneStory",
          id: `standalone:${story.storyId}`,
          title: story.title,
          subtitle: [language, region, level].filter(Boolean).join(" · "),
          coverUrl: getCoverUrl(story.coverUrl),
          onPress: () => {
            void openStandaloneStory(story);
          },
        },
        score,
      });
    }

    results.sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title));

    const seen = new Set<string>();
    const next: ExploreSuggestion[] = [];
    for (const result of results) {
      if (seen.has(result.item.id)) continue;
      seen.add(result.item.id);
      next.push(result.item);
      if (next.length >= 10) break;
    }

    return next;
  }, [exploreQuery, remoteStories]);

  const exploreSearchHint = useMemo(() => {
    const normalizedQuery = normalizeExploreSearch(exploreQuery);
    if (normalizedQuery.length < 2) return "Search stories or books";
    if (exploreSuggestions.length === 0) return "No matches";
    return `${exploreSuggestions.length} suggestion${exploreSuggestions.length === 1 ? "" : "s"}`;
  }, [exploreQuery, exploreSuggestions.length]);

  const showExploreSuggestions = isExploreSearchFocused && normalizeExploreSearch(exploreQuery).length >= 2;

  const exploreBaseFilteredBooks = useMemo(() => {
    const query = exploreQuery.trim().toLowerCase();
    return CATALOG_BOOKS.filter((book) => {
      const language = formatLanguage(book.language);
      const region = formatRegion(book.region ?? "");
      const topic = formatTopic(book.topic);

      if (selectedExploreLanguage !== "All" && language !== selectedExploreLanguage) return false;
      if (selectedExploreRegion !== "All" && region !== selectedExploreRegion) return false;

      if (!query) return true;

      const haystack = [
        book.title,
        book.subtitle,
        book.description,
        language,
        region,
        topic,
        ...book.stories.map((story) => story.title),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [exploreQuery, selectedExploreLanguage, selectedExploreRegion]);

  const filteredExploreBooks = useMemo(
    () =>
      exploreBaseFilteredBooks
        .filter((book) => {
          if (selectedExploreTopic === "All") return true;
          return formatTopic(book.topic) === selectedExploreTopic;
        })
        .sort((a, b) => {
          const scoreBook = (book: Book) =>
            scoreTopicLabelAgainstOnboarding(
              [book.title, book.subtitle ?? "", book.description ?? "", formatTopic(book.topic)].join(" "),
              preferences.interests,
              preferences.learningGoal
            ) + scoreReadTimeFit(
              book.stories.length > 0
                ? Math.round(book.stories.reduce((sum, story) => sum + estimateReadMinutes(story.text), 0) / book.stories.length)
                : null,
              preferences.dailyMinutes
            );
          return scoreBook(b) - scoreBook(a) || a.title.localeCompare(b.title);
        }),
    [exploreBaseFilteredBooks, preferences.dailyMinutes, preferences.interests, preferences.learningGoal, selectedExploreTopic]
  );

  const filteredExploreStories = useMemo<StoryCardModel[]>(
    () =>
      exploreBaseFilteredBooks
        .flatMap((book) =>
          book.stories.map<StoryCardModel | null>((story) => {
            const storyTopic = formatTopic(story.topic ?? book.topic);
            if (selectedExploreTopic !== "All" && storyTopic !== selectedExploreTopic) return null;
            const resolved = resolveStorySelection(story.id, book, story);
            if (!resolved) return null;
            return {
              key: `explore-${story.id}`,
              title: story.title,
              subtitle: book.title,
              coverUrl: getCoverUrl(story.cover ?? book.cover),
              meta: `${formatLanguage(story.language ?? book.language)} · ${formatTopic(story.topic ?? book.topic)}`,
              badge: LEVEL_LABELS[story.level ?? book.level],
              onPress: () => openSelection(resolved),
            };
          })
        )
        .filter((item) => item !== null)
        .sort((a, b) => {
          const scoreStory = (item: StoryCardModel) =>
            scoreTopicLabelAgainstOnboarding(
              [item.title, item.subtitle, item.meta].join(" "),
              preferences.interests,
              preferences.learningGoal
            );
          return scoreStory(b) - scoreStory(a) || a.title.localeCompare(b.title);
        })
        .slice(0, 12),
    [exploreBaseFilteredBooks, preferences.interests, preferences.learningGoal, selectedExploreTopic]
  );

  useEffect(() => {
    if (!__DEV__) return;

    const handleQaUrl = ({ url }: { url: string }) => {
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== "digitalpolyglot:" || parsed.hostname !== "qa") return;
        const action = parsed.pathname.replace(/^\/+/, "");

        if (action === "open-first-book") {
          const book = filteredExploreBooks[0] ?? CATALOG_BOOKS[0];
          if (!book) return;
          setSelection(null);
          setActiveScreen("explore");
          openBook(book);
          return;
        }

        if (action === "open-first-story") {
          const storyCard = filteredExploreStories[0];
          setSelectedBook(null);
          storyCard?.onPress?.();
          return;
        }

        if (action === "open-practice") {
          setSelectedBook(null);
          setSelection(null);
          setActiveScreen("practice");
          return;
        }

        if (action === "open-favorites") {
          setSelectedBook(null);
          setSelection(null);
          setActiveScreen("favorites");
          return;
        }

        if (action === "open-journey") {
          setSelectedBook(null);
          setSelection(null);
          setActiveScreen("journey");
          shellScrollRef.current?.scrollTo({ y: 0, animated: false });
          return;
        }

        if (action === "open-home") {
          setSelectedBook(null);
          setSelection(null);
          setActiveScreen("home");
          shellScrollRef.current?.scrollTo({ y: 0, animated: false });
          return;
        }

        if (action === "open-explore") {
          setSelectedBook(null);
          setSelection(null);
          setActiveScreen("explore");
          shellScrollRef.current?.scrollTo({ y: 0, animated: false });
          return;
        }

        if (action === "open-library") {
          setSelectedBook(null);
          setSelection(null);
          setActiveScreen("library");
          shellScrollRef.current?.scrollTo({ y: 0, animated: false });
          return;
        }

        if (action === "scroll-top") {
          shellScrollRef.current?.scrollTo({ y: 0, animated: false });
          return;
        }

        if (action === "scroll-mid") {
          shellScrollRef.current?.scrollTo({ y: 900, animated: false });
          return;
        }

        if (action === "scroll-bottom") {
          shellScrollRef.current?.scrollTo({ y: 2200, animated: false });
          return;
        }
      } catch (error) {
        console.warn("[mobile qa] failed to process QA URL", error);
      }
    };

    const subscription = Linking.addEventListener("url", handleQaUrl);
    return () => {
      subscription.remove();
    };
  }, [filteredExploreBooks, filteredExploreStories]);

  const exploreTopicChips = useMemo(() => {
    const counts = new Map<string, number>();
    const addTopic = (value: string | null | undefined) => {
      const key = formatTopic(value ?? "");
      if (!key) return;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    };

    exploreBaseFilteredBooks.forEach((book) => {
      addTopic(book.topic);
      book.stories.forEach((story) => addTopic(story.topic ?? book.topic));
    });

    remoteStories
      .filter((story) => story.bookId === "standalone")
      .filter((story) => {
        const language = formatLanguage(story.language ?? "");
        const region = formatRegion(story.region ?? "");
        const query = exploreQuery.trim().toLowerCase();

        if (selectedExploreLanguage !== "All" && language !== selectedExploreLanguage) return false;
        if (selectedExploreRegion !== "All" && region !== selectedExploreRegion) return false;
        if (!query) return true;

        const haystack = [story.title, language, region, story.topic, story.storySlug]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(query);
      })
      .forEach((story) => addTopic(story.topic));

    return Array.from(counts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [exploreBaseFilteredBooks, exploreQuery, remoteStories, selectedExploreLanguage, selectedExploreRegion]);

  useEffect(() => {
    if (preferencesLoading || hasSeededExplorePreferencesRef.current) return;

    if (selectedExploreLanguage === "All" && effectiveTargetLanguages[0]) {
      setSelectedExploreLanguage(effectiveTargetLanguages[0]);
    }
    if (selectedExploreRegion === "All" && preferences.preferredRegion) {
      setSelectedExploreRegion(formatRegion(preferences.preferredRegion));
    }
    if (selectedExploreTopic === "All") {
      const suggestedTopic = pickOnboardingTopicPreference(
        exploreTopicChips.map((chip) => chip.label),
        preferences.interests,
        preferences.learningGoal
      );
      if (suggestedTopic) {
        setSelectedExploreTopic(suggestedTopic);
      }
    }

    hasSeededExplorePreferencesRef.current = true;
  }, [
    effectiveTargetLanguages,
    exploreTopicChips,
    preferences.interests,
    preferences.learningGoal,
    preferences.preferredRegion,
    preferencesLoading,
    selectedExploreLanguage,
    selectedExploreRegion,
    selectedExploreTopic,
  ]);

  async function dismissGamificationCelebration(_id: string) {
    const allIds = remoteProgress?.gamification
      ? buildGamificationCelebrations(remoteProgress.gamification).map((c) => c.id)
      : [_id];
    setDismissedCelebrationIds((prev) => {
      const next = new Set(prev);
      for (const id of allIds) next.add(id);
      return next;
    });
    setActiveGamificationCelebration(null);
    const nextSeen = [
      ...(await loadSeenGamificationCelebrations(sessionUserId)),
      ...allIds,
    ];
    await saveSeenGamificationCelebrations(sessionUserId, Array.from(new Set(nextSeen)));
  }

  const homeView = (
    <>
      <View style={styles.hero}>
        <View style={styles.heroHeaderRow}>
          <View style={styles.heroTextBlock}>
            <Text style={styles.eyebrow}>Today</Text>
            <Text style={styles.title}>Home</Text>
            <Text style={styles.subtitle}>Continue, discover and jump into your next story.</Text>
          </View>
          <MenuTrigger onPress={() => setMenuOpen(true)} />
        </View>
      </View>

      {isSignedIn ? (
        <View style={styles.section}>
          <View
            style={[
              styles.card,
              styles.dailyLoopCard,
              activeOnboardingTourTarget === "home" ? styles.onboardingHighlightedSurface : null,
            ]}
          >
            <Text style={styles.sectionEyebrow}>Today&apos;s loop</Text>
            <Text style={styles.dailyLoopTitle}>{homeLoopSummary.title}</Text>
            <Text style={styles.metaLine}>{homeLoopSummary.body}</Text>
            <View style={styles.bookActionsRow}>
              <Pressable
                onPress={() => {
                  if (continueReading.length > 0) {
                    openSelection(continueReading[0]);
                    return;
                  }
                  if (dueFavoritesCount > 0) {
                    setActiveScreen("practice");
                    void openPracticeMode(recommendedPracticeMode, true, undefined, "due");
                    return;
                  }
                  setActiveScreen("journey");
                }}
                style={[styles.inlineButton, styles.primaryButton]}
              >
                <Text style={[styles.inlineButtonText, styles.primaryButtonText]}>{homeLoopSummary.primaryLabel}</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (continueReading.length > 0) {
                    setActiveScreen("practice");
                    void openPracticeMode(recommendedPracticeMode, true, undefined, "due");
                    return;
                  }
                  if (dueFavoritesCount > 0) {
                    setActiveScreen("journey");
                    return;
                  }
                  setActiveScreen("explore");
                }}
                style={styles.inlineButton}
              >
                <Text style={styles.inlineButtonText}>{homeLoopSummary.secondaryLabel}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      {remoteProgress?.gamification ? (
        <View style={styles.section}>
          <Pressable
            onPress={() => setActiveScreen("progress")}
            style={styles.gamificationMiniBar}
          >
            <View style={styles.gamificationMiniBarPill}>
              <Feather name="zap" size={13} color="#ffd36b" />
              <Text style={styles.gamificationMiniBarPillText}>
                {remoteProgress.gamification.dailyStreak}-day streak
              </Text>
            </View>
            <View style={styles.gamificationMiniBarPill}>
              <Feather name="star" size={13} color="#8ef0c6" />
              <Text style={styles.gamificationMiniBarPillText}>
                {remoteProgress.gamification.totalXp} XP
              </Text>
            </View>
            <View style={styles.gamificationMiniBarPill}>
              <Feather name="award" size={13} color="#7dd3fc" />
              <Text style={styles.gamificationMiniBarPillText}>
                Lv {remoteProgress.gamification.currentLevel}
              </Text>
            </View>
            <Feather name="chevron-right" size={14} color="#6f88a8" />
          </Pressable>
        </View>
      ) : null}

      {featuredHomeStory ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionEyebrow}>{featuredHomeStory.label}</Text>
              <Text style={styles.sectionTitle}>
                {effectivePlan === "free"
                  ? "Your free story"
                  : effectivePlan === "basic"
                    ? "Your daily story"
                    : "Featured story"}
              </Text>
            </View>
          </View>
          <BookHomeCard
            item={{
              key: `featured-${featuredHomeStory.selection.story.id}`,
              title: featuredHomeStory.selection.story.title,
              coverUrl: getCoverUrl(
                featuredHomeStory.selection.story.cover ?? featuredHomeStory.selection.book.cover
              ),
              subtitle: featuredHomeStory.selection.book.title,
              meta: `${formatLanguage(
                featuredHomeStory.selection.story.language ?? featuredHomeStory.selection.book.language
              )} · ${formatTopic(
                featuredHomeStory.selection.story.topic ?? featuredHomeStory.selection.book.topic
              )}`,
              onPress: () => openSelection(featuredHomeStory.selection),
            }}
            fullWidth
          />
        </View>
      ) : null}

      {continueReadingCards.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionEyebrow}>Resume</Text>
              <Text style={styles.sectionTitle}>Continue listening</Text>
            </View>
          </View>
          {continueReadingCards.length === 1 ? (
            <BookHomeCard
              item={{
                key: continueReadingCards[0].key,
                title: continueReadingCards[0].title,
                coverUrl: continueReadingCards[0].coverUrl,
                subtitle: continueReadingCards[0].subtitle,
                meta: continueReadingCards[0].meta,
                progressLabel: continueReadingCards[0].progressLabel,
                onPress: continueReadingCards[0].onPress ?? (() => {}),
              }}
              fullWidth
            />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="normal" contentContainerStyle={styles.carousel}>
              {continueReadingCards.map((item) => (
                <BookHomeCard
                  key={item.key}
                  item={{
                    key: item.key,
                    title: item.title,
                    coverUrl: item.coverUrl,
                    subtitle: item.subtitle,
                    meta: item.meta,
                    progressLabel: item.progressLabel,
                    onPress: item.onPress ?? (() => {}),
                  }}
                />
              ))}
            </ScrollView>
          )}
        </View>
      ) : null}

      {(remoteStoryCards.length > 0 || personalizedStoryCards.length > 0) ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionEyebrow}>Premium personalization</Text>
              <Text style={styles.sectionTitle}>Recommended next</Text>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="normal" contentContainerStyle={styles.carousel}>
            {(
              remoteStoryCards.length > 0
                ? remoteStoryCards
                : personalizedStoryCards.length > 0
                  ? personalizedStoryCards
                  : []
            ).map((item) => (
              <BookHomeCard
                key={`recommended-${item.key}`}
                item={{
                  key: item.key,
                  title: item.title,
                  coverUrl: item.coverUrl,
                  subtitle: item.subtitle,
                  meta: item.meta,
                  progressLabel: item.progressLabel,
                  onPress: item.onPress ?? (() => {}),
                }}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View
        style={[styles.section, activeOnboardingTourTarget === "reader" ? styles.onboardingHighlightedSurface : null]}
        accessibilityLabel="qa-home-latest-books-section"
        testID="qa-home-latest-books-section"
      >
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>Library</Text>
            <Text style={styles.sectionTitle}>New releases</Text>
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="normal" contentContainerStyle={styles.carousel}>
          {[
            ...latestBookCards.slice(0, 5).map((item) => (
              <BookWebCard key={item.key} item={item} />
            )),
            ...[...latestStoryCards.slice(0, 5), ...homeStandaloneStoryCards.slice(0, 3)].slice(0, 6).map((item) => (
              <BookHomeCard
                key={`home-story-${item.key}`}
                item={{
                  key: item.key,
                  title: item.title,
                  coverUrl: item.coverUrl,
                  subtitle: item.subtitle,
                  meta: item.meta,
                  progressLabel: item.progressLabel,
                  onPress: item.onPress ?? (() => {}),
                }}
              />
            )),
          ]}
        </ScrollView>
      </View>
    </>
  );

  const exploreView = (
    <>
      <View style={styles.hero}>
        <View style={styles.heroHeaderRow}>
          <View style={styles.heroTextBlock}>
            <Text style={styles.eyebrow}>Browse</Text>
            <Text style={styles.title}>Explore</Text>
            <Text style={styles.subtitle}>Search, filter and browse stories and books.</Text>
          </View>
          <MenuTrigger onPress={() => setMenuOpen(true)} />
        </View>
      </View>

      <View style={styles.exploreCompactSearch}>
        <View style={styles.exploreSearchBox}>
          <View style={styles.exploreSearchInputWrap}>
            <Feather name="search" size={16} color="#7f95b2" />
            <TextInput
              value={exploreQuery}
              onChangeText={setExploreQuery}
              accessibilityLabel="qa-explore-search-input"
              testID="qa-explore-search-input"
              placeholder="Search"
              placeholderTextColor="#7f95b2"
              style={styles.exploreSearchInput}
              onFocus={() => {
                if (exploreSearchBlurTimeoutRef.current) {
                  clearTimeout(exploreSearchBlurTimeoutRef.current);
                }
                setIsExploreSearchFocused(true);
              }}
              onBlur={() => {
                exploreSearchBlurTimeoutRef.current = setTimeout(() => {
                  setIsExploreSearchFocused(false);
                }, 120);
              }}
              onSubmitEditing={() => {
                const firstSuggestion = exploreSuggestions[0];
                if (!firstSuggestion) return;
                setExploreQuery("");
                setIsExploreSearchFocused(false);
                firstSuggestion.onPress();
              }}
              returnKeyType="search"
            />
            {exploreQuery.length > 0 ? (
              <Pressable
                onPress={() => {
                  setExploreQuery("");
                  setIsExploreSearchFocused(true);
                }}
                hitSlop={8}
                style={styles.exploreSearchClear}
              >
                <Text style={styles.exploreSearchClearText}>Clear</Text>
              </Pressable>
            ) : null}
          </View>
          <Text style={styles.exploreSearchHint}>{exploreSearchHint}</Text>

          {showExploreSuggestions && exploreSuggestions.length > 0 ? (
            <View style={styles.exploreSuggestionsCard}>
              {exploreSuggestions.map((suggestion) => {
                const badge =
                  suggestion.kind === "book" ? "Book" : suggestion.kind === "bookStory" ? "Story" : "Story";
                return (
                  <Pressable
                    key={suggestion.id}
                    onPress={() => {
                      if (exploreSearchBlurTimeoutRef.current) {
                        clearTimeout(exploreSearchBlurTimeoutRef.current);
                      }
                      setExploreQuery("");
                      setIsExploreSearchFocused(false);
                      suggestion.onPress();
                    }}
                    style={styles.exploreSuggestionRow}
                  >
                    <ProgressiveImage
                      uri={suggestion.coverUrl}
                      style={styles.exploreSuggestionCover}
                      resizeMode="cover"
                    />
                    <View style={styles.exploreSuggestionBody}>
                      <View style={styles.exploreSuggestionTitleRow}>
                        <Text style={styles.exploreSuggestionTitle} numberOfLines={1}>
                          {suggestion.title}
                        </Text>
                        <View style={styles.exploreSuggestionBadge}>
                          <Text style={styles.exploreSuggestionBadgeText}>{badge}</Text>
                        </View>
                      </View>
                      <Text style={styles.exploreSuggestionSubtitle} numberOfLines={1}>
                        {suggestion.subtitle}
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={16} color="#7f95b2" />
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>

        <View style={styles.exploreCompactFiltersRow}>
          <View style={styles.exploreCompactFilterField}>
            <Text style={styles.exploreCompactFilterLabel}>Language</Text>
            <Pressable onPress={() => setExplorePickerSection("language")} style={styles.exploreCompactFilterButton}>
              <Text style={styles.exploreCompactFilterValue}>
                {selectedExploreLanguage === "All" ? "All languages" : selectedExploreLanguage}
              </Text>
              <Feather name="chevron-down" size={16} color="#9cb0c9" />
            </Pressable>
          </View>

          <View style={styles.exploreCompactFilterField}>
            <Text style={styles.exploreCompactFilterLabel}>Region</Text>
            <Pressable onPress={() => setExplorePickerSection("region")} style={styles.exploreCompactFilterButton}>
              <Text style={styles.exploreCompactFilterValue}>
                {selectedExploreRegion === "All" ? "All regions" : formatRegion(selectedExploreRegion)}
              </Text>
              <Feather name="chevron-down" size={16} color="#9cb0c9" />
            </Pressable>
          </View>
        </View>
      </View>

      {__DEV__ && filteredExploreBooks.length > 0 ? (
        <View style={styles.qaDevOnlyRow}>
          <Pressable
            accessibilityLabel="qa-explore-open-first-book"
            testID="qa-explore-open-first-book"
            onPress={() => openBook(filteredExploreBooks[0] ?? CATALOG_BOOKS[0])}
            style={styles.qaDevOnlyButton}
          >
            <Text style={styles.qaDevOnlyButtonText}>QA open first book</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.exploreTopicRows}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          decelerationRate="normal"
          contentContainerStyle={styles.filterChips}
          directionalLockEnabled
        >
          <Pressable
            onPress={() => {
              setSelectedExploreTopic("All");
            }}
            style={[styles.filterChip, selectedExploreTopic === "All" ? styles.filterChipActive : null]}
          >
            <Text style={[styles.filterChipText, selectedExploreTopic === "All" ? styles.filterChipTextActive : null]}>
              All topics
            </Text>
          </Pressable>
          {exploreTopicChips.map((chip) => (
            <Pressable
              key={`topic-${chip.label}`}
              onPress={() => setSelectedExploreTopic(chip.label)}
              style={[styles.filterChip, selectedExploreTopic === chip.label ? styles.filterChipActive : null]}
            >
              <Text style={[styles.filterChipText, selectedExploreTopic === chip.label ? styles.filterChipTextActive : null]}>
                {chip.label} ({chip.count})
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <Modal transparent visible={explorePickerSection !== null} animationType="fade" onRequestClose={() => setExplorePickerSection(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setExplorePickerSection(null)}>
          <Pressable style={styles.createPickerModal} onPress={() => {}}>
            <View style={styles.createPickerHeader}>
              <Text style={styles.sectionTitle}>{explorePickerSection === "language" ? "Language" : "Region"}</Text>
              <Pressable onPress={() => setExplorePickerSection(null)} style={styles.readerIconButton}>
                <Feather name="x" size={18} color="#dbe9ff" />
              </Pressable>
            </View>

            {explorePickerSection === "language" ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="normal" contentContainerStyle={styles.filterChips}>
                {exploreFilters.languages.map((language) => (
                  <Pressable
                    key={language}
                    onPress={() => {
                      setSelectedExploreLanguage(language);
                      setExplorePickerSection(null);
                    }}
                    style={[styles.filterChip, selectedExploreLanguage === language ? styles.filterChipActive : null]}
                  >
                    <Text style={[styles.filterChipText, selectedExploreLanguage === language ? styles.filterChipTextActive : null]}>
                      {language}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}

            {explorePickerSection === "region" ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="normal" contentContainerStyle={styles.filterChips}>
                {exploreFilters.regions.map((region) => (
                  <Pressable
                    key={region}
                    onPress={() => {
                      setSelectedExploreRegion(region);
                      setExplorePickerSection(null);
                    }}
                    style={[styles.filterChip, selectedExploreRegion === region ? styles.filterChipActive : null]}
                  >
                    <Text style={[styles.filterChipText, selectedExploreRegion === region ? styles.filterChipTextActive : null]}>
                      {region === "All" ? region : formatRegion(region)}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      {expandedExploreSection ? (
        <View style={styles.section}>
          <Pressable onPress={() => { setExpandedExploreSection(null); shellScrollRef.current?.scrollTo({ y: 0, animated: false }); }} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Back to Explore</Text>
          </Pressable>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionEyebrow}>{expandedExploreSection === "stories" ? "Read" : expandedExploreSection === "books" ? "Library" : "Standalone"}</Text>
              <Text style={styles.sectionTitle}>{expandedExploreSection === "stories" ? `All stories (${filteredExploreStories.length})` : expandedExploreSection === "books" ? `All books (${filteredExploreBooks.length})` : `All individual stories (${filteredStandaloneStoryCards.length})`}</Text>
            </View>
          </View>
          <View style={styles.exploreExpandedList}>
            {expandedExploreSection === "stories" ? filteredExploreStories.map((item) => (<ExploreStoryListCard key={`explore-story-expanded-${item.key}`} item={item} />)) : expandedExploreSection === "books" ? filteredExploreBooks.map((book) => (<BookWebCard key={`explore-book-expanded-${book.id}`} fullWidth item={{ key: book.id, title: book.title, coverUrl: getCoverUrl(book.cover), language: formatLanguage(book.language), region: formatRegion(book.region), level: book.level, statsLine: `${book.stories.length} stories`, topicsLine: formatTopic(book.topic), description: book.description ?? book.subtitle ?? undefined, onPress: () => openBook(book) }} />)) : filteredStandaloneStoryCards.map((item) => (<ExploreStoryListCard key={`explore-individual-expanded-${item.key}`} item={item} />))}
          </View>
        </View>
      ) : (
        <>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionEyebrow}>Read</Text>
                <Text style={styles.sectionTitle}>Stories</Text>
              </View>
              <View style={styles.sectionHeaderActions}>
                <Text style={styles.helperText}>{filteredExploreStories.length} stories</Text>
                {filteredExploreStories.length > 4 ? (
                  <Pressable onPress={() => { setExpandedExploreSection("stories"); shellScrollRef.current?.scrollTo({ y: 0, animated: false }); }}>
                    <Text style={styles.sectionHeaderActionText}>See all</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
            {filteredExploreStories.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="normal" contentContainerStyle={styles.carousel}>
                {filteredExploreStories.map((item) => (<BookHomeCard key={`explore-story-${item.key}`} item={{ key: item.key, title: item.title, coverUrl: item.coverUrl, subtitle: item.subtitle, meta: item.meta, qaLabel: item.key === filteredExploreStories[0]?.key ? "qa-explore-story-card-0" : undefined, onPress: item.onPress ?? (() => {}) }} />))}
              </ScrollView>
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No stories match those filters</Text>
                <Text style={styles.metaLine}>Try a broader language, topic or search query.</Text>
              </View>
            )}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionEyebrow}>Library</Text>
                <Text style={styles.sectionTitle}>Books</Text>
              </View>
              <View style={styles.sectionHeaderActions}>
                <Text style={styles.helperText}>{filteredExploreBooks.length} books</Text>
                {filteredExploreBooks.length > 4 ? (
                  <Pressable onPress={() => { setExpandedExploreSection("books"); shellScrollRef.current?.scrollTo({ y: 0, animated: false }); }}>
                    <Text style={styles.sectionHeaderActionText}>See all</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
            {filteredExploreBooks.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="normal" contentContainerStyle={styles.carousel}>
                {filteredExploreBooks.map((book) => (<BookWebCard key={`explore-book-${book.id}`} item={{ key: book.id, title: book.title, coverUrl: getCoverUrl(book.cover), language: formatLanguage(book.language), region: formatRegion(book.region), level: book.level, statsLine: `${book.stories.length} stories`, topicsLine: formatTopic(book.topic), description: book.description ?? book.subtitle ?? undefined, qaLabel: book.id === filteredExploreBooks[0]?.id ? "qa-explore-book-card-0" : undefined, onPress: () => openBook(book) }} />))}
              </ScrollView>
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No books match those filters</Text>
                <Text style={styles.metaLine}>Try a broader language, region or search query.</Text>
              </View>
            )}
          </View>

          {sessionToken && filteredStandaloneStoryCards.length > 0 ? (
            <View style={styles.section} accessibilityLabel="qa-explore-individual-stories-section" testID="qa-explore-individual-stories-section">
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionEyebrow}>Standalone</Text>
                  <Text style={styles.sectionTitle}>Individual stories</Text>
                </View>
                <View style={styles.sectionHeaderActions}>
                  {loadingRemote ? <Text style={styles.helperText}>Refreshing…</Text> : null}
                  {filteredStandaloneStoryCards.length > 4 ? (
                    <Pressable onPress={() => { setExpandedExploreSection("standalone"); shellScrollRef.current?.scrollTo({ y: 0, animated: false }); }}>
                      <Text style={styles.sectionHeaderActionText}>See all</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="normal" contentContainerStyle={styles.carousel}>
                {filteredStandaloneStoryCards.map((item) => (<BookHomeCard key={`explore-individual-${item.key}`} item={{ key: item.key, title: item.title, coverUrl: item.coverUrl, subtitle: item.subtitle, meta: item.meta, onPress: item.onPress ?? (() => {}) }} />))}
              </ScrollView>
            </View>
          ) : (
            <View style={styles.section}>
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No individual stories match those filters</Text>
                <Text style={styles.metaLine}>Try a broader language, region or topic.</Text>
              </View>
            </View>
          )}
        </>
      )}
    </>
  );

  const practiceView = (
    <>
      <View style={styles.hero}>
        <View style={styles.heroHeaderRow}>
          <View style={styles.heroTextBlock}>
            <Text style={styles.eyebrow}>{favoriteWords.length > 0 ? "Pick a mode" : "Get started"}</Text>
            <Text style={styles.title}>Practice</Text>
            <Text style={styles.practiceSubtitle}>
              {favoriteWords.length > 0
                ? "Four fast review modes."
                : "Save words while reading and they will appear here as practice modes."}
            </Text>
          </View>
          <MenuTrigger onPress={() => setMenuOpen(true)} />
        </View>
      </View>

      {!isSignedIn ? (
        <View style={[styles.card, styles.accountCard]}>
          <Text style={styles.sectionTitle}>Sign in to practice</Text>
          <Text style={styles.metaLine}>
            Practice your saved vocabulary with meaning, context, listening and matching rounds.
          </Text>
          <Pressable
            onPress={onRequestSignIn}
            style={[styles.inlineButton, styles.primaryButton]}
          >
            <Text style={[styles.inlineButtonText, styles.primaryButtonText]}>Sign in</Text>
          </Pressable>
        </View>
      ) : favoriteWords.length === 0 ? (
        <View style={[styles.card, styles.accountCard]}>
          <Text style={styles.sectionTitle}>No saved vocabulary yet</Text>
          <Text style={styles.metaLine}>
            Save words while reading and they will appear here as exercises.
          </Text>
          <View style={styles.bookActionsRow}>
            <Pressable
              onPress={() => setActiveScreen("explore")}
              style={[styles.inlineButton, styles.primaryButton]}
            >
              <Text style={[styles.inlineButtonText, styles.primaryButtonText]}>Explore stories</Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveScreen("favorites")}
              style={styles.inlineButton}
            >
              <Text style={styles.inlineButtonText}>Open favorites</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <>
          {practiceLoadError ? (
            <View style={[styles.card, styles.accountCard, styles.practiceErrorCard]}>
              <Text style={styles.errorText}>{practiceLoadError}</Text>
            </View>
          ) : null}
          <View style={styles.practiceGridShell}>
            <View style={styles.practiceGrid}>
            {visiblePracticeCards.map((card) => (
              <Pressable
                key={card.key}
                onPress={() => void openPracticeMode(card.key)}
                style={[
                  styles.practiceModeCard,
                  { backgroundColor: card.background },
                ]}
              >
                <View style={styles.practiceModeHeader}>
                  <View style={styles.practiceModeHeaderText}>
                    <Text style={styles.practiceModeEyebrow}>{card.eyebrow}</Text>
                    <Text style={styles.practiceModeTitle}>{card.title}</Text>
                  </View>
                  <View style={[styles.practiceModeIconWrap, { borderColor: `${card.accent}55` }]}>
                    <PracticeModeIcon icon={card.icon} color={card.accent} />
                  </View>
                </View>
                <View style={styles.practiceModeBody}>
                  <Text numberOfLines={2} style={styles.practiceModeDetail}>{card.detail}</Text>
                </View>
                <View style={styles.practiceModeFooter}>
                  <View style={styles.practiceModeFooterMeta}>
                    {card.key === recommendedPracticeMode ? (
                      <View style={styles.practiceRecommendedBadge}>
                        <Text style={styles.practiceRecommendedText}>Best next</Text>
                      </View>
                    ) : null}
                    <View style={styles.practiceModeMetaPill}>
                      <Text style={styles.practiceModeMetaText}>
                        {favoriteWords.length} ready
                      </Text>
                    </View>
                  </View>
                  <View style={styles.practiceModeActionCentered}>
                    <Text style={[styles.practiceModeActionTextLarge, { color: card.background }]}>Play</Text>
                  </View>
                </View>
              </Pressable>
            ))}
            </View>
          </View>

        </>
      )}
    </>
  );

  const practiceSessionView =
    activePracticeMode && activePracticeCard ? (
      <View style={styles.practiceSessionShell}>
        <View
          style={[
            styles.practiceSessionCard,
            { backgroundColor: activePracticeCard.background, borderColor: `${activePracticeCard.accent}33` },
          ]}
        >
          <View style={styles.practiceSessionGlow} />
          <View style={styles.practiceSessionHeader}>
            <Pressable onPress={closePracticeSession} style={styles.practiceSessionClose}>
              <Feather name="arrow-left" size={18} color="#f5f7fb" />
            </Pressable>
            <View style={styles.practiceSessionTitleWrap}>
              <Text style={styles.practiceSessionEyebrow}>{activePracticeCard.eyebrow}</Text>
              <Text style={styles.practiceSessionTitle}>{activePracticeCard.title}</Text>
            </View>
            <View style={[styles.practiceModeIconWrap, styles.practiceSessionIconWrap, { borderColor: `${activePracticeCard.accent}55` }]}>
              <PracticeModeIcon icon={activePracticeCard.icon} color={activePracticeCard.accent} />
            </View>
          </View>

          {practiceComplete ? (
            <View style={styles.practiceResultCard}>
              <View style={styles.practiceFocusPill}>
                <Feather name="award" size={13} color={activePracticeCard.accent} />
                <Text style={styles.practiceFocusPillText}>Session complete</Text>
              </View>
              <Text style={styles.practiceResultScore}>
                {practiceScore}/{practiceExercises.length}
              </Text>
              <Text style={styles.practiceResultText}>
                {practiceLaunchContext.source === "journey" && practiceLaunchContext.kind === "checkpoint"
                  ? checkpointPassed
                    ? practiceCheckpointSaveState === "saved"
                      ? "Checkpoint passed. The next step is now available."
                      : practiceCheckpointSaveState === "error"
                        ? "Checkpoint passed, but we could not save it yet."
                        : "Checkpoint passed. Saving your result..."
                    : `${Math.max(0, Math.ceil(CHECKPOINT_PASS_THRESHOLD * practiceExercises.length) - practiceScore)} more correct answers needed to pass.`
                  : practiceScore === practiceExercises.length
                    ? "Perfect round. Your saved words are ready for the next step."
                    : "Nice run. Repeat this mode or switch to another one to lock the words in."}
              </Text>
              {practiceLaunchContext.source === "journey" && practiceLaunchContext.kind === "checkpoint" ? (
                <Text style={styles.practiceResultStatusText}>
                  {practiceCheckpointSaveState === "saving"
                    ? "Saving checkpoint..."
                    : practiceCheckpointSaveState === "saved"
                      ? "Checkpoint saved. The next step is now available."
                      : practiceCheckpointSaveState === "error"
                        ? "Checkpoint passed, but we could not save it yet."
                        : "Checkpoint ready to save."}
                </Text>
              ) : null}
              {practiceLaunchContext.source === "journey" &&
              practiceLaunchContext.kind === "checkpoint" &&
              !checkpointPassed &&
              checkpointRecoveryWords.length > 0 ? (
                <View style={styles.practiceRecoveryCard}>
                  <Text style={styles.practiceRecoveryTitle}>Review these first</Text>
                  <Text style={styles.practiceRecoveryBody}>
                    Focus on {checkpointRecoveryWords.join(" · ")} before retrying the checkpoint.
                  </Text>
                  {checkpointRecoveryMode ? (
                    <Text style={styles.practiceRecoveryHint}>
                      Best next step: {getPracticeModeLabel(checkpointRecoveryMode)} review.
                    </Text>
                  ) : null}
                  <View style={styles.practiceRecoveryWords}>
                    {checkpointRecoveryWords.map((word) => (
                      <View key={word} style={styles.practiceRecoveryWordChip}>
                        <Text style={styles.practiceRecoveryWordText}>{word}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
              {practiceLaunchContext.source === "journey" &&
              practiceLaunchContext.reviewFocus &&
              (practiceJourneyReviewMeta?.dueCount ?? practiceLaunchContext.reviewDueCount ?? 0) > 0 ? (
                <Text style={styles.practiceResultStatusText}>
                  Review focus: {(practiceJourneyReviewMeta?.dueCount ?? practiceLaunchContext.reviewDueCount ?? 0)} due
                  {(practiceJourneyReviewMeta?.focusWords ?? practiceLaunchContext.focusWords ?? []).length > 0
                    ? ` · ${(practiceJourneyReviewMeta?.focusWords ?? practiceLaunchContext.focusWords ?? [])
                        .slice(0, 3)
                        .join(" · ")}`
                    : ""}
                </Text>
              ) : null}
              <View style={styles.practiceResultActions}>
                <Pressable
                  onPress={() => void openPracticeMode(activePracticeMode, false)}
                  style={[styles.inlineButton, styles.primaryButton]}
                >
                  <Text style={[styles.inlineButtonText, styles.primaryButtonText]}>
                    {practiceLaunchContext.source === "journey" && practiceLaunchContext.kind === "checkpoint"
                      ? "Retry checkpoint"
                      : "Play again"}
                  </Text>
                </Pressable>
                {practiceLaunchContext.source === "journey" &&
                practiceLaunchContext.kind === "checkpoint" &&
                !checkpointPassed &&
                checkpointRecoveryMode &&
                checkpointMissedItems.length > 0 ? (
                  <Pressable
                    onPress={() => void openPracticeMode(checkpointRecoveryMode, true, checkpointMissedItems)}
                    style={styles.inlineButton}
                  >
                    <Text style={styles.inlineButtonText}>Review weak spots</Text>
                  </Pressable>
                ) : null}
                <Pressable onPress={closePracticeSession} style={styles.inlineButton}>
                  <Text style={styles.inlineButtonText}>Done</Text>
                </Pressable>
              </View>
            </View>
          ) : currentPracticeExercise ? (
            <>
              <View style={styles.practiceSessionMeta}>
                <View style={styles.practiceSessionProgressWrap}>
                  <Text style={styles.practiceSessionProgressLabel}>{practiceProgressLabel}</Text>
                  <View style={styles.practiceSessionProgressTrack}>
                    <View
                      style={[
                        styles.practiceSessionProgressBar,
                        {
                          width: `${((practiceIndex + 1) / Math.max(practiceExercises.length, 1)) * 100}%`,
                          backgroundColor: activePracticeCard.accent,
                        },
                      ]}
                    />
                  </View>
                </View>
                <Text style={styles.practiceSessionHelper}>{currentPracticeExercise.helper}</Text>
                <View style={styles.practiceSessionStatusRow}>
                  <View
                    style={[
                      styles.practiceSessionStatusPill,
                      practiceLastResult === "correct"
                        ? styles.practiceSessionStatusPillCorrect
                        : practiceLastResult === "wrong"
                          ? styles.practiceSessionStatusPillWrong
                          : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.practiceSessionStatusText,
                        practiceLastResult ? styles.practiceSessionStatusTextActive : null,
                      ]}
                    >
                      {practiceLastResult === "correct"
                        ? "Correct"
                        : practiceLastResult === "wrong"
                          ? "Try again"
                          : "In progress"}
                    </Text>
                  </View>
                  <View style={styles.practiceScorePill}>
                    <Text style={styles.practiceScorePillText}>Streak {practiceSessionStreak}</Text>
                  </View>
                  <View style={styles.practiceScorePill}>
                    <Text style={styles.practiceScorePillText}>Score {practiceScore}</Text>
                  </View>
                </View>
              </View>

              <ScrollView
                style={styles.practiceExerciseScroll}
                contentContainerStyle={styles.practiceExerciseScrollContent}
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
                {currentPracticeExercise.kind === "multiple-choice" ? (
                  <View style={styles.practiceQuestionCard}>
                    <Text style={styles.practicePrompt}>{currentPracticeExercise.prompt}</Text>
                    {currentPracticeExercise.mode === "meaning" || currentPracticeExercise.mode === "listening" ? (
                      <View style={styles.practiceTargetWrap}>
                        <Text style={styles.practiceTargetLabel}>Target word</Text>
                        <Text style={styles.practiceTargetWord}>{currentPracticeExercise.favorite.word}</Text>
                      </View>
                    ) : null}
                    {currentPracticeExercise.mode === "listening" ? (
                      <Pressable
                        onPress={playPracticePrompt}
                        disabled={!practiceSpeechAvailable}
                        style={[
                          styles.practiceListenButton,
                          !practiceSpeechAvailable ? styles.practiceListenButtonDisabled : null,
                        ]}
                      >
                        <Feather
                          name={speakingPracticePromptId === currentPracticeExercise.id ? "square" : "volume-2"}
                          size={16}
                          color={practiceSpeechAvailable ? "#f5f7fb" : "#8ea2bc"}
                        />
                        <Text
                          style={[
                            styles.practiceListenButtonText,
                            !practiceSpeechAvailable ? styles.practiceListenButtonTextDisabled : null,
                          ]}
                        >
                          {!practiceSpeechAvailable
                            ? "Voice unavailable in this build"
                            : speakingPracticePromptId === currentPracticeExercise.id
                              ? "Stop"
                              : "Play"}
                        </Text>
                      </Pressable>
                    ) : null}
                    {currentPracticeExercise.audioClip ? (
                      <Pressable
                        onPress={() => {
                          void playPracticeContextClip();
                        }}
                        style={[
                          styles.practiceListenButton,
                          currentPracticeExercise.audioClip.storySource === "user" && !practiceSpeechAvailable
                            ? styles.practiceListenButtonDisabled
                            : null,
                        ]}
                        disabled={
                          currentPracticeExercise.audioClip.storySource === "user" && !practiceSpeechAvailable
                        }
                      >
                        <Feather
                          name={
                            currentPracticeExercise.audioClip.storySource === "user"
                              ? speakingPracticePromptId === currentPracticeExercise.id
                                ? "square"
                                : "volume-2"
                              : playingPracticeClipId === currentPracticeExercise.id
                                ? "square"
                                : "play"
                          }
                          size={16}
                          color={
                            currentPracticeExercise.audioClip.storySource === "user" && !practiceSpeechAvailable
                              ? "#8ea2bc"
                              : "#f5f7fb"
                          }
                        />
                        <Text
                          style={[
                            styles.practiceListenButtonText,
                            currentPracticeExercise.audioClip.storySource === "user" && !practiceSpeechAvailable
                              ? styles.practiceListenButtonTextDisabled
                              : null,
                          ]}
                        >
                          {currentPracticeExercise.audioClip.storySource === "user" && !practiceSpeechAvailable
                            ? "Voice unavailable in this build"
                            : currentPracticeExercise.audioClip.storySource === "user"
                              ? speakingPracticePromptId === currentPracticeExercise.id
                                ? "Stop context"
                                : "Play context"
                              : playingPracticeClipId === currentPracticeExercise.id
                                ? "Stop clip"
                                : "Play clip"}
                        </Text>
                      </Pressable>
                    ) : null}
                    {currentPracticeExercise.sentence ? (
                      <Text style={styles.practiceSentence}>{currentPracticeExercise.sentence}</Text>
                    ) : null}
                    {practiceRevealed &&
                    practiceLaunchContext.source === "favorites" &&
                    practiceLaunchContext.kind === "related" &&
                    currentPracticeFavoriteItem ? (
                      <Pressable
                        onPress={() =>
                          currentPracticeFavoriteSaved
                            ? void removeFavoriteItem(currentPracticeFavoriteItem)
                            : void saveFavoriteItem(currentPracticeFavoriteItem)
                        }
                        style={styles.practiceRelatedFavoriteButton}
                      >
                        <Text style={styles.practiceRelatedFavoriteButtonText}>
                          {currentPracticeFavoriteSaved ? "Remove from favorites" : "Save to favorites"}
                        </Text>
                      </Pressable>
                    ) : null}
                    <View style={styles.practiceOptions}>
                      {currentPracticeExercise.options.map((option) => {
                        const isSelected = practiceSelectedOption === option;
                        const isCorrect = practiceRevealed && option === currentPracticeExercise.answer;
                        const isWrong = practiceRevealed && isSelected && option !== currentPracticeExercise.answer;
                        return (
                          <Pressable
                            key={option}
                            onPress={() => choosePracticeOption(option)}
                            disabled={practiceRevealed}
                            style={[
                              styles.practiceOption,
                              isSelected ? styles.practiceOptionSelected : null,
                              isCorrect ? styles.practiceOptionCorrect : null,
                              isWrong ? styles.practiceOptionWrong : null,
                            ]}
                          >
                            <Text
                              style={[
                                styles.practiceOptionText,
                                isCorrect || isWrong ? styles.practiceOptionTextOnAccent : null,
                              ]}
                            >
                              {option}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                ) : (
                  <View style={styles.practiceQuestionCard}>
                    <Text style={styles.practicePrompt}>{currentPracticeExercise.prompt}</Text>
                    <Text style={styles.practiceSentence}>Tap a word, then choose its meaning.</Text>
                    <View style={styles.practiceMatchColumns}>
                      <View style={styles.practiceMatchColumn}>
                        <Text style={styles.practiceMatchLabel}>Words</Text>
                        {currentPracticeExercise.pairs.map((pair) => {
                          const isMatched = matchedWords.includes(pair.word);
                          const isActive = activeMatchWord === pair.word;
                          return (
                            <Pressable
                              key={pair.word}
                              onPress={() => {
                                if (practiceRevealed) return;
                                setActiveMatchWord((current) => (current === pair.word ? null : pair.word));
                              }}
                              style={[
                                styles.practiceMatchChip,
                                isActive ? styles.practiceMatchChipActive : null,
                                isMatched ? styles.practiceMatchChipCorrect : null,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.practiceMatchChipText,
                                  isMatched ? styles.practiceOptionTextOnAccent : null,
                                ]}
                              >
                                {pair.word}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                      <View style={styles.practiceMatchColumn}>
                        <Text style={styles.practiceMatchLabel}>Meanings</Text>
                        {currentPracticeExercise.pairs.map((pair) => pair.answer).map((meaning) => {
                          const matchedPair = currentPracticeExercise.pairs.find(
                            (pair) => pair.answer === meaning && matchedWords.includes(pair.word)
                          );
                          return (
                            <Pressable
                              key={meaning}
                              onPress={() => chooseMatchValue(meaning)}
                              disabled={practiceRevealed || !activeMatchWord || Boolean(matchedPair)}
                              style={[
                                styles.practiceMatchMeaning,
                                matchedPair ? styles.practiceMatchChipCorrect : null,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.practiceMatchMeaningText,
                                  matchedPair ? styles.practiceOptionTextOnAccent : null,
                                ]}
                              >
                                {meaning}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  </View>
                )}
              </ScrollView>

              <View style={styles.practiceFooter}>
                {practiceRevealed ? (
                  <Pressable onPress={advancePractice} style={[styles.inlineButton, styles.primaryButton, styles.practiceFooterButton]}>
                    <Text style={[styles.inlineButtonText, styles.primaryButtonText]}>
                      {practiceIndex >= practiceExercises.length - 1 ? "Finish" : "Next"}
                    </Text>
                  </Pressable>
                ) : currentPracticeExercise.kind === "multiple-choice" && practiceSelectedOption ? (
                  <Pressable onPress={checkPracticeAnswer} style={[styles.inlineButton, styles.primaryButton, styles.practiceFooterButton]}>
                    <Text style={[styles.inlineButtonText, styles.primaryButtonText]}>Check</Text>
                  </Pressable>
                ) : (
                  <Text style={styles.practiceFooterHint}>
                    {currentPracticeExercise.kind === "match"
                      ? activeMatchWord
                        ? "Now choose the matching meaning."
                        : "Choose a word to begin."
                      : "Select an answer to continue."}
                  </Text>
                )}
              </View>
            </>
          ) : null}
        </View>
      </View>
    ) : null;

  const favoritesView = (
    <>
      <View style={styles.hero}>
        <View style={styles.heroHeaderRow}>
          <View style={styles.heroTextBlock}>
            <Text style={styles.eyebrow}>Favorites</Text>
            <Text style={styles.title}>Saved vocabulary</Text>
            <Text style={styles.subtitle}>
              Tap highlighted words inside a story to save them here and reopen the story later.
            </Text>
          </View>
          <MenuTrigger onPress={() => setMenuOpen(true)} />
        </View>
      </View>

      {favoriteCards.length > 0 ? (
        <>
          <View style={styles.favoritesCompactBar}>
            <View style={styles.favoritesCompactStats}>
              {dueFavoritesCount > 0 ? (
                <View style={styles.favoritesCompactPill}>
                  <Text style={styles.favoritesCompactDueText}>{dueFavoritesCount} due</Text>
                </View>
              ) : null}
              <View style={styles.favoritesCompactPill}>
                <Text style={styles.favoritesCompactPillText}>{favoriteWords.length} total</Text>
              </View>
              <View style={styles.favoritesCompactPill}>
                <Text style={styles.favoritesCompactPillText}>{formatStreakLabel(Math.max(maxFavoriteStreak, 1))}</Text>
              </View>
            </View>
            <View style={styles.favoritesCompactActions}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="normal" contentContainerStyle={styles.favoritesModePills}>
                <Pressable
                  onPress={() => {
                    setFavoritePracticeModeKind("due");
                    setActiveScreen("practice");
                    void openPracticeMode(recommendedPracticeMode, true, undefined, "due");
                  }}
                  style={[
                    styles.favoritesModePill,
                    favoritePracticeModeKind === "due" ? styles.favoritesModePillActive : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.favoritesModePillText,
                      favoritePracticeModeKind === "due" ? styles.favoritesModePillTextActive : null,
                    ]}
                  >
                    Due
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setFavoritePracticeModeKind("all");
                    setActiveScreen("practice");
                    void openPracticeMode(recommendedPracticeMode, false, undefined, "all");
                  }}
                  style={[
                    styles.favoritesModePill,
                    favoritePracticeModeKind === "all" ? styles.favoritesModePillActive : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.favoritesModePillText,
                      favoritePracticeModeKind === "all" ? styles.favoritesModePillTextActive : null,
                    ]}
                  >
                    All
                  </Text>
                </Pressable>
                {relatedPracticeAvailable ? (
                  <Pressable
                    onPress={() => {
                      setFavoritePracticeModeKind("related");
                      setActiveScreen("practice");
                      void openPracticeMode(
                        recommendedPracticeMode,
                        false,
                        buildPracticeFavorites(relatedPracticeCandidates),
                        "related"
                      );
                    }}
                    style={[
                      styles.favoritesModePill,
                      favoritePracticeModeKind === "related" ? styles.favoritesModePillActive : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.favoritesModePillText,
                        favoritePracticeModeKind === "related" ? styles.favoritesModePillTextActive : null,
                      ]}
                    >
                      Related
                    </Text>
                  </Pressable>
                ) : null}
              </ScrollView>
            </View>
            {availableFavoriteTypes.length > 2 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="normal" contentContainerStyle={styles.favoriteFilterChips}>
                {availableFavoriteTypes.map((type) => (
                  <Pressable
                    key={type}
                    onPress={() => setSelectedFavoriteType(type)}
                    style={[
                      styles.filterChip,
                      selectedFavoriteType === type ? styles.filterChipActive : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        selectedFavoriteType === type ? styles.filterChipTextActive : null,
                      ]}
                    >
                      {type === "all"
                        ? getFavoriteTypeLabel(type)
                        : `${getFavoriteTypeLabel(type)} (${favoriteTypeCounts[type] ?? 0})`}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
          </View>

          {filteredFavoriteCards.map(({ key, item, selection }) => {
            const isDue =
              !item.nextReviewAt ||
              Number.isNaN(Date.parse(item.nextReviewAt)) ||
              Date.parse(item.nextReviewAt) <= Date.now();
            return (
            <View key={key} style={styles.favoriteCard}>
              <View style={styles.favoriteHeader}>
                <View style={styles.favoriteIdentity}>
                  <View style={styles.favoriteWordRow}>
                    <Text style={styles.favoriteWord}>{item.word}</Text>
                    <View style={styles.favoriteTypeChip}>
                      <Text style={styles.favoriteTypeChipText}>{getFavoriteTypeLabel(getFavoriteType(item))}</Text>
                    </View>
                    {showFavoriteLanguageChip && item.language ? (
                      <View style={styles.favoriteTypeChip}>
                        <Text style={styles.favoriteTypeChipText}>{item.language.toUpperCase()}</Text>
                      </View>
                    ) : null}
                    <View style={[styles.favoriteTypeChip, isDue ? styles.favoriteTypeChipDue : null]}>
                      <Text style={styles.favoriteTypeChipText}>
                        {isDue ? "Due today" : "Scheduled"}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.favoriteDefinition} numberOfLines={1}>
                    {item.translation}
                  </Text>
                </View>
                <Pressable
                  onPress={() =>
                    void toggleFavoriteWord(
                      {
                        word: item.word,
                        definition: item.translation,
                        type: item.wordType ?? undefined,
                      } as VocabItem,
                      item.exampleSentence ?? undefined
                    )
                  }
                  style={styles.favoriteRemove}
                >
                  <Text style={styles.favoriteRemoveText}>Remove</Text>
                </Pressable>
              </View>
              <Text style={styles.favoriteMeta} numberOfLines={1}>
                {item.storyTitle ?? "Saved from reader"}
              </Text>
              {selection ? (
                <Pressable
                  onPress={() =>
                    openSelection({
                      book: selection.book,
                      story: selection.story,
                      resolvedAudioUrl:
                        offlineStoriesById.get(selection.story.id)?.localAudioUri ?? selection.story.audio,
                    })
                  }
                  style={styles.favoriteOpenButton}
                >
                  <Text style={styles.favoriteOpenButtonText}>Open story</Text>
                </Pressable>
              ) : null}
            </View>
          );
          })}
        </>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No saved vocabulary yet</Text>
          <Text style={styles.metaLine}>
            Highlighted words from the reader will appear here once you start saving them.
          </Text>
        </View>
      )}
    </>
  );

  const libraryView = (
    <>
      <View style={styles.hero}>
        <View style={styles.heroHeaderRow}>
          <View style={styles.heroTextBlock}>
            <Text style={styles.eyebrow}>My Library</Text>
            <Text style={styles.title}>Your saved reading</Text>
            <Text style={styles.subtitle}>Saved, synced and ready to resume.</Text>
          </View>
          <MenuTrigger onPress={() => setMenuOpen(true)} />
        </View>
      </View>

      {continueReadingCards.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionEyebrow}>Continue</Text>
              <Text style={styles.sectionTitle}>Continue reading</Text>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="normal" contentContainerStyle={styles.carousel}>
            {continueReadingCards.map((item) => (
              <BookHomeCard
                key={item.key}
                item={{
                  key: item.key,
                  title: item.title,
                  coverUrl: item.coverUrl,
                  subtitle: item.subtitle,
                  meta: item.meta,
                  progressLabel: item.progressLabel,
                  onPress: item.onPress ?? (() => {}),
                }}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={[styles.card, styles.accountCard, styles.librarySnapshotCard]}>
        <View style={styles.librarySnapshotHeader}>
          <Text style={styles.sectionTitle}>Library snapshot</Text>
          <View style={styles.libraryMiniActions}>
            <Pressable
              onPress={() => {
                if (continueReadingCards[0]?.onPress) {
                  continueReadingCards[0].onPress();
                  return;
                }
                if (remoteStoryCards[0]?.onPress) {
                  remoteStoryCards[0].onPress();
                  return;
                }
                if (savedStoryCards[0]?.onPress) {
                  savedStoryCards[0].onPress();
                  return;
                }
                setActiveScreen("explore");
              }}
              style={[styles.inlineButton, styles.primaryButton, styles.libraryMiniActionPrimary]}
            >
              <Text style={[styles.inlineButtonText, styles.primaryButtonText]}>
                {continueReadingCards.length > 0
                  ? "Resume"
                  : remoteStoryCards.length > 0
                    ? "Open synced"
                    : savedStoryCards.length > 0
                      ? "Open saved"
                      : "Browse"}
              </Text>
            </Pressable>
            <Pressable onPress={() => setActiveScreen("explore")} style={[styles.inlineButton, styles.libraryMiniActionGhost]}>
              <Text style={styles.inlineButtonText}>Add more</Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryTile}>
            <Text style={styles.summaryValue}>{savedBooks.length}</Text>
            <Text style={styles.summaryLabel}>Saved books</Text>
          </View>
          <View style={styles.summaryTile}>
            <Text style={styles.summaryValue}>{savedStoryCards.length}</Text>
            <Text style={styles.summaryLabel}>Saved stories</Text>
          </View>
          <View style={styles.summaryTile}>
            <Text style={styles.summaryValue}>{remoteStoryCards.length}</Text>
            <Text style={styles.summaryLabel}>Synced stories</Text>
          </View>
          <View style={styles.summaryTile}>
            <Text style={styles.summaryValue}>{offlineSnapshot?.stories.length ?? 0}</Text>
            <Text style={styles.summaryLabel}>Offline ready</Text>
          </View>
        </View>
        {remoteProgress ? (
          <Text style={styles.helperText}>
            {remoteProgress.weeklyStoriesFinished} story{remoteProgress.weeklyStoriesFinished === 1 ? "" : "ies"} finished this week · {remoteProgress.weeklyMinutesListened} min listened
          </Text>
        ) : null}
        <View style={styles.libraryMicroStats}>
          <View style={styles.libraryMicroStat}>
            <Text style={styles.libraryMicroStatValue}>{continueReadingCards.length}</Text>
            <Text style={styles.libraryMicroStatLabel}>In motion</Text>
          </View>
          <View style={styles.libraryMicroStat}>
            <Text style={styles.libraryMicroStatValue}>{remoteProgress?.weeklyPracticeSessions ?? 0}</Text>
            <Text style={styles.libraryMicroStatLabel}>This week</Text>
          </View>
          <View style={styles.libraryMicroStat}>
            <Text style={styles.libraryMicroStatValue}>{savedStoryCards.length}</Text>
            <Text style={styles.libraryMicroStatLabel}>Local</Text>
          </View>
          <View style={styles.libraryMicroStat}>
            <Text style={styles.libraryMicroStatValue}>{remoteStoryCards.length}</Text>
            <Text style={styles.libraryMicroStatLabel}>Synced</Text>
          </View>
        </View>
        <Pressable onPress={() => setActiveScreen("favorites")} style={styles.libraryInlineLink}>
          <Text style={styles.libraryInlineLinkText}>Open favorites</Text>
          <Feather name="arrow-right" size={15} color="#dbe9ff" />
        </Pressable>
      </View>

      {offlineReadyStoryCards.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionEyebrow}>Offline</Text>
              <Text style={styles.sectionTitle}>Ready without internet</Text>
            </View>
            <Text style={styles.helperText}>{offlineReadyStoryCards.length} stories</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="normal" contentContainerStyle={styles.carousel}>
            {offlineReadyStoryCards.map((item) => (
              <BookHomeCard
                key={`offline-${item.key}`}
                item={{
                  key: item.key,
                  title: item.title,
                  coverUrl: item.coverUrl,
                  subtitle: item.subtitle,
                  meta: item.meta,
                  progressLabel: item.progressLabel,
                  onPress: item.onPress ?? (() => {}),
                }}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>Saved stories</Text>
            <Text style={styles.sectionTitle}>Your reading shelf</Text>
          </View>
          <Text style={styles.helperText}>
            {savedStoryCards.length > 0 ? `${savedStoryCards.length} stories` : "Save stories to build your shelf"}
          </Text>
        </View>
        {savedStoryCards.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="normal" contentContainerStyle={styles.carousel}>
            {savedStoryCards.map((item) => (
              <BookHomeCard
                key={`library-${item.key}`}
                item={{
                  key: item.key,
                  title: item.title,
                  coverUrl: item.coverUrl,
                  subtitle: item.subtitle,
                  meta: item.meta,
                  progressLabel: item.progressLabel,
                  onPress: item.onPress ?? (() => {}),
                }}
              />
            ))}
          </ScrollView>
        ) : latestStoryCards.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="normal" contentContainerStyle={styles.carousel}>
            {latestStoryCards.map((item) => (
              <BookHomeCard
                key={`suggested-story-${item.key}`}
                item={{
                  key: item.key,
                  title: item.title,
                  coverUrl: item.coverUrl,
                  subtitle: item.subtitle,
                  meta: item.meta,
                  progressLabel: item.progressLabel,
                  onPress: item.onPress ?? (() => {}),
                }}
              />
            ))}
          </ScrollView>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No saved stories yet</Text>
            <Text style={styles.metaLine}>Open a story and save it to build your shelf.</Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>Books</Text>
            <Text style={styles.sectionTitle}>Books in your library</Text>
          </View>
          <Text style={styles.helperText}>
            {(savedBooks.length > 0 ? savedBooks.length : remoteBookCards.length)} books
          </Text>
        </View>
        {savedBooks.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="normal" contentContainerStyle={styles.carousel}>
            {savedBooks.map((book) => (
              <BookWebCard
                key={`library-book-${book.id}`}
                item={{
                  key: book.id,
                  title: book.title,
                  coverUrl: getCoverUrl(book.cover),
                  language: formatLanguage(book.language),
                  region: formatRegion(book.region),
                  level: book.level,
                  statsLine: `${book.stories.length} stories`,
                  topicsLine: formatTopic(book.topic),
                  description: book.description ?? book.subtitle ?? undefined,
                  onPress: () => openBook(book),
                }}
              />
            ))}
          </ScrollView>
        ) : remoteBookCards.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="normal" contentContainerStyle={styles.carousel}>
            {remoteBookCards.map((item) => (
              <BookWebCard
                key={item.key}
                item={{
                  key: item.key,
                  title: item.title,
                  coverUrl: item.coverUrl,
                  onPress: item.onPress,
                }}
              />
            ))}
          </ScrollView>
        ) : latestBookCards.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="normal" contentContainerStyle={styles.carousel}>
            {latestBookCards.map((item) => (
              <BookWebCard
                key={`suggested-book-${item.key}`}
                item={{
                  key: item.key,
                  title: item.title,
                  coverUrl: item.coverUrl,
                  onPress: item.onPress,
                }}
              />
            ))}
          </ScrollView>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No books yet</Text>
            <Text style={styles.metaLine}>Books you save from Explore will appear here.</Text>
          </View>
        )}
      </View>

      {syncedOnlyStoryCards.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionEyebrow}>From your account</Text>
              <Text style={styles.sectionTitle}>Synced stories</Text>
            </View>
            <Text style={styles.helperText}>{syncedOnlyStoryCards.length} stories</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="normal" contentContainerStyle={styles.carousel}>
            {syncedOnlyStoryCards.map((item) => (
              <BookHomeCard
                key={`library-remote-${item.key}`}
                item={{
                  key: item.key,
                  title: item.title,
                  coverUrl: item.coverUrl,
                  subtitle: item.subtitle,
                  meta: item.meta,
                  progressLabel: item.progressLabel,
                  onPress: item.onPress ?? (() => {}),
                }}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}
    </>
  );

  const reminderPreview = buildDailyReminderCopy({
    learningGoal: preferences.learningGoal,
    dailyMinutes: preferences.dailyMinutes,
    context:
      continueReading.length > 0
        ? {
            continueStoryTitle: continueReading[0]?.story.title,
            continueBookTitle: continueReading[0]?.book.title,
            continueBookSlug: continueReading[0]?.book.slug,
            continueStorySlug: continueReading[0]?.story.slug,
          }
        : dueFavoritesCount > 0
          ? { dueReviewCount: dueFavoritesCount }
          : null,
  });

  const settingsPickerTitle =
    settingsPickerSection === "language"
      ? "Choose language"
      : settingsPickerSection === "level"
        ? "Choose level"
        : settingsPickerSection === "variant"
          ? "Choose variant"
          : settingsPickerSection === "region"
            ? "Choose region"
            : settingsPickerSection === "goal"
              ? "Choose goal"
              : settingsPickerSection === "journeyFocus"
                ? "Choose journey focus"
                : settingsPickerSection === "dailyMinutes"
                  ? "Choose daily plan"
                  : "Choose interests";

  const settingsPickerOptions =
    settingsPickerSection === "language"
      ? LANGUAGE_OPTIONS.map((language) => ({
          key: `settings-language-${language}`,
          label: language,
          active: preferences.targetLanguages[0] === language,
          onPress: () => {
            setPreferences((current) => ({
              ...current,
              targetLanguages: [language],
              preferredVariant:
                (VARIANT_OPTIONS_BY_LANGUAGE[language.toLowerCase()] ?? []).some(
                  (option) => option.value === current.preferredVariant
                )
                  ? current.preferredVariant
                  : null,
              preferredRegion: getRegionOptionsForLanguage(language).includes(current.preferredRegion ?? "")
                ? current.preferredRegion
                : null,
            }));
            setPreferencesStatus("idle");
            setSettingsPickerSection(null);
          },
        }))
      : settingsPickerSection === "level"
        ? [
            {
              key: "settings-level-none",
              label: "No preference",
              active: !preferences.preferredLevel,
              onPress: () => {
                setPreferences((current) => ({ ...current, preferredLevel: null }));
                setPreferencesStatus("idle");
                setSettingsPickerSection(null);
              },
            },
            ...LEVEL_OPTIONS.map((level) => ({
              key: `settings-level-${level}`,
              label: level,
              active: preferences.preferredLevel === level,
              onPress: () => {
                setPreferences((current) => ({ ...current, preferredLevel: level }));
                setPreferencesStatus("idle");
                setSettingsPickerSection(null);
              },
            })),
          ]
        : settingsPickerSection === "variant"
          ? [
              {
                key: "settings-variant-none",
                label: "No preference",
                active: !preferences.preferredVariant,
                onPress: () => {
                  setPreferences((current) => ({ ...current, preferredVariant: null }));
                  setPreferencesStatus("idle");
                  setSettingsPickerSection(null);
                },
              },
              ...settingsAvailableVariants.map((variant) => ({
                key: `settings-variant-${variant.value}`,
                label: formatVariantLabel(variant.value) ?? variant.label,
                active: preferences.preferredVariant === variant.value,
                onPress: () => {
                  setPreferences((current) => ({ ...current, preferredVariant: variant.value }));
                  setPreferencesStatus("idle");
                  setSettingsPickerSection(null);
                },
              })),
            ]
          : settingsPickerSection === "region"
            ? [
                {
                  key: "settings-region-none",
                  label: "No preference",
                  active: !preferences.preferredRegion,
                  onPress: () => {
                    setPreferences((current) => ({ ...current, preferredRegion: null }));
                    setPreferencesStatus("idle");
                    setSettingsPickerSection(null);
                  },
                },
                ...settingsAvailableRegions.map((region) => ({
                  key: `settings-region-${region}`,
                  label: formatRegion(region),
                  active: preferences.preferredRegion === region,
                  onPress: () => {
                    setPreferences((current) => ({ ...current, preferredRegion: region }));
                    setPreferencesStatus("idle");
                    setSettingsPickerSection(null);
                  },
                })),
              ]
            : settingsPickerSection === "interests"
              ? SUGGESTED_INTERESTS.map((interest) => ({
                  key: `settings-interest-${interest}`,
                  label: interest,
                  active: preferences.interests.some((item) => item.toLowerCase() === interest.toLowerCase()),
                  onPress: () => {
                    togglePreferenceInterest(interest);
                  },
                }))
              : settingsPickerSection === "goal"
                ? [
                    {
                      key: "settings-goal-none",
                      label: "No preference",
                      active: !preferences.learningGoal,
                      onPress: () => {
                        setPreferences((current) => ({ ...current, learningGoal: null }));
                        setPreferencesStatus("idle");
                        setSettingsPickerSection(null);
                      },
                    },
                    ...ONBOARDING_GOAL_OPTIONS.map((goal) => ({
                      key: `settings-goal-${goal}`,
                      label: goal,
                      active: preferences.learningGoal === goal,
                      onPress: () => {
                        setPreferences((current) => ({ ...current, learningGoal: goal }));
                        setPreferencesStatus("idle");
                        setSettingsPickerSection(null);
                      },
                    })),
                  ]
                : settingsPickerSection === "journeyFocus"
                  ? JOURNEY_FOCUS_OPTIONS.map((focus) => ({
                      key: `settings-journey-focus-${focus}`,
                      label: focus,
                      active: (preferences.journeyFocus ?? "General") === focus,
                      onPress: () => {
                        setPreferences((current) => ({ ...current, journeyFocus: focus }));
                        setPreferencesStatus("idle");
                        setSettingsPickerSection(null);
                      },
                    }))
                  : settingsPickerSection === "dailyMinutes"
                    ? [
                        {
                          key: "settings-daily-minutes-none",
                          label: "No preference",
                          active: !preferences.dailyMinutes,
                          onPress: () => {
                            setPreferences((current) => ({ ...current, dailyMinutes: null }));
                            setPreferencesStatus("idle");
                            setSettingsPickerSection(null);
                          },
                        },
                        ...ONBOARDING_DAILY_MINUTES_OPTIONS.map((minutes) => ({
                          key: `settings-daily-minutes-${minutes}`,
                          label: `${minutes} min`,
                          active: preferences.dailyMinutes === minutes,
                          onPress: () => {
                            setPreferences((current) => ({ ...current, dailyMinutes: minutes }));
                            setPreferencesStatus("idle");
                            setSettingsPickerSection(null);
                          },
                        })),
                      ]
                    : [];

  const settingsView = (
    <MobileSettingsScreen
      headerAction={<MenuTrigger onPress={() => setMenuOpen(true)} />}
      achievements={
        remoteProgress?.gamification
          ? {
              totalXp: remoteProgress.gamification.totalXp,
              dailyStreak: remoteProgress.gamification.dailyStreak,
              currentLevel: remoteProgress.gamification.currentLevel,
              currentLevelXp: remoteProgress.gamification.totalXp - remoteProgress.gamification.levelStartXp,
              nextLevelXp: remoteProgress.gamification.nextLevelXp - remoteProgress.gamification.levelStartXp,
              badges: remoteProgress.gamification.badges,
            }
          : null
      }
      planLabel={`Current plan: ${remoteEntitlement?.plan ?? sessionPlan ?? "free"}`}
      planBody={
        effectivePlan === "polyglot"
          ? "Creation, reading, favorites and practice are unlocked."
          : "Manage your plan from here. Free users can review available options."
      }
      billingCta={effectivePlan === "free" || effectivePlan === "basic" ? "See plans" : "Manage billing"}
      onPressBilling={() =>
        void ((effectivePlan === "free" || effectivePlan === "basic") ? openWebPath("/plans") : openBillingPortal())
      }
      sessionEmail={sessionEmail}
      personalizationRows={[
        {
          id: "language",
          label: "Target language",
          value: preferences.targetLanguages[0] || settingsPrimaryLanguage || "Choose language",
          onPress: () => setSettingsPickerSection("language"),
        },
        {
          id: "level",
          label: "Level",
          value: preferences.preferredLevel || "No preference",
          onPress: () => setSettingsPickerSection("level"),
        },
        {
          id: "variant",
          label: "Variant",
          value: preferences.preferredVariant
            ? formatVariantLabel(preferences.preferredVariant) ?? preferences.preferredVariant
            : "No preference",
          onPress: () => setSettingsPickerSection("variant"),
        },
        {
          id: "region",
          label: "Region",
          value: preferences.preferredRegion ? formatRegion(preferences.preferredRegion) : "No preference",
          onPress: () => setSettingsPickerSection("region"),
        },
        {
          id: "interests",
          label: "Interests",
          value: preferences.interests.length > 0 ? preferences.interests.slice(0, 2).join(" · ") : "No interests",
          onPress: () => setSettingsPickerSection("interests"),
        },
        {
          id: "goal",
          label: "Goal",
          value: preferences.learningGoal || "No preference",
          onPress: () => setSettingsPickerSection("goal"),
        },
        {
          id: "journeyFocus",
          label: "Journey focus",
          value: preferences.journeyFocus || "General",
          onPress: () => setSettingsPickerSection("journeyFocus"),
        },
        {
          id: "dailyMinutes",
          label: "Daily plan",
          value: typeof preferences.dailyMinutes === "number" ? `${preferences.dailyMinutes} min` : "No preference",
          onPress: () => setSettingsPickerSection("dailyMinutes"),
        },
      ]}
      saveDisabled={!preferencesDirty || preferencesLoading || preferencesStatus === "saving"}
      saveLabel={preferencesStatus === "saving" ? "Saving…" : "Save preferences"}
      onPressSave={() => void savePreferences()}
      preferencesHint={
        preferencesHint
          ? preferencesHint
          : preferencesStatus === "saved"
            ? "Preferences saved."
            : "These settings now save directly from iPhone."
      }
      remindersEnabled={preferences.remindersEnabled}
      onPressRemindersOn={() =>
        setPreferences((current) => ({
          ...current,
          remindersEnabled: true,
          reminderHour: current.reminderHour ?? 18,
        }))
      }
      onPressRemindersOff={() =>
        setPreferences((current) => ({ ...current, remindersEnabled: false, reminderHour: null }))
      }
      reminderOptions={REMINDER_HOUR_OPTIONS.map((hour) => ({
        key: `reminder-${hour}`,
        label: formatReminderHour(hour),
        active: preferences.reminderHour === hour,
        onPress: () => setPreferences((current) => ({ ...current, reminderHour: hour })),
      }))}
      reminderPreviewTitle={preferences.remindersEnabled ? reminderPreview.title : null}
      reminderPreviewBody={preferences.remindersEnabled ? reminderPreview.body : null}
      reminderHint={reminderHint ?? "Enable one short nudge a day."}
      summaryItems={remoteSummaryItems}
      pushMessage={pushState && "message" in pushState ? pushState.message : null}
      showSignOut={Boolean(isSignedIn && onSignOut)}
      onPressSignOut={onSignOut ?? undefined}
      showSignIn={Boolean(!isSignedIn && onRequestSignIn)}
      onPressSignIn={onRequestSignIn ?? undefined}
      pickerVisible={settingsPickerSection !== null}
      pickerTitle={settingsPickerTitle}
      onClosePicker={() => setSettingsPickerSection(null)}
      pickerOptions={settingsPickerOptions}
      showInterestComposer={settingsPickerSection === "interests"}
      customInterestInput={customInterestInput}
      onChangeCustomInterestInput={setCustomInterestInput}
      onAddCustomInterest={addCustomInterest}
      selectedInterests={preferences.interests}
      onRemoveInterest={togglePreferenceInterest}
    />
  );

  const createView = (
    <MobileCreateScreen
      headerAction={<MenuTrigger onPress={() => setMenuOpen(true)} />}
      resumeNotice={createResumeNotice}
      setupRows={[
        {
          id: "language",
          label: "Language",
          value: settingsPrimaryLanguage || "Choose language",
          onPress: () => setCreatePickerSection("language"),
        },
        {
          id: "level",
          label: "Level",
          value: preferences.preferredLevel || "Choose level",
          onPress: () => setCreatePickerSection("level"),
        },
        {
          id: "region",
          label: "Region",
          value: preferences.preferredRegion ? formatRegion(preferences.preferredRegion) : "Any",
          onPress: () => setCreatePickerSection("region"),
        },
        {
          id: "topic",
          label: "Topic",
          value: preferences.interests[0] || "Any topic",
          onPress: () => setCreatePickerSection("topic"),
        },
      ]}
      primaryCtaLabel={
        !createResumeChecked
          ? "Checking previous generation…"
          : createStatus === "generating_text"
            ? "Generating story…"
            : createStatus === "generating_audio"
              ? "Generating audio…"
              : "Generate on iPhone"
      }
      primaryCtaDisabled={
        !createResumeChecked || createStatus === "generating_text" || createStatus === "generating_audio"
      }
      onPressGenerate={() => void generateStoryOnIPhone()}
      saveDefaultsLabel={preferencesStatus === "saving" ? "Saving…" : "Save these defaults"}
      saveDefaultsDisabled={!preferencesDirty || preferencesLoading || preferencesStatus === "saving"}
      onPressSaveDefaults={() => void savePreferences()}
      onPressOpenWebCreate={() => void openCreateWithPrefill()}
      error={createError}
      statusEyebrow={
        createStatus === "generating_text"
          ? "Generating story"
          : createStatus === "generating_audio"
            ? "Generating audio"
            : null
      }
      statusTitle={
        createStatus === "generating_text"
          ? "Building your draft"
          : createStatus === "generating_audio"
            ? "Your story is ready. Narration is still on the way."
            : null
      }
      statusBody={
        createStatus === "generating_text"
          ? "Stay here for a moment while we write the story."
          : createStatus === "generating_audio"
            ? showCreateComeBackLater
              ? "You can leave this screen and come back later. We will keep refreshing the story automatically."
              : "Keep this screen open for a bit longer or come back in a minute."
            : null
      }
      prefillHint={
        preferences.targetLanguages[0] || preferences.preferredLevel || preferences.preferredRegion || preferences.interests[0]
          ? `Prefill: ${[
              preferences.targetLanguages[0],
              preferences.preferredLevel ? formatLevel(preferences.preferredLevel) : null,
              preferences.preferredRegion,
              preferences.interests[0],
            ]
              .filter(Boolean)
              .join(" · ")}`
          : "Save preferences in Settings to keep Create ready on iPhone."
      }
      createdStory={
        createdStory
          ? {
              title: createdStory.title,
              meta: [
                createdStory.language || settingsPrimaryLanguage || null,
                createdStory.level ? formatLevel(createdStory.level) : preferences.preferredLevel ? formatLevel(preferences.preferredLevel) : null,
                createdStory.region || preferences.preferredRegion || null,
              ]
                .filter(Boolean)
                .join(" · "),
              helper:
                createdStory.audioStatus === "failed"
                  ? "Your story is ready, but audio could not be generated this time."
                  : createdStory.audioStatus === "pending"
                    ? "Text is ready now. Audio is still being prepared in the background."
                    : "Your story is ready to open in the reader.",
              onOpenReader: () => openSelection(createSelectionFromGeneratedStory(createdStory)),
              onPractice: () => void openStoryPractice(createSelectionFromGeneratedStory(createdStory)),
              onRefresh: () => void refreshCreatedStory(createdStory.id),
            }
          : null
      }
      recentStories={recentCreatedStories.map((story) => {
        const selection = createSelectionFromGeneratedStory(story);
        const statusLabel =
          story.audioStatus === "failed" ? "Audio unavailable" : story.audioStatus === "pending" ? "Audio pending" : "Ready";
        return {
          key: story.id,
          title: story.title,
          meta: [
            story.language || settingsPrimaryLanguage || null,
            story.level ? formatLevel(story.level) : preferences.preferredLevel ? formatLevel(preferences.preferredLevel) : null,
            statusLabel,
          ]
            .filter(Boolean)
            .join(" · "),
          onRead: () => openSelection(selection),
          onPractice: () => void openStoryPractice(selection),
        };
      })}
      pickerVisible={createPickerSection !== null}
      pickerTitle={
        createPickerSection === "language"
          ? "Choose language"
          : createPickerSection === "level"
            ? "Choose level"
            : createPickerSection === "region"
              ? "Choose region"
              : "Choose topic"
      }
      onClosePicker={() => setCreatePickerSection(null)}
      pickerOptions={
        createPickerSection === "language"
          ? LANGUAGE_OPTIONS.slice(0, 6).map((language) => ({
              key: `picker-language-${language}`,
              label: language,
              active: settingsPrimaryLanguage === language,
              onPress: () => {
                setPreferences((current) => ({
                  ...current,
                  targetLanguages: [language],
                  preferredRegion: getRegionOptionsForLanguage(language).includes(current.preferredRegion ?? "")
                    ? current.preferredRegion
                    : null,
                }));
                setPreferencesStatus("idle");
                setCreatePickerSection(null);
              },
            }))
          : createPickerSection === "level"
            ? LEVEL_OPTIONS.map((level) => ({
                key: `picker-level-${level}`,
                label: level,
                active: preferences.preferredLevel === level,
                onPress: () => {
                  setPreferences((current) => ({ ...current, preferredLevel: level }));
                  setPreferencesStatus("idle");
                  setCreatePickerSection(null);
                },
              }))
            : createPickerSection === "region"
              ? [
                  {
                    key: "picker-region-any",
                    label: "Any",
                    active: !preferences.preferredRegion,
                    onPress: () => {
                      setPreferences((current) => ({ ...current, preferredRegion: null }));
                      setPreferencesStatus("idle");
                      setCreatePickerSection(null);
                    },
                  },
                  ...createAvailableRegions.map((region) => ({
                    key: `picker-region-${region}`,
                    label: formatRegion(region),
                    active: preferences.preferredRegion === region,
                    onPress: () => {
                      setPreferences((current) => ({ ...current, preferredRegion: region }));
                      setPreferencesStatus("idle");
                      setCreatePickerSection(null);
                    },
                  })),
                ]
              : SUGGESTED_INTERESTS.slice(0, 8).map((interest) => ({
                  key: `picker-topic-${interest}`,
                  label: interest,
                  active: preferences.interests.some((item) => item.toLowerCase() === interest.toLowerCase()),
                  onPress: () => {
                    setPreferences((current) => ({
                      ...current,
                      interests: [interest],
                    }));
                    setPreferencesStatus("idle");
                    setCreatePickerSection(null);
                  },
                }))
      }
    />
  );

  const activeJourneyTrack = useMemo(() => {
    if (!remoteJourney?.tracks?.length) return null;
    const preferredTrackId =
      selectedJourneyTrackId ??
      getJourneyVariantFromPreferences(
        remoteJourney.language ?? "Spanish",
        preferences.preferredVariant,
        preferences.preferredRegion
      );
    return remoteJourney.tracks.find((track) => track.id === preferredTrackId) ?? remoteJourney.tracks[0] ?? null;
  }, [preferences.preferredRegion, preferences.preferredVariant, remoteJourney, selectedJourneyTrackId]);
  const activeJourneyLevel = useMemo(() => {
    if (!activeJourneyTrack?.levels?.length) return null;
    return (
      activeJourneyTrack.levels.find((level) => level.id === selectedJourneyLevelId && level.unlocked) ??
      activeJourneyTrack.levels.find((level) => level.unlocked) ??
      activeJourneyTrack.levels[0] ??
      null
    );
  }, [activeJourneyTrack, selectedJourneyLevelId]);
  const activeJourneyTopic = useMemo(() => {
    if (!activeJourneyLevel?.topics?.length) return null;
    return (
      activeJourneyLevel.topics.find((topic) => topic.slug === (journeyDetailTopicId ?? selectedJourneyTopicId) && topic.unlocked) ??
      activeJourneyLevel.topics.find((topic) => topic.unlocked) ??
      activeJourneyLevel.topics[0] ??
      null
    );
  }, [activeJourneyLevel, journeyDetailTopicId, selectedJourneyTopicId]);
  const activeJourneyNextStory = useMemo(() => {
    return activeJourneyTopic?.stories.find((story) => story.unlocked && !story.completed) ?? null;
  }, [activeJourneyTopic]);
  const activeJourneyNextTopic = useMemo(() => {
    if (!activeJourneyLevel || !activeJourneyTopic) return null;
    const currentIndex = activeJourneyLevel.topics.findIndex((topic) => topic.slug === activeJourneyTopic.slug);
    if (currentIndex < 0) return null;
    return (
      activeJourneyLevel.topics
        .slice(currentIndex + 1)
        .find((topic) => topic.unlocked && topic.storyCount > 0) ?? null
    );
  }, [activeJourneyLevel, activeJourneyTopic]);
  const activeJourneyPrimaryAction = useMemo(() => {
    if (!activeJourneyTopic || !activeJourneyLevel) return null;

    if (activeJourneyNextStory) {
      return {
        title: activeJourneyNextStory.completed ? "Resume story" : "Continue story",
        body: activeJourneyNextStory.title,
        cta: activeJourneyNextStory.completed ? "Open story" : "Read next",
        onPress: () => openJourneyStory(activeJourneyNextStory),
      };
    }

    if (activeJourneyTopic.hasDueReview) {
      return {
        title: "Review due",
        body: "Clear due words from this topic before they pile up.",
        cta: "Start review",
        onPress: () => {
          void openJourneyPractice({
            variantId: activeJourneyTrack?.id ?? null,
            levelId: activeJourneyLevel.id,
            topicId: activeJourneyTopic.slug,
            topicLabel: activeJourneyTopic.label,
            review: true,
          });
        },
      };
    }

    if (activeJourneyTopic.complete && !activeJourneyTopic.practiced) {
      return {
        title: "Practice topic",
        body: "You finished the reading. Lock it in with focused practice now.",
        cta: "Open practice",
        onPress: () => {
          void openJourneyPractice({
            variantId: activeJourneyTrack?.id ?? null,
            levelId: activeJourneyLevel.id,
            topicId: activeJourneyTopic.slug,
            topicLabel: activeJourneyTopic.label,
          });
        },
      };
    }

    if (activeJourneyTopic.complete && activeJourneyTopic.practiced && !activeJourneyTopic.checkpointPassed) {
      return {
        title: "Take checkpoint",
        body: "One quick checkpoint unlocks the next step in your journey.",
        cta: "Start checkpoint",
        onPress: () => {
          void openJourneyPractice({
            variantId: activeJourneyTrack?.id ?? null,
            levelId: activeJourneyLevel.id,
            topicId: activeJourneyTopic.slug,
            topicLabel: activeJourneyTopic.label,
            kind: "checkpoint",
          });
        },
      };
    }

    if (activeJourneyTopic.checkpointPassed && activeJourneyNextTopic) {
      return {
        title: "Next topic",
        body: `Move on to ${activeJourneyNextTopic.label}.`,
        cta: "Open next topic",
        onPress: () => {
          setSelectedJourneyTopicId(activeJourneyNextTopic.slug);
          setJourneyDetailTopicId(activeJourneyNextTopic.slug);
        },
      };
    }

    return {
      title: "Browse this topic",
      body: "Explore more stories in the same lane.",
      cta: "Browse in Explore",
      onPress: () =>
        openJourneyTopicInExplore({
          topicLabel: activeJourneyTopic.label,
          trackId: activeJourneyTrack?.id ?? null,
        }),
    };
  }, [activeJourneyLevel, activeJourneyNextStory, activeJourneyNextTopic, activeJourneyTopic, activeJourneyTrack]);
  const reminderContentPreview = useMemo(
    () =>
      buildDailyReminderCopy({
        learningGoal: preferences.learningGoal,
        dailyMinutes: preferences.dailyMinutes,
        context: continueReading.length > 0
          ? {
              continueStoryTitle: continueReading[0]?.story.title,
              continueBookTitle: continueReading[0]?.book.title,
              continueBookSlug: continueReading[0]?.book.slug,
              continueStorySlug: continueReading[0]?.story.slug,
            }
          : dueFavoritesCount > 0
            ? { dueReviewCount: dueFavoritesCount }
            : activeJourneyPrimaryAction
              ? {
                  journeyActionTitle: activeJourneyPrimaryAction.title,
                  journeyActionBody: activeJourneyPrimaryAction.body,
                }
              : null,
      }),
    [activeJourneyPrimaryAction, continueReading, dueFavoritesCount, preferences.dailyMinutes, preferences.learningGoal]
  );

  useEffect(() => {
    if (!activeJourneyTrack) {
      setSelectedJourneyTrackId(null);
      setSelectedJourneyLevelId(null);
      setSelectedJourneyTopicId(null);
      return;
    }

    setSelectedJourneyTrackId((current) => current ?? activeJourneyTrack.id);
  }, [activeJourneyTrack]);

  useEffect(() => {
    if (!activeJourneyTrack?.levels?.length) {
      setSelectedJourneyLevelId(null);
      setJourneyDetailTopicId(null);
      return;
    }

    const nextLevel =
      activeJourneyTrack.levels.find((level) => level.id === selectedJourneyLevelId && level.unlocked) ??
      activeJourneyTrack.levels.find((level) => level.unlocked) ??
      activeJourneyTrack.levels[0];
    if (nextLevel && nextLevel.id !== selectedJourneyLevelId) {
      setSelectedJourneyLevelId(nextLevel.id);
    }
  }, [activeJourneyTrack, selectedJourneyLevelId]);

  useEffect(() => {
    if (!activeJourneyLevel?.topics?.length) {
      setSelectedJourneyTopicId(null);
      setJourneyDetailTopicId(null);
      return;
    }

    const nextTopic =
      activeJourneyLevel.topics.find((topic) => topic.slug === selectedJourneyTopicId && topic.unlocked) ??
      activeJourneyLevel.topics.find((topic) => topic.unlocked) ??
      activeJourneyLevel.topics[0];
    if (nextTopic && nextTopic.slug !== selectedJourneyTopicId) {
      setSelectedJourneyTopicId(nextTopic.slug);
    }
  }, [activeJourneyLevel, selectedJourneyTopicId]);

  useEffect(() => {
    if (!pendingReminderNavigation) return;

    const { target } = pendingReminderNavigation;

    if (target.kind === "resumeStory") {
      const resolved = resolveStorySelectionBySlugs(target.bookSlug, target.storySlug);
      if (resolved) {
        openSelection(resolved);
      } else {
        setActiveScreen("home");
      }
      void trackReminderMetric("reminder_destination_opened", {
        targetKind: target.kind,
        bookSlug: target.bookSlug,
        storySlug: target.storySlug,
      });
      onHandledReminderNavigation?.();
      return;
    }

    if (target.kind === "practiceDue") {
      setActiveScreen("practice");
      void openPracticeMode(recommendedPracticeMode, true, undefined, "due");
      void trackReminderMetric("reminder_destination_opened", {
        targetKind: target.kind,
        mode: recommendedPracticeMode,
      });
      onHandledReminderNavigation?.();
      return;
    }

    if (target.kind === "journey") {
      setActiveScreen("journey");
      void trackReminderMetric("reminder_destination_opened", {
        targetKind: target.kind,
      });
      onHandledReminderNavigation?.();
    }
  }, [onHandledReminderNavigation, openSelection, pendingReminderNavigation, recommendedPracticeMode]);

  useEffect(() => {
    let cancelled = false;

    async function refreshReminderSchedule() {
      if (!preferences.remindersEnabled || preferences.reminderHour === null) {
        if (!cancelled) setReminderHint(null);
        return;
      }

      const reminderState = await syncDailyReminderSchedule({
        enabled: preferences.remindersEnabled,
        hour: preferences.reminderHour,
        learningGoal: preferences.learningGoal,
        dailyMinutes: preferences.dailyMinutes,
        context:
          continueReading.length > 0
            ? {
                continueStoryTitle: continueReading[0]?.story.title,
                continueBookTitle: continueReading[0]?.book.title,
                continueBookSlug: continueReading[0]?.book.slug,
                continueStorySlug: continueReading[0]?.story.slug,
              }
            : dueFavoritesCount > 0
              ? { dueReviewCount: dueFavoritesCount }
              : activeJourneyPrimaryAction
                ? {
                    journeyActionTitle: activeJourneyPrimaryAction.title,
                    journeyActionBody: activeJourneyPrimaryAction.body,
                  }
                : null,
        activeToday: hasDailyLoopActivityToday,
        requestPermissions: false,
      });

      if (!cancelled) {
        setReminderHint(reminderState.message);
      }
    }

    void refreshReminderSchedule();

    return () => {
      cancelled = true;
    };
  }, [
    activeJourneyPrimaryAction,
    continueReading,
    dueFavoritesCount,
    preferences.dailyMinutes,
    preferences.learningGoal,
    preferences.reminderHour,
    preferences.remindersEnabled,
  ]);

  const personalizedJourneyPlan = useMemo(() => {
    const parts: string[] = [];
    if (preferences.journeyFocus && preferences.journeyFocus !== "General") parts.push(preferences.journeyFocus);
    else if (preferences.learningGoal) parts.push(`${preferences.learningGoal} focus`);
    if (preferences.preferredLevel) parts.push(`${formatLevel(preferences.preferredLevel)} track`);
    if (preferences.dailyMinutes) parts.push(`${preferences.dailyMinutes} min/day`);
    return parts.join(" · ");
  }, [preferences.dailyMinutes, preferences.journeyFocus, preferences.learningGoal, preferences.preferredLevel]);
  const suggestedJourneyPlacementLevel = useMemo(() => {
    const levels = activeJourneyTrack?.levels ?? [];
    const candidateOrder =
      preferences.preferredLevel === "Advanced"
        ? ["b2", "b1", "a2"]
        : preferences.preferredLevel === "Intermediate"
          ? ["b1", "a2", "a1"]
          : ["a1"];
    return candidateOrder.find((candidate) => levels.some((level) => level.id === candidate)) ?? levels[0]?.id ?? null;
  }, [activeJourneyTrack, preferences.preferredLevel]);
  const activeJourneyInsights = useMemo(() => {
    if (activeJourneyTrack?.insights) return activeJourneyTrack.insights;
    if (!activeJourneyTrack) return null;

    return buildJourneyTrackInsights(
      {
        id: activeJourneyTrack.id,
        levels: activeJourneyTrack.levels.map((level) => ({
          id: level.id,
          title: level.title,
          subtitle: level.subtitle,
          topics: level.topics.map((topic) => ({
            id: topic.id,
            slug: topic.slug,
            label: topic.label,
            storyCount: topic.storyCount,
            storyTarget: topic.storyTarget ?? undefined,
            stories: topic.stories.map((story) => ({
              id: story.id,
              progressKey: story.progressKey,
              storySlug: story.storySlug,
              sourcePath: story.storySlug ? `/stories/${story.storySlug}` : "",
              title: story.title,
              href: story.storySlug ? `/stories/${story.storySlug}` : "",
              coverUrl: story.coverUrl ?? undefined,
              language: story.language ?? undefined,
              region: story.region ?? undefined,
              levelLabel: level.title,
              topicLabel: topic.label,
            })),
          })),
        })),
      },
      new Set(
        activeJourneyTrack.levels.flatMap((level) =>
          level.topics.flatMap((topic) =>
            topic.stories.filter((story) => story.completed).map((story) => story.progressKey)
          )
        )
      ),
      new Set(
        activeJourneyTrack.levels.flatMap((level) =>
          level.topics.filter((topic) => topic.practiced).map((topic) => `${activeJourneyTrack.id}:${level.id}:${topic.slug}`)
        )
      ),
      new Set(
        activeJourneyTrack.levels.flatMap((level) =>
          level.topics.filter((topic) => topic.checkpointPassed).map((topic) => `${activeJourneyTrack.id}:${level.id}:${topic.slug}`)
        )
      ),
      activeJourneyTrack.levels.flatMap((level) =>
        level.topics.flatMap((topic) =>
          topic.stories
            .slice(0, topic.dueReviewCount)
            .map((story) => ({ progressKey: story.progressKey }))
        )
      )
    );
  }, [activeJourneyTrack]);
  async function saveJourneyPlacementOnMobile(levelId: string | null) {
    const saved = await saveOnboardingPreferences({ journeyPlacementLevel: levelId });
    if (!saved || !sessionToken) return;

    try {
      const payload = await apiFetch<MobileJourneyPayload>({
        baseUrl: mobileConfig.apiBaseUrl,
        path: "/api/mobile/journey",
        token: sessionToken,
      });
      setRemoteJourney(payload);
    } catch (error) {
      console.error("[mobile journey] failed to refresh after placement update", error);
    }
  }

  const showJourneyHub = !activeJourneyLanguage && preferences.targetLanguages.length !== 1;

  const journeyView = (
    <>
      <View style={[styles.hero, styles.journeyHero]}>
        <View style={styles.heroHeaderRow}>
          <View style={[styles.heroTextBlock, styles.journeyHeroTextBlock]}>
            {showJourneyHub ? (
              <>
                <Text style={styles.sectionEyebrow}>Journey</Text>
                <Text style={styles.journeyHeroTitle}>My Languages</Text>
              </>
            ) : journeyDetailTopicId && activeJourneyTopic ? (
              <>
                <Text style={styles.sectionEyebrow}>{activeJourneyLevel?.title ?? "Journey"}</Text>
                <Text style={styles.journeyHeroTitle}>{activeJourneyTopic.label}</Text>
                <Text style={styles.journeyHeroSubtitle}>Read the stories, practice, then clear the checkpoint.</Text>
              </>
            ) : (
              <>
                {activeJourneyLanguage && preferences.targetLanguages.length !== 1 ? (
                  <Text style={styles.sectionEyebrow}>Journey</Text>
                ) : null}
                <Text style={styles.journeyHeroTitle}>
                  {activeJourneyLanguage && preferences.targetLanguages.length > 1
                    ? `Journey · ${activeJourneyLanguage}`
                    : "Journey"}
                </Text>
              </>
            )}
          </View>
          <MenuTrigger onPress={() => setMenuOpen(true)} />
        </View>
      </View>

      {showJourneyHub ? (
        <View style={styles.section}>
          <JourneyLanguageHub
            languages={preferences.targetLanguages}
            insightsByLanguage={journeyInsightsByLanguage}
            onSelectLanguage={(lang) => void loadJourneyForLanguage(lang)}
            onOpenSettings={() => setActiveScreen("settings")}
          />
        </View>
      ) : null}

      {!showJourneyHub && !journeyDetailTopicId && activeJourneyLanguage && preferences.targetLanguages.length !== 1 ? (
        <View style={styles.section}>
          <Pressable
            onPress={() => {
              setActiveJourneyLanguage(null);
              setJourneyVariantPickerOpen(false);
              setJourneyDetailTopicId(null);
              setSelectedJourneyLevelId(null);
              setSelectedJourneyTopicId(null);
              setSelectedJourneyTrackId(null);
            }}
            accessibilityRole="button"
            accessibilityLabel="qa-journey-back-to-languages"
            testID="qa-journey-back-to-languages"
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>All languages</Text>
          </Pressable>
        </View>
      ) : null}

      {!showJourneyHub && journeyVariantPickerOpen && remoteJourney && remoteJourney.tracks.length >= 2 ? (
        <View style={styles.section}>
          <Text style={styles.journeyVariantPickerLabel}>Choose a variant</Text>
          <View style={styles.journeyVariantPickerGrid}>
            {remoteJourney.tracks.map((track) => {
              const isActive = selectedJourneyTrackId === track.id;
              return (
                <Pressable
                  key={track.id}
                  onPress={() => {
                    setSelectedJourneyTrackId(track.id);
                    setJourneyVariantPickerOpen(false);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`qa-journey-variant-${track.id}`}
                  testID={`qa-journey-variant-${track.id}`}
                  style={[styles.journeyVariantCard, isActive ? styles.journeyVariantCardActive : null]}
                >
                  <Text style={[styles.journeyVariantLabel, isActive ? styles.journeyVariantLabelActive : null]}>
                    {track.label}
                  </Text>
                  <Text style={styles.journeyVariantMeta}>
                    {track.insights.score}% · {track.insights.completedSteps}/{track.insights.totalSteps} steps
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {!showJourneyHub && !journeyVariantPickerOpen && !journeyDetailTopicId && activeJourneyInsights ? (
        <View style={styles.section}>
          <View style={styles.journeyInsightsBar}>
            <View style={styles.journeyInsightsBarPill}>
              <Text style={styles.journeyInsightsBarValue}>{activeJourneyInsights.score}%</Text>
            </View>
            <View style={styles.journeyInsightsBarPill}>
              <Text style={styles.journeyInsightsBarText}>
                {activeJourneyInsights.completedSteps}/{activeJourneyInsights.totalSteps} steps
              </Text>
            </View>
            {activeJourneyInsights.dueReviewCount > 0 ? (
              <Pressable
                onPress={() => {
                  const firstReviewTopic = activeJourneyInsights.reviewTopics[0];
                  if (!firstReviewTopic) return;
                  setSelectedJourneyLevelId(firstReviewTopic.levelId);
                  setSelectedJourneyTopicId(firstReviewTopic.topicSlug);
                  setJourneyDetailTopicId(firstReviewTopic.topicSlug);
                }}
                style={styles.journeyInsightsBarReview}
              >
                <Text style={styles.journeyInsightsBarReviewText}>
                  {activeJourneyInsights.dueReviewCount} due
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      {!showJourneyHub && !journeyVariantPickerOpen && !journeyDetailTopicId && !loadingRemote && !journeyLanguageLoading && !activeJourneyTrack ? (
        <View style={styles.section}>
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              {activeJourneyLanguage ? `No ${activeJourneyLanguage} content yet` : "Journey is not available right now"}
            </Text>
            <Text style={styles.metaLine}>
              {activeJourneyLanguage
                ? "Content for this language is coming soon."
                : remoteError?.trim()
                  ? remoteError
                  : "Make sure the local web server is running, then reopen Journey."}
            </Text>
          </View>
        </View>
      ) : null}

      {!showJourneyHub && !journeyVariantPickerOpen ? (
      <View style={styles.section}>
        {!journeyDetailTopicId && activeJourneyTrack ? (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="normal" contentContainerStyle={styles.filterChips}>
              {activeJourneyTrack.levels.map((level) => {
                const active = activeJourneyLevel?.id === level.id;
                return (
                  <Pressable
                    key={level.id}
                    disabled={!level.unlocked}
                    onPress={() => setSelectedJourneyLevelId(level.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`qa-journey-level-${level.id}`}
                    testID={`qa-journey-level-${level.id}`}
                    style={[
                      styles.filterChip,
                      active ? styles.filterChipActive : null,
                      !level.unlocked ? styles.journeyTopicActionDisabled : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        active ? styles.filterChipTextActive : null,
                        !level.unlocked ? styles.journeyTopicActionTextDisabled : null,
                      ]}
                    >
                      {level.title}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {activeJourneyLevel ? (
              <View
                style={styles.journeyMapSection}
                accessibilityLabel="qa-journey-map-section"
                testID="qa-journey-map-section"
              >
                <View style={styles.journeyLevelHeader}>
                  <View style={styles.journeyLevelText}>
                    <Text style={styles.journeyLevelTitle}>{activeJourneyLevel.title}</Text>
                    <Text style={styles.journeyLevelMeta}>
                      {activeJourneyLevel.subtitle} · {activeJourneyLevel.unlockedTopicCount}/{activeJourneyLevel.totalTopicCount} topics open
                    </Text>
                  </View>
                </View>

                <View style={styles.journeyMapList}>
                  {activeJourneyLevel.topics.map((topic, index) => {
                    const active = selectedJourneyTopicId === topic.slug;
                    const hasStories = topic.storyCount > 0;
                    const previousTopic = index > 0 ? activeJourneyLevel.topics[index - 1] : null;
                    const previousTopicRemaining = previousTopic
                      ? Math.max(previousTopic.requiredStoryCount - previousTopic.completedStoryCount, 0)
                      : 0;
                    const previousTopicCheckpointPassed = previousTopic ? previousTopic.checkpointPassed : true;
                    const badge = topic.checkpointPassed
                      ? "Completed"
                      : topic.complete
                        ? "Checkpoint"
                        : index === 0
                          ? "Start"
                          : topic.unlocked
                            ? "Open"
                            : hasStories
                              ? "Locked"
                              : "Coming soon";
                    const lockedMeta = !hasStories
                      ? "No stories yet"
                      : previousTopic && !previousTopic.complete
                        ? `Finish ${previousTopicRemaining} more ${previousTopicRemaining === 1 ? "story" : "stories"} in ${previousTopic.label}`
                        : previousTopic && !previousTopicCheckpointPassed
                          ? `Pass the ${previousTopic.label} checkpoint`
                          : "Unlock later";
                    const alignRight = index % 2 === 1;

                    return (
                      <View key={topic.id} style={styles.journeyMapSequence}>
                        <View
                          style={[
                            styles.journeyMapNodeWrap,
                            alignRight ? styles.journeyMapNodeWrapRight : styles.journeyMapNodeWrapLeft,
                          ]}
                        >
                          <Pressable
                            disabled={!topic.unlocked}
                            onPress={() => {
                              setSelectedJourneyTopicId(topic.slug);
                              setJourneyDetailTopicId(topic.slug);
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={`qa-journey-topic-${topic.slug}`}
                            testID={`qa-journey-topic-${topic.slug}`}
                            style={[
                              styles.journeyMapNode,
                              !topic.unlocked ? styles.journeyMapNodeLocked : null,
                              active ? styles.journeyMapNodeActive : null,
                            ]}
                          >
                            <Text style={styles.journeyMapBadge}>{badge}</Text>
                            <View style={styles.journeyMapArt}>
                              {topic.stories[0]?.coverUrl ? (
                                <ProgressiveImage
                                  uri={getCoverUrl(topic.stories[0].coverUrl)}
                                  style={styles.journeyMapArtImage}
                                />
                              ) : (
                                <View style={styles.journeyMapArtFallback}>
                                  <MaterialCommunityIcons name="map-marker-path" size={22} color="#9fb5d0" />
                                </View>
                              )}
                            </View>
                            <Text
                              style={[
                                styles.journeyMapTitle,
                                !topic.unlocked ? styles.journeyTopicActionTextDisabled : null,
                              ]}
                            >
                              {topic.label}
                            </Text>
                            <Text style={styles.journeyMapMeta}>
                              {topic.unlocked
                                ? topic.storyCount > 0
                                  ? `${topic.completedStoryCount}/${topic.requiredStoryCount} stories`
                                  : "No stories yet"
                                : lockedMeta}
                            </Text>
                          </Pressable>
                        </View>

                        {index < activeJourneyLevel.topics.length - 1 ? (
                          <View
                            pointerEvents="none"
                            style={[
                              styles.journeyMapConnectorRow,
                              alignRight ? styles.journeyMapConnectorRowLeft : styles.journeyMapConnectorRowRight,
                            ]}
                          >
                            <View
                              style={[
                                styles.journeyMapConnectorCurve,
                                alignRight
                                  ? styles.journeyMapConnectorCurveRight
                                  : styles.journeyMapConnectorCurveLeft,
                              ]}
                            />
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : null}

          </>
        ) : null}

        {journeyDetailTopicId && activeJourneyTopic && activeJourneyLevel ? (
          <>
            <Pressable
              onPress={() => setJourneyDetailTopicId(null)}
              accessibilityRole="button"
              accessibilityLabel="qa-journey-back-to-map"
              testID="qa-journey-back-to-map"
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>Back to map</Text>
            </Pressable>

            <View style={styles.journeyTopicDetailCard} accessibilityLabel="qa-journey-topic-detail" testID="qa-journey-topic-detail">
              <View style={styles.sectionHeader}>
                <View style={styles.journeyLevelText}>
                  <Text style={styles.sectionEyebrow}>{activeJourneyLevel.title} topic</Text>
                  <Text style={styles.sectionTitle}>{activeJourneyTopic.label}</Text>
                </View>
                <Text style={styles.journeyTopicProgressText}>
                  {activeJourneyTopic.completedStoryCount}/{activeJourneyTopic.requiredStoryCount}
                </Text>
              </View>

              <View style={styles.featureMetaPills}>
                <Text style={styles.featureMetaPill}>
                  {activeJourneyTopic.complete ? "Stories complete" : `${Math.max(activeJourneyTopic.requiredStoryCount - activeJourneyTopic.completedStoryCount, 0)} to go`}
                </Text>
                <Text style={styles.featureMetaPill}>
                  {activeJourneyTopic.practiced ? "Practiced" : "Practice pending"}
                </Text>
                <Text style={styles.featureMetaPill}>
                  {activeJourneyTopic.checkpointPassed ? "Checkpoint cleared" : "Checkpoint pending"}
                </Text>
                {activeJourneyTopic.hasDueReview ? <Text style={styles.featureMetaPill}>Review due</Text> : null}
              </View>

              {activeJourneyPrimaryAction ? (
                <View style={styles.journeyPrimaryActionCard}>
                  <View style={styles.journeyPrimaryActionCopy}>
                    <Text style={styles.journeyPrimaryActionEyebrow}>Next action</Text>
                    <Text style={styles.journeyPrimaryActionTitle}>{activeJourneyPrimaryAction.title}</Text>
                    <Text style={styles.journeyPrimaryActionBody}>{activeJourneyPrimaryAction.body}</Text>
                  </View>
                  <Pressable
                    onPress={activeJourneyPrimaryAction.onPress}
                    accessibilityRole="button"
                    accessibilityLabel="qa-journey-primary-action"
                    testID="qa-journey-primary-action"
                    style={[styles.journeyTopicAction, styles.journeyTopicActionPrimary]}
                  >
                    <Text style={[styles.journeyTopicActionText, styles.journeyTopicActionTextPrimary]}>
                      {activeJourneyPrimaryAction.cta}
                    </Text>
                  </Pressable>
                </View>
              ) : null}

              <View style={styles.journeyStoryList}>
                {activeJourneyTopic.stories.map((story, index) => {
                  const previousStory = index > 0 ? activeJourneyTopic.stories[index - 1] : null;
                  const badge = !story.unlocked
                    ? "Locked"
                    : story.completed
                      ? "Read"
                      : index === 0
                        ? "Start"
                        : index === activeJourneyTopic.unlockedStoryCount - 1
                          ? "Continue"
                          : "Open";
                  const isOfflineReady = offlineStoriesById.has(story.id) ||
                    Boolean(offlineSnapshot?.stories.find((s) => s.storySlug === story.storySlug));
                  const isDownloading = offlineStoryIdInFlight === story.id;
                  return (
                    <View
                      key={story.id}
                      style={[
                        styles.journeyStoryRow,
                        !story.unlocked ? styles.journeyTopicActionDisabled : null,
                      ]}
                    >
                      <Pressable
                        disabled={!story.unlocked}
                        onPress={() => openJourneyStory(story)}
                        accessibilityRole="button"
                        accessibilityLabel={index === 0 ? "qa-journey-story-row-0" : `qa-journey-story-row-${story.id}`}
                        testID={index === 0 ? "qa-journey-story-row-0" : `qa-journey-story-row-${story.id}`}
                        style={styles.journeyStoryRowContent}
                      >
                        <ProgressiveImage uri={getCoverUrl(story.coverUrl)} style={styles.journeyStoryCover} />
                        <View style={styles.journeyStoryCopy}>
                          <Text style={styles.journeyStoryBadge}>{badge}</Text>
                          <Text style={styles.journeyStoryTitle}>{story.title}</Text>
                          <Text style={styles.journeyStoryMeta}>
                            {story.unlocked
                              ? formatRegion(story.region ?? "") || story.language || "Global"
                              : previousStory && !previousStory.completed
                                ? `Finish ${previousStory.title} first`
                                : "Unlock later"}
                          </Text>
                        </View>
                      </Pressable>
                      {story.unlocked ? (
                        <Pressable
                          onPress={() => isOfflineReady
                            ? void removeStoryFromOffline({ id: story.id })
                            : void downloadJourneyStoryOffline(story)
                          }
                          disabled={isDownloading}
                          style={styles.journeyStoryDownloadBtn}
                          accessibilityLabel={isOfflineReady ? "Remove offline" : "Download for offline"}
                        >
                          <Feather
                            name={isDownloading ? "loader" : isOfflineReady ? "check-circle" : "download-cloud"}
                            size={17}
                            color={isOfflineReady ? "#6ab8ff" : "#5a7da0"}
                          />
                        </Pressable>
                      ) : null}
                    </View>
                  );
                })}
              </View>

              <View style={styles.journeyTopicRowActions}>
                {activeJourneyTopic.hasDueReview ? (
                  <Pressable
                    onPress={() => {
                      void openJourneyPractice({
                        variantId: activeJourneyTrack?.id ?? null,
                        levelId: activeJourneyLevel.id,
                        topicId: activeJourneyTopic.slug,
                        topicLabel: activeJourneyTopic.label,
                        review: true,
                      });
                    }}
                    style={[styles.journeyTopicAction, styles.journeyTopicActionPrimary]}
                  >
                    <Text style={[styles.journeyTopicActionText, styles.journeyTopicActionTextPrimary]}>{activeJourneyTopic.dueReviewCount} due review</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() =>
                    openJourneyTopicInExplore({
                      topicLabel: activeJourneyTopic.label,
                      trackId: activeJourneyTrack?.id ?? null,
                    })
                  }
                  style={styles.journeyTopicAction}
                >
                  <Text style={styles.journeyTopicActionText}>Browse</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    void openJourneyPractice({
                      variantId: activeJourneyTrack?.id ?? null,
                      levelId: activeJourneyLevel.id,
                      topicId: activeJourneyTopic.slug,
                      topicLabel: activeJourneyTopic.label,
                    });
                  }}
                  disabled={!activeJourneyTopic.complete}
                  style={[
                    styles.journeyTopicAction,
                    !activeJourneyTopic.complete ? styles.journeyTopicActionDisabled : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.journeyTopicActionText,
                      !activeJourneyTopic.complete ? styles.journeyTopicActionTextDisabled : null,
                    ]}
                  >
                    {activeJourneyTopic.practiced ? "Practice again" : "Practice"}
                  </Text>
                </Pressable>
                {!activeJourneyTopic.checkpointPassed ? (
                  <Pressable
                    onPress={() => {
                      void openJourneyPractice({
                        variantId: activeJourneyTrack?.id ?? null,
                        levelId: activeJourneyLevel.id,
                        topicId: activeJourneyTopic.slug,
                        topicLabel: activeJourneyTopic.label,
                        kind: "checkpoint",
                      });
                    }}
                    disabled={!activeJourneyTopic.complete || !activeJourneyTopic.practiced}
                    style={[
                      styles.journeyTopicAction,
                      (!activeJourneyTopic.complete || !activeJourneyTopic.practiced)
                        ? styles.journeyTopicActionDisabled
                        : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.journeyTopicActionText,
                        (!activeJourneyTopic.complete || !activeJourneyTopic.practiced)
                          ? styles.journeyTopicActionTextDisabled
                          : null,
                      ]}
                    >
                      Checkpoint
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          </>
        ) : null}
      </View>
      ) : null}
    </>
  );

  const progressView = (
    <>
      <View style={styles.hero}>
        <View style={styles.heroHeaderRow}>
          <View style={styles.heroTextBlock}>
            <Text style={styles.eyebrow}>Progress</Text>
            <Text style={styles.title}>Reading activity</Text>
            <Text style={styles.subtitle}>Reading, listening and review at a glance.</Text>
          </View>
          <MenuTrigger onPress={() => setMenuOpen(true)} />
        </View>
      </View>

      <View style={styles.progressHeroCard}>
        <View style={styles.progressHeroMain}>
          <View style={styles.practiceFocusPill}>
            <Feather name="activity" size={13} color="#f8d48a" />
            <Text style={styles.practiceFocusPillText}>
              {(remoteProgress?.storyStreakDays ?? maxFavoriteStreak) >= 7 ? "On a roll" : "Keep going"}
            </Text>
          </View>
          <Text style={styles.progressHeroValue}>{Math.max(remoteProgress?.storyStreakDays ?? maxFavoriteStreak, 1)}</Text>
          <Text style={styles.progressHeroLabel}>
            {formatStreakLabel(Math.max(remoteProgress?.storyStreakDays ?? maxFavoriteStreak, 1))}
          </Text>
          <Text style={styles.progressHeroText}>
            {(remoteProgress?.storiesFinished ?? continueReading.length) > 0
              ? "You already have stories in motion."
              : "One saved story is enough to build momentum."}
          </Text>
        </View>
        <View style={styles.progressGoalCard}>
          <View style={styles.progressGoalHeader}>
            <Text style={styles.progressGoalTitle}>Weekly goal</Text>
            <Text style={styles.progressGoalMeta}>{weeklyStoriesFinished} / {weeklyGoalStories}</Text>
          </View>
          <View style={styles.progressGoalTrack}>
            <View
              style={[
                styles.progressGoalFill,
                {
                  width: `${weeklyStoriesPercent}%`,
                },
              ]}
            />
          </View>
          <Text style={styles.progressGoalMeta}>
            {weeklyStoriesFinished} story{weeklyStoriesFinished === 1 ? "" : "ies"} finished this week
          </Text>
          <Text style={styles.progressGoalSubmeta}>
            {(remoteProgress?.weeklyMinutesListened ?? continueReading.length)} {remoteProgress ? "min listened" : "in progress"} · {offlineSnapshot?.stories.length ?? 0} offline
          </Text>
        </View>

        <View style={styles.progressMiniGrid}>
          <View style={styles.progressMiniCard}>
            <Text style={styles.progressMiniEyebrow}>This month</Text>
            <Text style={styles.progressMiniValue}>{remoteProgress?.monthlyStoriesFinished ?? effectiveRemoteStoriesCount}</Text>
            <Text style={styles.progressMiniText}>
              {remoteProgress ? "stories finished" : "stories in your library"}
            </Text>
          </View>
          <View style={styles.progressMiniCard}>
            <Text style={styles.progressMiniEyebrow}>Regions</Text>
            <Text style={styles.progressMiniValue}>{regionsExplored}</Text>
            <Text style={styles.progressMiniText}>regions explored</Text>
          </View>
        </View>
      </View>

      <View style={styles.progressStatsGrid}>
        {progressStats.map((item) => (
          <View key={item.label} style={styles.progressStatCard}>
            <View style={styles.progressStatLabelRow}>
              <Feather name={item.icon} size={14} color="#9cb0c9" />
              <Text style={styles.progressStatLabel}>{item.label}</Text>
            </View>
            <Text style={styles.progressStatValue}>{item.value}</Text>
          </View>
        ))}
      </View>

      {remoteProgressLoading ? <Text style={styles.helperText}>Refreshing progress…</Text> : null}

      {remoteProgress?.gamification ? (
        <View style={styles.section}>
          <View style={styles.gamificationQuestCard}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionEyebrow}>Daily quests</Text>
                <Text style={styles.sectionTitle}>Keep the streak alive</Text>
              </View>
              <Text style={styles.helperText}>
                {remoteProgress.gamification.quests.filter((quest) => quest.complete).length}/
                {remoteProgress.gamification.quests.length}
              </Text>
            </View>
            <View style={styles.gamificationQuestList}>
              {remoteProgress.gamification.quests.map((quest) => (
                <View key={quest.id} style={styles.gamificationQuestItem}>
                  <View style={styles.gamificationQuestTopRow}>
                    <View style={styles.gamificationQuestLabelRow}>
                      <Feather
                        name={quest.complete ? "check-circle" : "circle"}
                        size={16}
                        color={quest.complete ? "#8ef0c6" : "#6f88a8"}
                      />
                      <Text style={styles.gamificationQuestLabel}>{quest.label}</Text>
                    </View>
                    <Text style={styles.gamificationQuestXp}>+{quest.rewardXp} XP</Text>
                  </View>
                  <Text style={styles.gamificationQuestMeta}>
                    {Math.min(quest.current, quest.target)}/{quest.target} {quest.complete ? "Done" : "In progress"}
                  </Text>
                </View>
              ))}
            </View>
            <View style={styles.gamificationBadgeSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionEyebrow}>Unlocked badges</Text>
                <Text style={styles.helperText}>
                  {remoteProgress.gamification.badges.filter((badge) => badge.unlocked).length}/
                  {remoteProgress.gamification.badges.length}
                </Text>
              </View>
              <View style={styles.gamificationBadgeWrap}>
                {remoteProgress.gamification.badges.map((badge) => (
                  <View
                    key={badge.id}
                    style={[
                      styles.gamificationBadgeChip,
                      badge.unlocked ? styles.gamificationBadgeChipUnlocked : styles.gamificationBadgeChipLocked,
                    ]}
                  >
                    <Text
                      style={[
                        styles.gamificationBadgeChipText,
                        badge.unlocked ? styles.gamificationBadgeChipTextUnlocked : styles.gamificationBadgeChipTextLocked,
                      ]}
                    >
                      {badge.label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>
      ) : null}

      {continueReadingCards.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionEyebrow}>Recent</Text>
              <Text style={styles.sectionTitle}>Stories in motion</Text>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="normal" contentContainerStyle={styles.carousel}>
            {continueReadingCards.map((item) => (
              <BookHomeCard
                key={item.key}
                item={{
                  key: item.key,
                  title: item.title,
                  coverUrl: item.coverUrl,
                  subtitle: item.subtitle,
                  meta: item.meta,
                  progressLabel: item.progressLabel,
                  onPress: item.onPress ?? (() => {}),
                }}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}
    </>
  );

  const onboardingSurveySteps = [
    {
      title: "What are you learning?",
      body: "We will use this to tailor stories, books, Journey and Create.",
      options: ["Spanish", "French", "German", "Italian", "Portuguese", "Japanese"],
      selected: preferences.targetLanguages[0] ?? "",
      select: (value: string) =>
        setPreferences((current) => ({
          ...current,
          targetLanguages: [value],
          preferredVariant: null,
          preferredRegion: null,
        })),
      format: (value: string) => value,
    },
    {
      title: "What is your level?",
      body: "This keeps recommendations and Journey at the right difficulty.",
      options: [...ONBOARDING_LEVEL_OPTIONS],
      selected: preferences.preferredLevel ?? "",
      select: (value: string) => setPreferences((current) => ({ ...current, preferredLevel: value })),
      format: (value: string) => value,
    },
    {
      title: "Which variant fits you best?",
      body: "This helps Journey, audio and recommendations sound more like the variety you want.",
      options: settingsAvailableVariants.map((variant) => variant.value),
      selected: preferences.preferredVariant ?? "",
      select: (value: string) => setPreferences((current) => ({ ...current, preferredVariant: value })),
      format: (value: string) => formatVariantLabel(value) ?? value,
      empty: "No variant choices for this language, so we will skip it.",
    },
    {
      title: "Which region do you want to explore most?",
      body: "We use this to bias stories, books and examples toward the places you care about.",
      options: [...settingsAvailableRegions],
      selected: preferences.preferredRegion ?? "",
      select: (value: string) => setPreferences((current) => ({ ...current, preferredRegion: value })),
      format: (value: string) => formatRegion(value),
      empty: "No region picker for this language yet, so we will skip it.",
    },
    {
      title: "What do you want more of?",
      body: "Pick a few interests so the app can personalize stories and recommendations.",
      options: [...ONBOARDING_INTEREST_OPTIONS],
      selected: "",
      select: (value: string) =>
        setPreferences((current) => {
          const exists = current.interests.some((item) => item.toLowerCase() === value.toLowerCase());
          const nextInterests = exists
            ? current.interests.filter((item) => item.toLowerCase() !== value.toLowerCase())
            : current.interests.length >= 5
              ? [...current.interests.slice(1), value]
              : [...current.interests, value];
          return { ...current, interests: nextInterests };
        }),
      format: (value: string) => value,
      multi: true,
      isActive: (value: string) => preferences.interests.some((item) => item.toLowerCase() === value.toLowerCase()),
    },
    {
      title: "Which Journey focus fits you best?",
      body: "This keeps your Journey grounded in the kind of stories you care about most.",
      options: [...JOURNEY_FOCUS_OPTIONS],
      selected: preferences.journeyFocus ?? "",
      select: (value: string) =>
        setPreferences((current) => ({
          ...current,
          journeyFocus: normalizeJourneyFocusPreference(value),
          learningGoal: getLearningGoalFromJourneyFocus(normalizeJourneyFocusPreference(value)),
        })),
      format: (value: string) => value,
    },
    {
      title: "How much time can you give per day?",
      body: "This helps us shape goals and nudges around your real schedule.",
      options: ONBOARDING_DAILY_MINUTES_OPTIONS.map(String),
      selected: preferences.dailyMinutes ? String(preferences.dailyMinutes) : "",
      select: (value: string) =>
        setPreferences((current) => ({ ...current, dailyMinutes: normalizeDailyMinutes(Number(value)) })),
      format: (value: string) => `${value} min`,
    },
  ] as const;

  async function completeOnboardingSurvey() {
    const success = await saveOnboardingPreferences({
      targetLanguages: preferences.targetLanguages,
      interests: preferences.interests,
      preferredLevel: preferences.preferredLevel,
      preferredRegion: preferences.preferredRegion,
      preferredVariant: preferences.preferredVariant,
      learningGoal: preferences.learningGoal,
      journeyFocus: preferences.journeyFocus ?? getJourneyFocusFromLearningGoal(preferences.learningGoal),
      dailyMinutes: preferences.dailyMinutes,
      onboardingSurveyCompletedAt: new Date().toISOString(),
    });
    if (!success) return;
    setOnboardingSurveyStep(0);
    setOnboardingTourStep(0);
  }

  async function completeOnboardingTour() {
    const success = await saveOnboardingPreferences({
      onboardingTourCompletedAt: new Date().toISOString(),
    });
    if (!success) return;
    setOnboardingTourStep(null);
  }

  if (selection) {
    const offlineStory = offlineStoriesById.get(selection.story.id);
    const currentStoryIndex = selection.book.stories.findIndex((story) => story.id === selection.story.id);
    const previousStory = currentStoryIndex > 0 ? selection.book.stories[currentStoryIndex - 1] : null;
    const nextStory =
      currentStoryIndex >= 0 && currentStoryIndex < selection.book.stories.length - 1
        ? selection.book.stories[currentStoryIndex + 1]
        : null;
    return (
      <View style={styles.readerWrapper}>
        <ReaderScreen
          book={selection.book}
          story={selection.story}
          resolvedAudioUrl={offlineStory?.localAudioUri ?? selection.resolvedAudioUrl ?? selection.story.audio}
          sessionToken={sessionToken}
          onBack={() => setSelection(null)}
          canGoPrevious={Boolean(previousStory)}
          canGoNext={Boolean(nextStory)}
          onPreviousStory={
            previousStory
              ? () => {
                  const resolved = resolveStorySelection(previousStory.id, selection.book, previousStory);
                  if (resolved) openSelection(resolved);
                }
              : undefined
          }
          onNextStory={
            nextStory
              ? () => {
                  const resolved = resolveStorySelection(nextStory.id, selection.book, nextStory);
                  if (resolved) openSelection(resolved);
                }
              : undefined
          }
          isSaved={savedStoryIds.includes(selection.story.id)}
          isSaving={false}
          onToggleSaved={() => void toggleStorySaved(selection.book, selection.story)}
          initialProgress={
            readingProgress.find((entry) => entry.storyId === selection.story.id) ?? null
          }
          onTrackProgress={(details) => recordProgress(selection.book, selection.story, details)}
          isAvailableOffline={Boolean(offlineStory)}
          isDownloadingOffline={offlineStoryIdInFlight === selection.story.id}
          onDownloadOffline={() => void downloadStoryOffline(selection.book, selection.story)}
          onRemoveOffline={() => void removeStoryFromOffline(selection.story)}
          onOpenPractice={() => void openStoryPractice(selection)}
          isFavoriteWord={isFavoriteWord}
          onToggleFavoriteWord={(item, contextSentence) => void toggleFavoriteWord(item, contextSentence)}
        />
        {storyCompletionPopup ? (
          <View style={styles.storyCompletionOverlay}>
            <View style={styles.storyCompletionCard}>
              <Text style={styles.storyCompletionTitle}>Story complete</Text>
              <Text style={styles.storyCompletionBody}>Head back to your journey to see what to read next.</Text>
              <Pressable
                onPress={() => {
                  setStoryCompletionPopup(false);
                  setSelection(null);
                  setActiveScreen("journey");
                }}
                style={[styles.inlineButton, styles.primaryButton]}
              >
                <Text style={[styles.inlineButtonText, styles.primaryButtonText]}>Back to Journey</Text>
              </Pressable>
              <Pressable
                onPress={() => setStoryCompletionPopup(false)}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>Keep reading</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    );
  }

  if (selectedBook) {
    const isBookSaved = savedBookIds.includes(selectedBook.id);
    const selectedBookDescription =
      selectedBook.description?.trim() ||
      selectedBook.subtitle?.trim() ||
      "A rich collection of stories for daily reading and listening practice.";
    const selectedBookNeedsDescriptionToggle = selectedBookDescription.length > 180;
    const averageMinutes = Math.max(
      1,
      Math.round(
        selectedBook.stories.reduce((sum, story) => sum + estimateReadMinutes(story.text), 0) /
          Math.max(selectedBook.stories.length, 1)
      )
    );
    return (
      <MobileBookDetail
        scrollRef={bookDetailScrollRef}
        title={selectedBook.title}
        subtitle={selectedBook.subtitle}
        coverUrl={getCoverUrl(selectedBook.cover, 800)}
        description={selectedBookDescription}
        descriptionExpanded={selectedBookDescriptionExpanded}
        needsDescriptionToggle={selectedBookNeedsDescriptionToggle}
        onToggleDescription={() => setSelectedBookDescriptionExpanded((current) => !current)}
        pills={[
          formatLanguage(selectedBook.language),
          formatLevel(selectedBook.level),
          ...(selectedBook.region ? [formatRegion(selectedBook.region)] : []),
          ...(selectedBook.topic ? [formatTopic(selectedBook.topic)] : []),
        ]}
        storyCount={selectedBook.stories.length}
        averageMinutes={averageMinutes}
        isBookSaved={isBookSaved}
        onPressBack={() => setSelectedBook(null)}
        onPressSave={() => toggleBookSaved(selectedBook)}
        onPressStartReading={
          selectedBook.stories[0]
            ? () => {
                const firstStory = selectedBook.stories[0];
                const resolved = resolveStorySelection(firstStory.id, selectedBook, firstStory);
                if (resolved) openSelection(resolved);
              }
            : undefined
        }
        continueStory={
          selectedBookContinueStory
            ? {
                title: selectedBookContinueStory.title,
                body: "Jump back into this story without searching for it.",
                onPress: () => {
                  const resolved = resolveStorySelection(
                    selectedBookContinueStory.id,
                    selectedBook,
                    selectedBookContinueStory
                  );
                  if (resolved) openSelection(resolved);
                },
              }
            : null
        }
        selectedTab={selectedBookTab}
        onSelectTab={setSelectedBookTab}
        storySearchQuery={selectedBookStoryQuery}
        onChangeStorySearchQuery={setSelectedBookStoryQuery}
        onClearStorySearchQuery={() => setSelectedBookStoryQuery("")}
        selectedTopicLabel={
          selectedBookStoryTopicFilter === "all"
            ? "All topics"
            : selectedBookStoryTopics.find((topic) => topic.toLowerCase() === selectedBookStoryTopicFilter) ??
              "All topics"
        }
        selectedSortLabel={
          selectedBookStorySortKey === "recommended"
            ? "Recommended"
            : selectedBookStorySortKey === "shortest"
              ? "Shortest"
              : selectedBookStorySortKey === "longest"
                ? "Longest"
                : "A-Z"
        }
        showingStoriesLabel={`Showing ${selectedBookFilteredStories.length} of ${selectedBook.stories.length} stories`}
        onOpenTopicPicker={() => setSelectedBookStoryPickerSection("topic")}
        onOpenSortPicker={() => setSelectedBookStoryPickerSection("sort")}
        pickerSection={selectedBookStoryPickerSection}
        onClosePicker={() => setSelectedBookStoryPickerSection(null)}
        topicOptions={[
          {
            key: "all",
            label: "All topics",
            active: selectedBookStoryTopicFilter === "all",
            onPress: () => {
              setSelectedBookStoryTopicFilter("all");
              setSelectedBookStoryPickerSection(null);
            },
          },
          ...selectedBookStoryTopics.map((topic) => ({
            key: topic,
            label: topic,
            active: selectedBookStoryTopicFilter === topic.toLowerCase(),
            onPress: () => {
              setSelectedBookStoryTopicFilter(topic.toLowerCase());
              setSelectedBookStoryPickerSection(null);
            },
          })),
        ]}
        sortOptions={
          ([
            ["recommended", "Recommended"],
            ["shortest", "Shortest"],
            ["longest", "Longest"],
            ["title", "A-Z"],
          ] as Array<[BookStorySortKey, string]>).map(([key, label]) => ({
            key,
            label,
            active: selectedBookStorySortKey === key,
            onPress: () => {
              setSelectedBookStorySortKey(key);
              setSelectedBookStoryPickerSection(null);
            },
          }))
        }
        storyRows={selectedBookFilteredStories.map(({ story, resolved, readMinutes, topic }, index) => ({
          key: `book-story-${story.id}`,
          title: story.title,
          subtitle: selectedBook.title,
          meta: `${readMinutes} min read · ${topic}`,
          coverUrl: getCoverUrl(story.cover ?? selectedBook.cover),
          qaLabel: index === 0 ? "qa-book-story-row-0" : `qa-book-story-row-${story.id}`,
          onPress: () => openSelection(resolved),
        }))}
        suggestedStories={selectedBookSuggestedStories.map((selection) => ({
          key: `suggested-story-${selection.story.id}`,
          title: selection.story.title,
          subtitle: selection.book.title,
          coverUrl: getCoverUrl(selection.story.cover ?? selection.book.cover),
          meta: `${formatLanguage(selection.story.language ?? selection.book.language)} · ${formatTopic(selection.story.topic ?? selection.book.topic)}`,
          onPress: () => openSelection(selection),
        }))}
        relatedBooks={selectedBookRelatedBooks.map((book) => ({
          key: `related-book-${book.id}`,
          title: book.title,
          coverUrl: getCoverUrl(book.cover),
          language: formatLanguage(book.language),
          region: formatRegion(book.region),
          level: book.level,
          statsLine: `${book.stories.length} stories`,
          topicsLine: formatTopic(book.topic),
          description: book.description ?? book.subtitle ?? undefined,
          onPress: () => openBook(book),
        }))}
        vocabWords={selectedBookVocabList.map((item) => item.word)}
        reviewQuotes={[
          "Perfect length for daily practice.",
          "Great vocabulary and natural dialogues.",
          "Easy to binge 3-4 stories in one session.",
        ]}
        aboutText={selectedBook.description?.trim() || selectedBook.subtitle?.trim() || "No description available yet."}
      />
    );
  }

  if (practiceSessionView) {
    return practiceSessionView;
  }

  let content = homeView;
  if (activeScreen === "explore") content = exploreView;
  if (activeScreen === "practice") content = practiceView;
  if (activeScreen === "favorites") content = favoritesView;
  if (activeScreen === "journey") content = journeyView;
  if (activeScreen === "library") content = libraryView;
  if (activeScreen === "settings") content = settingsView;
  if (activeScreen === "create") content = createView;
  if (activeScreen === "progress") content = progressView;

  return (
    <View style={styles.shell}>
      <ScrollView
        ref={shellScrollRef}
        style={styles.scrollView}
        contentContainerStyle={[styles.container, styles.containerGrow]}
        scrollEnabled
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical
        decelerationRate="normal"
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="never"
      >
        {content}
      </ScrollView>

      {activeGamificationCelebration ? (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.celebrationToast,
            {
              opacity: celebrationAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 1],
              }),
              transform: [
                {
                  translateY: celebrationAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-40, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <CelebrationBurst progress={celebrationAnim} />
          <View style={styles.celebrationToastContent}>
            <View style={styles.celebrationToastCopy}>
              <Feather name="star" size={16} color="#8ef0c6" />
              <Text style={styles.celebrationToastTitle}>{activeGamificationCelebration.title}</Text>
            </View>
            <Pressable
              onPress={() => {
                void dismissGamificationCelebration(activeGamificationCelebration.id);
              }}
              hitSlop={12}
            >
              <Feather name="x" size={16} color="#9cb0c9" />
            </Pressable>
          </View>
          <Text style={styles.celebrationToastBody}>{activeGamificationCelebration.cta}</Text>
        </Animated.View>
      ) : null}

      {journeyMilestone ? (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.celebrationToast,
            {
              opacity: journeyMilestoneAnim,
              transform: [
                {
                  translateY: journeyMilestoneAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-40, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.celebrationToastContent}>
            <View style={styles.celebrationToastCopy}>
              <Feather name="award" size={16} color="#86efac" />
              <Text style={styles.celebrationToastTitle}>{journeyMilestone.title}</Text>
            </View>
            <Pressable onPress={() => setJourneyMilestone(null)} hitSlop={12}>
              <Feather name="x" size={16} color="#9cb0c9" />
            </Pressable>
          </View>
          <Text style={styles.celebrationToastBody}>{journeyMilestone.body}</Text>
          <View style={styles.milestoneToastActions}>
            <Pressable onPress={journeyMilestone.onPress} style={styles.milestoneToastPrimaryBtn}>
              <Text style={styles.milestoneToastPrimaryBtnText}>{journeyMilestone.cta}</Text>
            </Pressable>
            <Pressable onPress={() => setJourneyMilestone(null)} hitSlop={8}>
              <Text style={styles.milestoneToastLaterText}>Later</Text>
            </Pressable>
          </View>
        </Animated.View>
      ) : null}

      <Modal visible={shouldShowOnboardingSurvey} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.onboardingModal} accessibilityLabel="qa-onboarding-survey" testID="qa-onboarding-survey">
            <View style={styles.onboardingProgressRow}>
              {onboardingSurveySteps.map((step, index) => (
                <View
                  key={step.title}
                  style={[
                    styles.onboardingProgressSegment,
                    index <= onboardingSurveyStep ? styles.onboardingProgressSegmentActive : null,
                  ]}
                />
              ))}
            </View>
            <View style={styles.onboardingHeader}>
              <View style={styles.onboardingHeaderCopy}>
                <Text style={styles.sectionEyebrow}>Personalize your path</Text>
                <Text style={styles.sectionTitle}>{onboardingSurveySteps[onboardingSurveyStep]?.title}</Text>
                <Text style={styles.metaLine}>{onboardingSurveySteps[onboardingSurveyStep]?.body}</Text>
              </View>
              <View style={styles.onboardingStepPill}>
                <Text style={styles.onboardingStepPillText}>
                  {onboardingSurveyStep + 1}/{onboardingSurveySteps.length}
                </Text>
              </View>
            </View>

            <View style={styles.onboardingSlideCard}>
              <View style={styles.onboardingOptionsWrap}>
              {(onboardingSurveySteps[onboardingSurveyStep]?.options.length ?? 0) > 0 ? (
                onboardingSurveySteps[onboardingSurveyStep]?.options.map((option) => {
                  const step = onboardingSurveySteps[onboardingSurveyStep];
                  const active = "isActive" in step && typeof step.isActive === "function"
                    ? step.isActive(option)
                    : step.selected === option;
                  return (
                    <Pressable
                      key={`${onboardingSurveyStep}-${option}`}
                      onPress={() => step.select(option)}
                      accessibilityLabel={`qa-onboarding-option-${onboardingSurveyStep}-${toQaSegment(option)}`}
                      testID={`qa-onboarding-option-${onboardingSurveyStep}-${toQaSegment(option)}`}
                      style={[styles.filterChip, active ? styles.filterChipActive : null]}
                    >
                      <Text style={[styles.filterChipText, active ? styles.filterChipTextActive : null]}>
                        {step.format(option)}
                      </Text>
                    </Pressable>
                  );
                })
              ) : (
                <Text style={styles.helperText}>
                  {"empty" in onboardingSurveySteps[onboardingSurveyStep]
                    ? onboardingSurveySteps[onboardingSurveyStep].empty
                    : "No options yet."}
                </Text>
              )}
            </View>
            </View>

            {onboardingError ? <Text style={styles.errorText}>{onboardingError}</Text> : null}

            <View style={styles.onboardingActionRow}>
              <Pressable
                onPress={() => setOnboardingSurveyStep((current) => Math.max(0, current - 1))}
                disabled={onboardingSurveyStep === 0 || preferencesLoading}
                accessibilityLabel="qa-onboarding-back"
                testID="qa-onboarding-back"
                style={[styles.inlineButton, onboardingSurveyStep === 0 || preferencesLoading ? styles.disabledActionButton : null]}
              >
                <Text style={styles.inlineButtonText}>Back</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (onboardingSurveyStep >= onboardingSurveySteps.length - 1) {
                    void completeOnboardingSurvey();
                    return;
                  }
                  setOnboardingSurveyStep((current) => Math.min(onboardingSurveySteps.length - 1, current + 1));
                }}
                disabled={preferencesLoading}
                accessibilityLabel="qa-onboarding-next"
                testID="qa-onboarding-next"
                style={[styles.inlineButton, styles.primaryButton, preferencesLoading ? styles.disabledActionButton : null]}
              >
                <Text style={[styles.inlineButtonText, styles.primaryButtonText]}>
                  {preferencesLoading
                    ? "Saving..."
                    : onboardingSurveyStep >= onboardingSurveySteps.length - 1
                      ? "Finish setup"
                      : "Next"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={shouldShowOnboardingTour} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.onboardingModal} accessibilityLabel="qa-onboarding-tour" testID="qa-onboarding-tour">
            <View style={styles.onboardingProgressRow}>
              {PRODUCT_TOUR_MESSAGES.map((message, index) => (
                <View
                  key={message.title}
                  style={[
                    styles.onboardingProgressSegment,
                    onboardingTourStep !== null && index <= onboardingTourStep ? styles.onboardingProgressSegmentActive : null,
                  ]}
                />
              ))}
            </View>
            <View style={styles.onboardingHeaderCopy}>
              <Text style={styles.sectionEyebrow}>
                Product tour {onboardingTourStep !== null ? onboardingTourStep + 1 : 0}/{PRODUCT_TOUR_MESSAGES.length}
              </Text>
              <View style={styles.onboardingTourTargetBadge}>
                <Text style={styles.onboardingTourTargetBadgeText}>
                  {activeOnboardingTourMessage?.targetLabel ?? "Tour"}
                </Text>
              </View>
              <Text style={styles.sectionTitle}>
                {activeOnboardingTourMessage?.title ?? ""}
              </Text>
              <Text style={styles.metaLine}>
                {activeOnboardingTourMessage?.body ?? ""}
              </Text>
            </View>
            {onboardingError ? <Text style={styles.errorText}>{onboardingError}</Text> : null}
            <View style={styles.onboardingActionRow}>
              <View style={styles.onboardingSecondaryActions}>
                <Pressable
                  onPress={() => void completeOnboardingTour()}
                  disabled={preferencesLoading}
                  accessibilityLabel="qa-onboarding-tour-skip"
                  testID="qa-onboarding-tour-skip"
                  style={[styles.inlineButton, preferencesLoading ? styles.disabledActionButton : null]}
                >
                  <Text style={styles.inlineButtonText}>Skip</Text>
                </Pressable>
                <Pressable
                  onPress={() => setOnboardingTourStep((current) => (current === null ? 0 : Math.max(0, current - 1)))}
                  disabled={preferencesLoading || onboardingTourStep === 0}
                  accessibilityLabel="qa-onboarding-tour-back"
                  testID="qa-onboarding-tour-back"
                  style={[styles.inlineButton, preferencesLoading || onboardingTourStep === 0 ? styles.disabledActionButton : null]}
                >
                  <Text style={styles.inlineButtonText}>Back</Text>
                </Pressable>
              </View>
              <Pressable
                onPress={() => {
                  if (onboardingTourStep === null || onboardingTourStep >= PRODUCT_TOUR_MESSAGES.length - 1) {
                    void completeOnboardingTour();
                    return;
                  }
                  setOnboardingTourStep(onboardingTourStep + 1);
                }}
                disabled={preferencesLoading}
                accessibilityLabel="qa-onboarding-tour-next"
                testID="qa-onboarding-tour-next"
                style={[styles.inlineButton, styles.primaryButton, preferencesLoading ? styles.disabledActionButton : null]}
              >
                <Text style={[styles.inlineButtonText, styles.primaryButtonText]}>
                  {onboardingTourStep !== null && onboardingTourStep >= PRODUCT_TOUR_MESSAGES.length - 1 ? "Got it" : "Next"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.bottomNav}>
        {bottomTabs.map((tab) => {
          const isActive = screenMatchesTab(tab.key);
          const isTourHighlighted = tourTargetMatchesTab(tab.key);
          return (
            <Pressable
              key={tab.key}
              onPress={() => handleBottomTabPress(tab.key)}
              accessibilityRole="button"
              accessibilityLabel={`qa-tab-${tab.key}`}
              testID={`qa-tab-${tab.key}`}
              style={[
                styles.bottomTab,
                isActive ? styles.bottomTabActive : null,
                isTourHighlighted ? styles.bottomTabTourHighlight : null,
              ]}
            >
              <View style={styles.bottomTabIcon}>
                <BottomTabIcon tab={tab.key} active={isActive} />
              </View>
              <Text
                style={[
                  styles.bottomTabText,
                  isActive ? styles.bottomTabTextActive : null,
                  isTourHighlighted ? styles.bottomTabTextTourHighlight : null,
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Modal visible={menuOpen} animationType="slide" transparent onRequestClose={() => setMenuOpen(false)}>
        <View style={styles.menuBackdrop}>
          <Pressable style={styles.menuDismissZone} onPress={() => setMenuOpen(false)} />
          <View style={styles.menuPanel}>
            <View style={styles.menuPanelHeader}>
              <Text style={styles.menuTitle}>Menu</Text>
              <Pressable onPress={() => setMenuOpen(false)} style={styles.menuClose}>
                <Feather name="x" size={18} color="#dbe9ff" />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.menuContent}>
              {isSignedIn ? (
                <>
                  <MenuLink
                    label="Progress"
                    icon="progress"
                    onPress={() => {
                      setActiveScreen("progress");
                      setMenuOpen(false);
                    }}
                  />
                  <MenuLink
                    label="Settings"
                    icon="settings"
                    onPress={() => {
                      setActiveScreen("settings");
                      setMenuOpen(false);
                    }}
                  />
                  <MenuLink
                    label="My Library"
                    icon="library"
                    onPress={() => {
                      setActiveScreen("library");
                      setMenuOpen(false);
                    }}
                  />
                  <MenuLink
                    label="Create"
                    icon="create"
                    onPress={() => {
                      setActiveScreen("create");
                      setMenuOpen(false);
                    }}
                  />
                  <MenuLink
                    label="Journey"
                    icon="journey"
                    onPress={() => {
                      setActiveScreen("journey");
                      setMenuOpen(false);
                    }}
                  />

                  {effectivePlan === "free" ? (
                    <MenuLink
                      label="Story of the Week"
                      icon="story"
                      onPress={() => {
                        const spotlight = getSpotlightSelection();
                        if (spotlight) openSelection(spotlight);
                      }}
                    />
                  ) : null}

                  {effectivePlan === "basic" ? (
                    <MenuLink
                      label="Story of the Day"
                      icon="story"
                      onPress={() => {
                        const spotlight = getSpotlightSelection();
                        if (spotlight) openSelection(spotlight);
                      }}
                    />
                  ) : null}

                  {(effectivePlan === "free" || effectivePlan === "basic") ? (
                    <MenuLink label="Upgrade" icon="upgrade" onPress={() => void openWebPath("/plans")} tone="accent" />
                  ) : null}

                  <MenuLink
                    label="Sign out"
                    icon="signout"
                    onPress={() => {
                      setMenuOpen(false);
                      onSignOut?.();
                    }}
                  />
                </>
              ) : (
                <MenuLink
                  label="Sign in"
                  icon="signin"
                  onPress={() => {
                    setMenuOpen(false);
                    onRequestSignIn?.();
                  }}
                />
              )}

              <View style={styles.menuLegalBlock}>
                <Text style={styles.menuLegalTitle}>Legal</Text>
                <View style={styles.menuLegalLinks}>
                  <MenuLink label="Impressum" icon="legal" compact onPress={() => void openWebPath("/impressum")} />
                  <MenuLink label="Privacy" icon="legal" compact onPress={() => void openWebPath("/privacy")} />
                  <MenuLink label="Cookies" icon="legal" compact onPress={() => void openWebPath("/cookies")} />
                  <MenuLink label="Terms" icon="legal" compact onPress={() => void openWebPath("/terms")} />
                  <MenuLink
                    label="Data deletion"
                    icon="legal"
                    compact
                    onPress={() => void openWebPath("/data-deletion")}
                  />
                </View>
              </View>

              <Pressable onPress={() => void openFeedback()} style={styles.feedbackButton}>
                <Feather name="message-square" size={18} color="#dbe9ff" />
                <Text style={styles.feedbackButtonText}>Feedback</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function MenuTrigger({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.menuIconButton}>
      <Feather name="menu" size={20} color="#f5f7fb" />
    </Pressable>
  );
}

function BottomTabIcon({ tab, active }: { tab: BottomTab; active: boolean }) {
  const color = active ? "#ffffff" : "#9cb0c9";
  if (tab === "home") return <Feather name="home" size={18} color={color} />;
  if (tab === "explore") return <Feather name="compass" size={18} color={color} />;
  if (tab === "practice") return <MaterialCommunityIcons name="brain" size={19} color={color} />;
  if (tab === "favorites") return <Feather name="star" size={18} color={color} />;
  if (tab === "journey") return <MaterialCommunityIcons name="map-marker-path" size={18} color={color} />;
  if (tab === "signin") return <Feather name="log-in" size={18} color={color} />;
  return <Feather name="circle" size={18} color={color} />;
}

function MenuLink(args: {
  label: string;
  icon: MenuIconName;
  onPress: () => void;
  tone?: "default" | "accent";
  compact?: boolean;
}) {
  const { label, icon, onPress, tone = "default", compact = false } = args;
  return (
    <Pressable onPress={onPress} style={[styles.menuLink, compact ? styles.menuLinkCompact : null]}>
      <View style={styles.menuLinkRow}>
        <View style={styles.menuLinkIconWrap}>
          <MenuIcon icon={icon} tone={tone} />
        </View>
        <Text style={[styles.menuLinkText, tone === "accent" ? styles.menuLinkTextAccent : null]}>{label}</Text>
        <Feather
          name="chevron-right"
          size={16}
          color={tone === "accent" ? "#f8d48a" : "#9cb0c9"}
          style={styles.menuChevron}
        />
      </View>
    </Pressable>
  );
}

function MenuIcon({ icon, tone = "default" }: { icon: MenuIconName; tone?: "default" | "accent" }) {
  const color = tone === "accent" ? "#f8d48a" : "#dbe9ff";
  if (icon === "progress") return <Feather name="bar-chart-2" size={18} color={color} />;
  if (icon === "settings") return <Feather name="settings" size={18} color={color} />;
  if (icon === "library") return <Feather name="book-open" size={18} color={color} />;
  if (icon === "journey") return <MaterialCommunityIcons name="map-marker-path" size={18} color={color} />;
  if (icon === "create") return <Ionicons name="sparkles-outline" size={18} color={color} />;
  if (icon === "story") return <Feather name="book" size={18} color={color} />;
  if (icon === "upgrade") return <MaterialCommunityIcons name="crown-outline" size={18} color={color} />;
  if (icon === "signout") return <Feather name="log-out" size={18} color={color} />;
  if (icon === "signin") return <Feather name="log-in" size={18} color={color} />;
  return <Feather name="shield" size={18} color={color} />;
}

function PracticeModeIcon({
  icon,
  color,
}: {
  icon: PracticeModeCard["icon"];
  color: string;
}) {
  if (icon === "brain") return <MaterialCommunityIcons name="brain" size={20} color={color} />;
  if (icon === "headphones") return <Feather name="headphones" size={20} color={color} />;
  return <Feather name={icon} size={20} color={color} />;
}

function CelebrationBurst({ progress }: { progress: Animated.Value }) {
  const particles = [
    { left: "10%", top: 22, color: "#ffd36b", x: -16, y: -18 },
    { left: "22%", top: 56, color: "#8ef0c6", x: -10, y: -26 },
    { left: "76%", top: 18, color: "#7dd3fc", x: 14, y: -18 },
    { left: "89%", top: 50, color: "#ffd36b", x: 18, y: -10 },
    { left: "70%", top: 84, color: "#8ef0c6", x: 8, y: 18 },
  ] as const;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {particles.map((particle, index) => (
        <Animated.View
          key={`${particle.left}-${particle.top}-${index}`}
          style={[
            styles.celebrationParticle,
            {
              left: particle.left,
              top: particle.top,
              backgroundColor: particle.color,
              opacity: progress.interpolate({
                inputRange: [0, 0.35, 1],
                outputRange: [0, 1, 0],
              }),
              transform: [
                {
                  translateX: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, particle.x],
                  }),
                },
                {
                  translateY: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, particle.y],
                  }),
                },
                {
                  scale: progress.interpolate({
                    inputRange: [0, 0.4, 1],
                    outputRange: [0.5, 1, 0.72],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  container: {
    gap: 18,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 116,
  },
  containerGrow: {
    flexGrow: 1,
  },
  hero: {
    gap: 8,
    paddingTop: 12,
    paddingBottom: 4,
  },
  journeyHero: {
    gap: 4,
    paddingTop: 6,
    paddingBottom: 0,
  },
  journeyVariantPickerLabel: {
    color: "#9cb0c9",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
  },
  journeyVariantPickerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  journeyVariantCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "#14243b",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#27405f",
    gap: 4,
  },
  journeyVariantCardActive: {
    borderColor: "#5f83a8",
    backgroundColor: "#1c3350",
  },
  journeyVariantLabel: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  journeyVariantLabelActive: {
    color: "#dbe9ff",
  },
  journeyVariantMeta: {
    color: "#9cb0c9",
    fontSize: 12,
    fontWeight: "600",
  },
  quickActionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  quickActionCard: {
    flex: 1,
    backgroundColor: "#132238",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#29415f",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 8,
  },
  quickActionTitle: {
    color: "#f5f7fb",
    fontSize: 14,
    fontWeight: "800",
  },
  quickActionMeta: {
    color: "#99adc8",
    fontSize: 12,
    lineHeight: 16,
  },
  homeCompactCard: {
    gap: 10,
  },
  homeCompactHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  reviewFocusCard: {
    gap: 12,
  },
  languageFocusCard: {
    gap: 10,
  },
  languageFocusChip: {
    backgroundColor: "#173351",
  },
  reviewFocusHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  reviewWordRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  reviewWordChip: {
    borderRadius: 999,
    backgroundColor: "#213754",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  reviewWordChipText: {
    color: "#eef4ff",
    fontSize: 12,
    fontWeight: "700",
  },
  heroHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  heroTextBlock: {
    flex: 1,
    gap: 8,
  },
  journeyHeroTextBlock: {
    gap: 4,
  },
  eyebrow: {
    color: "#f8c15c",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  title: {
    color: "#f5f7fb",
    fontSize: 34,
    fontWeight: "800",
    lineHeight: 38,
  },
  subtitle: {
    color: "#b8c4d9",
    fontSize: 15,
    lineHeight: 22,
  },
  journeyHeroTitle: {
    color: "#f5f7fb",
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 22,
  },
  journeyHeroSubtitle: {
    color: "#9fb2cb",
    fontSize: 13,
    lineHeight: 18,
  },
  practiceSubtitle: {
    color: "#b8c4d9",
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 250,
  },
  menuButton: {
    borderRadius: 999,
    backgroundColor: "#18304d",
    borderWidth: 1,
    borderColor: "#315174",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  menuButtonText: {
    color: "#dbe9ff",
    fontSize: 13,
    fontWeight: "800",
  },
  menuIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#18304d",
    borderWidth: 1,
    borderColor: "#315174",
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    backgroundColor: "#14243b",
    borderRadius: 28,
    padding: 22,
    gap: 14,
    borderWidth: 1,
    borderColor: "#27405f",
  },
  shelfRow: {
    flexDirection: "row",
    gap: 12,
  },
  shelfCard: {
    flex: 1,
    minHeight: 132,
    justifyContent: "space-between",
  },
  shelfCardCompact: {
    flex: 1,
    minHeight: 96,
    justifyContent: "space-between",
  },
  shelfValue: {
    color: "#f5f7fb",
    fontSize: 32,
    fontWeight: "800",
  },
  shelfMeta: {
    color: "#a6b7cf",
    fontSize: 13,
    lineHeight: 18,
  },
  collectionGrid: {
    gap: 10,
  },
  collectionCard: {
    borderRadius: 20,
    padding: 18,
  },
  collectionTitle: {
    color: "#f5f7fb",
    fontSize: 18,
    fontWeight: "800",
  },
  collectionMeta: {
    color: "#a8bbd4",
    fontSize: 14,
    lineHeight: 20,
  },
  exploreSummaryCard: {
    gap: 12,
  },
  exploreSummaryHeader: {
    gap: 6,
  },
  section: {
    gap: 12,
  },
  exploreFeatureGrid: {
    gap: 12,
  },
  exploreEditorialCard: {
    gap: 8,
    backgroundColor: "#10253d",
    borderColor: "#294364",
  },
  exploreEditorialCardAlt: {
    backgroundColor: "#142941",
  },
  exploreEditorialEyebrow: {
    color: "#f4c56e",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  exploreEditorialTitle: {
    color: "#ffffff",
    fontSize: 22,
    lineHeight: 26,
    fontWeight: "800",
  },
  exploreEditorialMeta: {
    color: "#b5c8df",
    fontSize: 14,
    lineHeight: 20,
  },
  exploreEditorialImage: {
    width: "100%",
    height: 110,
    borderRadius: 18,
    backgroundColor: "#0f1f34",
    marginBottom: 2,
  },
  exploreSearchCard: {
    gap: 14,
  },
  exploreFieldGrid: {
    gap: 10,
  },
  exploreControlsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  exploreFilterButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#35506f",
    backgroundColor: "#1a2f48",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  exploreFilterButtonText: {
    color: "#dbe9ff",
    fontSize: 12,
    fontWeight: "700",
  },
  exploreExpandedList: {
    gap: 12,
  },
  storyFeed: {
    gap: 12,
  },
  exploreStoryCard: {
    flexDirection: "row",
    gap: 14,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#27405f",
    backgroundColor: "#14243b",
    padding: 12,
  },
  exploreStoryImage: {
    width: 92,
    height: 118,
    borderRadius: 16,
    backgroundColor: "#102238",
  },
  exploreStoryBody: {
    flex: 1,
    justifyContent: "center",
    gap: 6,
  },
  exploreStoryTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  exploreStoryBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#35506f",
    backgroundColor: "#1a2f48",
    color: "#dbe9ff",
    fontSize: 11,
    fontWeight: "800",
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: "hidden",
  },
  exploreStoryTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 24,
  },
  exploreStorySubtitle: {
    color: "#f8c15c",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  exploreStoryMeta: {
    color: "#aebcd3",
    fontSize: 13,
    lineHeight: 18,
  },
  bookWebCard: {
    width: 324,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#27405f",
    backgroundColor: "#14243b",
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 14,
  },
  bookWebCardFullWidth: {
    width: "100%",
  },
  bookWebCardCoverFrame: {
    width: 104,
    aspectRatio: 0.72,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#0c1a2c",
    borderWidth: 1,
    borderColor: "#27405f",
    flexShrink: 0,
  },
  bookWebCardCover: {
    width: "100%",
    height: "100%",
    backgroundColor: "#102238",
  },
  bookWebCardBody: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  bookWebCardBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  bookWebCardBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#35506f",
    backgroundColor: "#1a2f48",
    color: "#dbe9ff",
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: "hidden",
  },
  bookWebCardLevelBadge: {
    borderColor: "#2b7a66",
    backgroundColor: "rgba(37, 120, 98, 0.25)",
    color: "#8ef0c6",
  },
  bookWebCardTitle: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "800",
    lineHeight: 22,
  },
  bookWebCardStats: {
    color: "#9cb0c9",
    fontSize: 14,
    lineHeight: 18,
  },
  bookWebCardTopics: {
    color: "#9cb0c9",
    fontSize: 14,
    lineHeight: 18,
  },
  bookWebCardDescription: {
    color: "#aebcd3",
    fontSize: 14,
    lineHeight: 20,
  },
  exploreSearchInput: {
    flex: 1,
    color: "#f5f7fb",
    fontSize: 14,
    fontWeight: "500",
  },
  exploreCompactSearch: {
    gap: 8,
  },
  exploreSearchBox: {
    gap: 8,
    zIndex: 20,
  },
  exploreSearchInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#29435f",
    backgroundColor: "#0f1f34",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  exploreSearchClear: {
    paddingVertical: 2,
  },
  exploreSearchClearText: {
    color: "#92a8c3",
    fontSize: 12,
    fontWeight: "600",
  },
  exploreSearchHint: {
    color: "#8ea3bf",
    fontSize: 11,
    fontWeight: "500",
    paddingHorizontal: 2,
  },
  qaDevOnlyRow: {
    alignItems: "flex-end",
    paddingHorizontal: 20,
    marginTop: -6,
    marginBottom: 8,
  },
  qaDevOnlyButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(248, 193, 92, 0.45)",
    backgroundColor: "rgba(248, 193, 92, 0.12)",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  qaDevOnlyButtonText: {
    color: "#f8c15c",
    fontSize: 11,
    fontWeight: "700",
  },
  exploreSuggestionsCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#29435f",
    backgroundColor: "#0f1f34",
    overflow: "hidden",
  },
  exploreSuggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#29435f",
  },
  exploreSuggestionCover: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: "#17304b",
  },
  exploreSuggestionBody: {
    flex: 1,
    gap: 4,
  },
  exploreSuggestionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  exploreSuggestionTitle: {
    flex: 1,
    color: "#f5f7fb",
    fontSize: 14,
    fontWeight: "700",
  },
  exploreSuggestionSubtitle: {
    color: "#8ea3bf",
    fontSize: 12,
    fontWeight: "500",
  },
  exploreSuggestionBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#3c5876",
    backgroundColor: "#17304b",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  exploreSuggestionBadgeText: {
    color: "#dbe9ff",
    fontSize: 10,
    fontWeight: "700",
  },
  exploreCompactFiltersRow: {
    flexDirection: "row",
    gap: 10,
  },
  exploreCompactFilterField: {
    flex: 1,
    gap: 6,
  },
  exploreCompactFilterButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#29435f",
    backgroundColor: "#102238",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  exploreCompactFilterLabel: {
    color: "#92a8c3",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  exploreCompactFilterValue: {
    color: "#f5f7fb",
    fontSize: 13,
    fontWeight: "600",
  },
  exploreTopicRows: {
    gap: 6,
  },
  filterSection: {
    gap: 8,
  },
  filterLabel: {
    color: "#9cb0c9",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  filterChips: {
    gap: 6,
    paddingRight: 12,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#29435f",
    backgroundColor: "#0f1f34",
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  filterChipActive: {
    backgroundColor: "#1c4f86",
    borderColor: "#3f79ba",
  },
  filterChipText: {
    color: "#dbe9ff",
    fontSize: 11,
    fontWeight: "700",
  },
  filterChipTextActive: {
    color: "#ffffff",
  },
  accountCard: {
    backgroundColor: "#18304d",
  },
  accountHeader: {
    gap: 12,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  accountIdentity: {
    gap: 4,
    flex: 1,
  },
  sectionEyebrow: {
    color: "#f8c15c",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  accountMeta: {
    color: "#b7cae5",
    fontSize: 14,
    lineHeight: 20,
  },
  planPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#0f2034",
    borderWidth: 1,
    borderColor: "#315174",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  planPillText: {
    color: "#dbe9ff",
    fontSize: 13,
    fontWeight: "800",
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  summaryTile: {
    minWidth: "47%",
    flexGrow: 1,
    borderRadius: 20,
    backgroundColor: "#0f1f34",
    borderWidth: 1,
    borderColor: "#29435f",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 4,
  },
  summaryValue: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "800",
  },
  summaryLabel: {
    color: "#aebcd3",
    fontSize: 13,
    lineHeight: 18,
  },
  preferenceSummaryStack: {
    gap: 10,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    borderRadius: 16,
    backgroundColor: "#0f1f34",
    borderWidth: 1,
    borderColor: "#29435f",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  journeyPreviewStack: {
    gap: 10,
  },
  journeyLevelCard: {
    gap: 10,
    borderRadius: 18,
    backgroundColor: "#0f1f34",
    borderWidth: 1,
    borderColor: "#29435f",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  journeyMapSection: {
    gap: 12,
    borderRadius: 24,
    backgroundColor: "#18304d",
    borderWidth: 1,
    borderColor: "#29435f",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  journeyMapList: {
    gap: 18,
  },
  journeyMapSequence: {
    gap: 10,
  },
  journeyMapNodeWrap: {
    width: "100%",
    zIndex: 1,
  },
  journeyMapNodeWrapLeft: {
    alignItems: "flex-start",
  },
  journeyMapNodeWrapRight: {
    alignItems: "flex-end",
  },
  journeyMapNode: {
    width: 172,
    alignItems: "center",
    gap: 6,
  },
  journeyMapNodeLocked: {
    opacity: 0.72,
  },
  journeyMapNodeActive: {
    transform: [{ scale: 1.02 }],
  },
  journeyMapBadge: {
    alignSelf: "center",
    color: "#dbe9ff",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
    backgroundColor: "#142a44",
    borderWidth: 1,
    borderColor: "#29435f",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    overflow: "hidden",
  },
  journeyMapArt: {
    width: 84,
    height: 84,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#203754",
    borderWidth: 1,
    borderColor: "#29435f",
  },
  journeyMapArtImage: {
    width: "100%",
    height: "100%",
  },
  journeyMapArtFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  journeyMapTitle: {
    color: "#f5f7fb",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 20,
  },
  journeyMapMeta: {
    color: "#8fa4c0",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 16,
  },
  journeyMapConnectorRow: {
    height: 132,
    width: "100%",
    justifyContent: "flex-start",
    marginTop: -104,
    paddingHorizontal: 42,
  },
  journeyMapConnectorRowLeft: {
    alignItems: "flex-start",
  },
  journeyMapConnectorRowRight: {
    alignItems: "flex-end",
  },
  journeyMapConnectorCurve: {
    width: "50%",
    height: 156,
    borderTopWidth: 2,
    borderColor: "#83b05e",
    borderStyle: "dashed",
    opacity: 0.38,
  },
  journeyMapConnectorCurveLeft: {
    borderRightWidth: 2,
    borderTopRightRadius: 64,
  },
  journeyMapConnectorCurveRight: {
    borderLeftWidth: 2,
    borderTopLeftRadius: 64,
  },
  journeyLevelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  journeyLevelText: {
    flex: 1,
    gap: 2,
  },
  journeyLevelTitle: {
    color: "#f5f7fb",
    fontSize: 16,
    fontWeight: "800",
  },
  journeyLevelMeta: {
    color: "#aebcd3",
    fontSize: 12,
    lineHeight: 16,
  },
  journeyPlacementTestCard: {
    borderRadius: 16,
    backgroundColor: "#18304d",
    borderWidth: 1,
    borderColor: "#29435f",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  journeyPlacementTestCopy: {
    flex: 1,
    gap: 2,
  },
  journeyPlacementTestTitle: {
    color: "#d7e7ff",
    fontSize: 14,
    fontWeight: "700",
  },
  journeyPlacementTestBody: {
    color: "#8fa8c8",
    fontSize: 12,
    lineHeight: 16,
  },
  journeyPlacementTestButton: {
    borderRadius: 10,
    backgroundColor: "#203754",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#315174",
    opacity: 0.6,
  },
  journeyPlacementTestButtonText: {
    color: "#8fa8c8",
    fontSize: 12,
    fontWeight: "600",
  },
  mutedLabel: {
    color: "#8fa4c0",
  },
  journeyTopicChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  journeyTopicList: {
    gap: 10,
  },
  journeyTopicRow: {
    borderRadius: 16,
    backgroundColor: "#12253a",
    borderWidth: 1,
    borderColor: "#29435f",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  journeyTopicRowActive: {
    borderColor: "#4b77ab",
    backgroundColor: "#17314d",
  },
  journeyTopicRowCopy: {
    gap: 4,
  },
  journeyTopicRowTitle: {
    color: "#f5f7fb",
    fontSize: 15,
    fontWeight: "800",
  },
  journeyTopicRowMeta: {
    color: "#aebcd3",
    fontSize: 12,
    lineHeight: 16,
  },
  journeyTopicRowActions: {
    flexDirection: "row",
    gap: 8,
  },
  journeyPrimaryActionCard: {
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(248,193,92,0.28)",
    backgroundColor: "rgba(248,193,92,0.1)",
    padding: 14,
  },
  journeyPlanCard: {
    gap: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(190,242,100,0.22)",
    backgroundColor: "rgba(132,204,22,0.08)",
    padding: 14,
  },
  journeyCompactSummaryCard: {
    gap: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#29435f",
    backgroundColor: "#142a44",
    padding: 14,
  },
  journeyCompactSummaryTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  journeyCompactScoreWrap: {
    flex: 1,
    gap: 4,
  },
  journeyCompactScoreValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 10,
    flexWrap: "wrap",
  },
  journeyCompactScoreValue: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "900",
    lineHeight: 32,
  },
  journeyCompactScoreMeta: {
    color: "#dbe9ff",
    fontSize: 13,
    fontWeight: "700",
  },
  journeyCompactNextLine: {
    color: "#dbe9ff",
    fontSize: 14,
    lineHeight: 20,
  },
  journeyInsightsGrid: {
    gap: 12,
  },
  journeyInsightCard: {
    gap: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#29435f",
    backgroundColor: "#142a44",
    padding: 14,
  },
  journeyReviewLaneCard: {
    borderColor: "rgba(248,193,92,0.28)",
    backgroundColor: "rgba(248,193,92,0.08)",
  },
  journeyMilestoneCard: {
    borderColor: "rgba(110,231,183,0.26)",
    backgroundColor: "rgba(16,185,129,0.1)",
  },
  journeyMilestoneBurst: {
    position: "relative",
    height: 0,
  },
  journeyMilestoneParticle: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  journeyMilestoneActions: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  journeyScoreRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
  },
  journeyScoreValue: {
    color: "#ffffff",
    fontSize: 36,
    fontWeight: "900",
    lineHeight: 38,
  },
  journeyScoreCopy: {
    flex: 1,
    gap: 2,
  },
  journeyScoreBar: {
    height: 8,
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  journeyScoreBarFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#84cc16",
  },
  journeyPlacementInlineCard: {
    gap: 8,
    marginTop: 12,
  },
  journeyPlacementInlineHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  journeyCompactPlacementCopy: {
    color: "#9cb0c9",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "right",
    flexShrink: 1,
  },
  journeyPrimaryActionCopy: {
    gap: 4,
  },
  journeyPrimaryActionEyebrow: {
    color: "#f8d48a",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  journeyPrimaryActionTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
  },
  journeyPrimaryActionBody: {
    color: "#dbe9ff",
    fontSize: 14,
    lineHeight: 20,
  },
  journeyTopicAction: {
    borderRadius: 999,
    backgroundColor: "#1b3550",
    borderWidth: 1,
    borderColor: "#355070",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  journeyTopicActionPrimary: {
    backgroundColor: "#f8c15c",
    borderColor: "#f8c15c",
  },
  journeyTopicActionDisabled: {
    backgroundColor: "#16283d",
    borderColor: "#243a56",
  },
  journeyTopicActionText: {
    color: "#dbe9ff",
    fontSize: 12,
    fontWeight: "800",
  },
  journeyTopicActionTextPrimary: {
    color: "#0d1828",
  },
  journeyTopicActionTextDisabled: {
    color: "#7f95b2",
  },
  journeyTopicChipLocked: {
    backgroundColor: "#12253a",
    borderWidth: 1,
    borderColor: "#243a56",
  },
  journeyTopicChipComplete: {
    backgroundColor: "#1b3550",
  },
  journeyTopicChipTextLocked: {
    color: "#8fa4c0",
  },
  journeyTopicDetailCard: {
    gap: 12,
    borderRadius: 20,
    backgroundColor: "#102238",
    borderWidth: 1,
    borderColor: "#29435f",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  journeyTopicProgressText: {
    color: "#f8c15c",
    fontSize: 18,
    fontWeight: "800",
  },
  journeyStoryList: {
    gap: 10,
  },
  journeyStoryRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    backgroundColor: "#142a44",
    borderWidth: 1,
    borderColor: "#29435f",
    paddingRight: 8,
    overflow: "hidden",
  },
  journeyStoryRowContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  journeyStoryDownloadBtn: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  journeyStoryCover: {
    width: 54,
    height: 54,
    borderRadius: 12,
    backgroundColor: "#0f1f34",
  },
  journeyStoryCopy: {
    flex: 1,
    gap: 3,
  },
  journeyStoryBadge: {
    alignSelf: "flex-start",
    color: "#f8c15c",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.9,
  },
  journeyStoryTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 19,
  },
  journeyStoryMeta: {
    color: "#aebcd3",
    fontSize: 12,
    lineHeight: 16,
  },
  preferenceBlock: {
    gap: 4,
  },
  preferenceEditorSection: {
    gap: 10,
    paddingTop: 4,
  },
  preferenceLabel: {
    color: "#9fb5d0",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  preferenceValue: {
    color: "#f1f6ff",
    fontSize: 16,
    lineHeight: 23,
  },
  preferenceChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  preferenceInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  preferenceInput: {
    flex: 1,
    minHeight: 44,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#29435f",
    backgroundColor: "#0f1f34",
    color: "#eef4ff",
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
  preferenceChip: {
    borderRadius: 999,
    backgroundColor: "#0f1f34",
    borderWidth: 1,
    borderColor: "#29435f",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  preferenceChipText: {
    color: "#dbe9ff",
    fontSize: 13,
    fontWeight: "700",
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "700",
  },
  metaLine: {
    color: "#d6dfec",
    fontSize: 15,
    lineHeight: 21,
  },
  helperText: {
    color: "#9cb0c9",
    fontSize: 13,
    lineHeight: 18,
  },
  dailyLoopCard: {
    gap: 10,
    paddingTop: 18,
    paddingBottom: 18,
  },
  onboardingHighlightedSurface: {
    borderWidth: 2,
    borderColor: "#f8c15c",
    shadowColor: "#f8c15c",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
  },
  dailyLoopTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 28,
  },
  libraryQuickRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 2,
    marginBottom: 2,
  },
  libraryMicroStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 2,
  },
  libraryMicroStat: {
    minWidth: "47%",
    flexGrow: 1,
    borderRadius: 14,
    backgroundColor: "#102238",
    borderWidth: 1,
    borderColor: "#29435f",
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 2,
  },
  libraryMicroStatValue: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
  },
  libraryMicroStatLabel: {
    color: "#aebcd3",
    fontSize: 11,
    fontWeight: "700",
  },
  settingsSaveRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  createActionStack: {
    gap: 8,
    marginTop: 4,
  },
  createStatusNotice: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(110,231,183,0.22)",
    backgroundColor: "rgba(16,185,129,0.12)",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  createStatusNoticeText: {
    color: "#dff8ee",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  createStatusCard: {
    marginTop: 2,
    gap: 6,
    borderColor: "rgba(96,165,250,0.24)",
    backgroundColor: "rgba(59,130,246,0.08)",
  },
  createResultCard: {
    marginTop: 8,
    gap: 8,
    backgroundColor: "#102238",
  },
  createHistoryCard: {
    marginTop: 8,
    gap: 10,
    backgroundColor: "#102238",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  createHistoryList: {
    gap: 10,
  },
  createHistoryItem: {
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#29435f",
    backgroundColor: "#0f1f34",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  createHistoryItemCopy: {
    gap: 4,
  },
  createHistoryItemTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
    lineHeight: 20,
  },
  createHistoryItemMeta: {
    color: "#aebcd3",
    fontSize: 12,
    lineHeight: 16,
  },
  createHistoryItemActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  settingsPlanCard: {
    gap: 10,
  },
  settingsActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  errorText: {
    color: "#ffb4b4",
    fontSize: 13,
    lineHeight: 18,
  },
  sectionHeader: {
    gap: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  sectionHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sectionHeaderActionText: {
    color: "#dbe9ff",
    fontSize: 12,
    fontWeight: "800",
  },
  gamificationMiniBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#27405f",
    backgroundColor: "#18314d",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  gamificationMiniBarPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    backgroundColor: "#1a3250",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  gamificationMiniBarPillText: {
    color: "#dcefff",
    fontSize: 12,
    fontWeight: "800",
  },
  gamificationQuestCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#34516f",
    backgroundColor: "#14243b",
    padding: 20,
    gap: 12,
  },
  gamificationQuestList: {
    gap: 10,
  },
  gamificationQuestItem: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#334860",
    backgroundColor: "#102238",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  gamificationQuestTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  gamificationQuestLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  gamificationQuestLabel: {
    color: "#f5f7fb",
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
  },
  gamificationQuestXp: {
    color: "#f8c15c",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  gamificationQuestMeta: {
    color: "#9cb0c9",
    fontSize: 12,
    fontWeight: "600",
  },
  gamificationBadgeSection: {
    gap: 10,
    paddingTop: 2,
  },
  gamificationBadgeWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  gamificationBadgeChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  gamificationBadgeChipUnlocked: {
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  gamificationBadgeChipLocked: {
    borderColor: "#334860",
    backgroundColor: "#102238",
  },
  gamificationBadgeChipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  gamificationBadgeChipTextUnlocked: {
    color: "#f5f7fb",
  },
  gamificationBadgeChipTextLocked: {
    color: "#6f88a8",
  },
  celebrationToast: {
    position: "absolute",
    top: 60,
    left: 16,
    right: 16,
    zIndex: 100,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#355b82",
    backgroundColor: "#18314d",
    padding: 16,
    gap: 6,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  celebrationToastContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  celebrationToastCopy: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  celebrationToastTitle: {
    color: "#f5f7fb",
    fontSize: 14,
    fontWeight: "800",
    flex: 1,
  },
  celebrationToastBody: {
    color: "#9cb0c9",
    fontSize: 12,
    fontWeight: "600",
    paddingLeft: 24,
  },
  milestoneToastActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingLeft: 24,
    paddingTop: 4,
  },
  milestoneToastPrimaryBtn: {
    borderRadius: 999,
    backgroundColor: "#dbe9ff",
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  milestoneToastPrimaryBtnText: {
    color: "#10233a",
    fontSize: 12,
    fontWeight: "800",
  },
  milestoneToastLaterText: {
    color: "#6f88a8",
    fontSize: 12,
    fontWeight: "700",
  },
  journeyInsightsBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#27405f",
    backgroundColor: "#14243b",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  journeyInsightsBarPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    backgroundColor: "#1a3250",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  journeyInsightsBarValue: {
    color: "#84cc16",
    fontSize: 13,
    fontWeight: "900",
  },
  journeyInsightsBarText: {
    color: "#dcefff",
    fontSize: 12,
    fontWeight: "800",
  },
  journeyInsightsBarReview: {
    marginLeft: "auto",
    borderRadius: 999,
    backgroundColor: "#3d2a1a",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  journeyInsightsBarReviewText: {
    color: "#f8d48a",
    fontSize: 12,
    fontWeight: "800",
  },
  celebrationParticle: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  carousel: {
    gap: 12,
    paddingRight: 12,
  },
  heroCard: {
    width: 286,
    height: 344,
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: "#122238",
    borderWidth: 1,
    borderColor: "#24405f",
  },
  heroCardImage: {
    ...StyleSheet.absoluteFillObject,
  },
  heroCardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(5, 14, 27, 0.42)",
  },
  heroCardContent: {
    flex: 1,
    justifyContent: "flex-end",
    gap: 6,
    padding: 18,
  },
  heroCardBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "rgba(11, 28, 49, 0.78)",
    color: "#f8c15c",
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: "800",
    overflow: "hidden",
  },
  heroCardTitle: {
    color: "#ffffff",
    fontSize: 23,
    fontWeight: "800",
    lineHeight: 26,
  },
  heroCardSubtitle: {
    color: "#e2ebf9",
    fontSize: 14,
    fontWeight: "700",
  },
  heroCardMeta: {
    color: "#c7d6ea",
    fontSize: 13,
    lineHeight: 18,
  },
  heroCardButton: {
    alignSelf: "flex-start",
    marginTop: 4,
    borderRadius: 999,
    backgroundColor: "#f8c15c",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  heroCardButtonText: {
    color: "#14243b",
    fontSize: 13,
    fontWeight: "800",
  },
  featureCard: {
    backgroundColor: "#14243b",
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#27405f",
  },
  featureCardImage: {
    width: "100%",
    aspectRatio: 16 / 10,
    backgroundColor: "#0f1f34",
  },
  featureCardBody: {
    gap: 6,
    padding: 18,
  },
  featureCardLabel: {
    color: "#f8c15c",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  featureCardTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 25,
  },
  featureCardSubtitle: {
    color: "#dbe9ff",
    fontSize: 14,
    fontWeight: "700",
  },
  featureCardMeta: {
    color: "#aebcd3",
    fontSize: 13,
    lineHeight: 19,
  },
  featureMetaPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  featureMetaPill: {
    color: "#dbe9ff",
    backgroundColor: "#203754",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: "700",
    overflow: "hidden",
  },
  bookHomeCard: {
    width: 300,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#27405f",
    backgroundColor: "#14243b",
  },
  bookHomeCardImage: {
    width: "100%",
    height: 180,
    backgroundColor: "#0f1f34",
  },
  bookHomeCardBody: {
    gap: 6,
    padding: 16,
  },
  bookHomeCardTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 24,
  },
  bookHomeCardSubtitle: {
    color: "#f8c15c",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  bookHomeCardMeta: {
    color: "#aebcd3",
    fontSize: 13,
    lineHeight: 18,
  },
  bookHomeCardProgress: {
    color: "#8fc7ff",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
  },
  emptyCard: {
    backgroundColor: "#14243b",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#27405f",
    padding: 18,
    gap: 8,
  },
  emptyTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
  },
  bookCard: {
    position: "relative",
    gap: 8,
    overflow: "hidden",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#27405f",
    backgroundColor: "#14243b",
    minHeight: 460,
  },
  bookCover: {
    ...StyleSheet.absoluteFillObject,
  },
  bookOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(8, 19, 36, 0.72)",
  },
  bookBody: {
    gap: 10,
    padding: 18,
  },
  bookBadgeRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  bookBadge: {
    color: "#dbe9ff",
    backgroundColor: "rgba(15, 31, 52, 0.8)",
    borderWidth: 1,
    borderColor: "#315174",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: "700",
    overflow: "hidden",
  },
  bookTitleCard: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "700",
  },
  bookSubtitle: {
    color: "#f8c15c",
    fontSize: 14,
    fontWeight: "600",
  },
  bookDescription: {
    color: "#d6dfec",
    fontSize: 15,
    lineHeight: 22,
  },
  bookActionsRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  inlineButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#203754",
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 4,
  },
  ghostButton: {
    backgroundColor: "#223b5a",
  },
  disabledActionButton: {
    opacity: 0.55,
  },
  onboardingModal: {
    marginHorizontal: 20,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#31537c",
    backgroundColor: "#142844",
    padding: 20,
    gap: 18,
    shadowColor: "#020817",
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 14 },
    elevation: 18,
  },
  onboardingProgressRow: {
    flexDirection: "row",
    gap: 8,
  },
  onboardingProgressSegment: {
    flex: 1,
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  onboardingProgressSegmentActive: {
    backgroundColor: "#f8c15c",
  },
  onboardingHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  onboardingHeaderCopy: {
    flex: 1,
    gap: 6,
  },
  onboardingSlideCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 16,
  },
  onboardingStepPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  onboardingStepPillText: {
    color: "#dbe9ff",
    fontSize: 12,
    fontWeight: "800",
  },
  onboardingOptionsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  onboardingActionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  onboardingSecondaryActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  onboardingTourTargetBadge: {
    alignSelf: "flex-start",
    marginTop: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#456790",
    backgroundColor: "#1a3556",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  onboardingTourTargetBadgeText: {
    color: "#dcefff",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  primaryButton: {
    backgroundColor: "#f8c15c",
  },
  primaryButtonText: {
    color: "#14243b",
  },
  inlineButtonText: {
    color: "#dbe9ff",
    fontSize: 13,
    fontWeight: "700",
  },
  secondaryButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#35506f",
    backgroundColor: "#142a44",
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  secondaryButtonText: {
    color: "#dbe9ff",
    fontSize: 13,
    fontWeight: "800",
  },
  readerWrapper: {
    flex: 1,
  },
  storyCompletionOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(5, 14, 26, 0.82)",
    justifyContent: "flex-end",
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  storyCompletionCard: {
    backgroundColor: "#14243b",
    borderRadius: 24,
    padding: 24,
    gap: 14,
    borderWidth: 1,
    borderColor: "#27405f",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
  },
  storyCompletionTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "800",
  },
  storyCompletionBody: {
    color: "#aebcd3",
    fontSize: 15,
    lineHeight: 22,
  },
  storyList: {
    gap: 12,
    paddingTop: 6,
  },
  storyRow: {
    backgroundColor: "#0f1b2e",
    borderRadius: 20,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: "#213955",
  },
  storyMain: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  storyThumb: {
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: "#23344f",
  },
  storyBody: {
    flex: 1,
    gap: 4,
  },
  storyActionsInline: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  storyAction: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#203754",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  storyActionText: {
    color: "#dbe9ff",
    fontSize: 12,
    fontWeight: "700",
  },
  storyTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  storyMeta: {
    color: "#aebcd3",
    fontSize: 13,
    lineHeight: 18,
  },
  favoriteCard: {
    backgroundColor: "#14243b",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#27405f",
    padding: 12,
    gap: 3,
  },
  favoriteHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  favoriteWordRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  favoriteIdentity: {
    flex: 1,
    gap: 2,
  },
  favoriteWord: {
    color: "#fff6d7",
    fontSize: 20,
    fontWeight: "800",
  },
  favoriteDefinition: {
    color: "#eef4ff",
    fontSize: 12,
    lineHeight: 16,
  },
  favoriteMeta: {
    color: "#9cb0c9",
    fontSize: 11,
    lineHeight: 14,
  },
  favoriteTypeChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#35506f",
    backgroundColor: "#1a2f48",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  favoriteTypeChipDue: {
    borderColor: "#5c7e46",
    backgroundColor: "#2d4123",
  },
  favoriteTypeChipText: {
    color: "#dbe9ff",
    fontSize: 11,
    fontWeight: "700",
  },
  favoriteRemove: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#213754",
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  favoriteRemoveText: {
    color: "#dbe9ff",
    fontSize: 12,
    fontWeight: "700",
  },
  favoriteOpenButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#f8c15c",
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  favoriteOpenButtonText: {
    color: "#14243b",
    fontSize: 13,
    fontWeight: "800",
  },
  favoriteMiniCard: {
    backgroundColor: "#14243b",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#27405f",
    padding: 16,
    gap: 4,
  },
  favoriteMiniWord: {
    color: "#fff6d7",
    fontSize: 18,
    fontWeight: "800",
  },
  favoriteMiniDefinition: {
    color: "#dbe9ff",
    fontSize: 14,
    lineHeight: 20,
  },
  favoritesCompactBar: {
    gap: 10,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#27405f",
    backgroundColor: "#14243b",
    padding: 12,
  },
  favoritesCompactStats: {
    flexDirection: "row",
    gap: 8,
  },
  favoritesCompactPill: {
    borderRadius: 999,
    backgroundColor: "#1a3250",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  favoritesCompactPillText: {
    color: "#dcefff",
    fontSize: 12,
    fontWeight: "800",
  },
  favoritesCompactDueText: {
    color: "#f8d48a",
    fontSize: 12,
    fontWeight: "800",
  },
  favoritesCompactActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  favoritesModePills: {
    gap: 6,
  },
  favoritesModePill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#35506f",
    backgroundColor: "#1a2f48",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  favoritesModePillActive: {
    borderColor: "#5b92ff",
    backgroundColor: "#274b74",
  },
  favoritesModePillText: {
    color: "#dbe9ff",
    fontSize: 12,
    fontWeight: "700",
  },
  favoritesModePillTextActive: {
    color: "#ffffff",
  },
  favoriteFilterChips: {
    gap: 6,
  },
  practiceFocusBanner: {
    gap: 10,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#6b5930",
    backgroundColor: "#18304d",
    padding: 20,
  },
  practiceFocusPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    backgroundColor: "rgba(248, 212, 138, 0.12)",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  practiceFocusPillText: {
    color: "#f8d48a",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  practiceFocusTitle: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 28,
  },
  practiceFocusText: {
    color: "#d6dfec",
    fontSize: 15,
    lineHeight: 22,
  },
  practiceGridShell: {
    flex: 1,
    justifyContent: "center",
    paddingTop: 2,
    paddingBottom: 2,
  },
  practiceErrorCard: {
    marginBottom: 8,
  },
  practiceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    rowGap: 8,
    columnGap: 8,
    alignContent: "center",
  },
  practiceModeCard: {
    width: "48%",
    minHeight: 174,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 14,
    gap: 8,
    overflow: "hidden",
  },
  practiceModeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  practiceModeHeaderText: {
    flex: 1,
    gap: 1,
  },
  practiceModeEyebrow: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 1,
  },
  practiceModeTitle: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "900",
    lineHeight: 19,
  },
  practiceModeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  practiceRecommendedBadge: {
    borderRadius: 999,
    backgroundColor: "rgba(248, 212, 138, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(248, 212, 138, 0.22)",
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  practiceRecommendedText: {
    color: "#f8d48a",
    fontSize: 7,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  practiceModeDetail: {
    color: "#ffffff",
    fontSize: 11,
    lineHeight: 14,
  },
  practiceModeBody: {
    gap: 1,
    minHeight: 34,
  },
  practiceModeFooter: {
    alignItems: "center",
    gap: 10,
    marginTop: "auto",
  },
  practiceModeFooterMeta: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexWrap: "wrap",
  },
  practiceModeMetaPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  practiceModeMetaText: {
    color: "rgba(236,242,252,0.88)",
    fontSize: 8,
    fontWeight: "700",
  },
  practiceModeAction: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#f8d48a",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  practiceModeActionText: {
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  practiceModeActionCentered: {
    alignSelf: "center",
    borderRadius: 999,
    backgroundColor: "#f8d48a",
    paddingHorizontal: 22,
    paddingVertical: 8,
  },
  practiceModeActionTextLarge: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  practiceSessionShell: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 22,
  },
  practiceSessionCard: {
    flex: 1,
    borderRadius: 32,
    borderWidth: 1,
    overflow: "hidden",
    padding: 16,
    gap: 12,
  },
  practiceSessionGlow: {
    position: "absolute",
    top: -40,
    right: -50,
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  practiceSessionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  practiceSessionClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(6,16,28,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  practiceSessionTitleWrap: {
    flex: 1,
    gap: 2,
  },
  practiceSessionEyebrow: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  practiceSessionTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 24,
  },
  practiceSessionIconWrap: {
    flexShrink: 0,
  },
  practiceSessionMeta: {
    gap: 4,
  },
  practiceSessionProgressWrap: {
    gap: 4,
  },
  practiceSessionProgressLabel: {
    color: "#dbe9ff",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  practiceSessionProgressTrack: {
    height: 7,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  practiceSessionProgressBar: {
    height: "100%",
    borderRadius: 999,
  },
  practiceSessionHelper: {
    color: "rgba(226,232,244,0.8)",
    fontSize: 11,
    lineHeight: 14,
  },
  practiceSessionStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 4,
  },
  practiceSessionStatusPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  practiceSessionStatusPillCorrect: {
    borderColor: "rgba(114, 242, 179, 0.45)",
    backgroundColor: "rgba(114, 242, 179, 0.14)",
  },
  practiceSessionStatusPillWrong: {
    borderColor: "rgba(255, 145, 145, 0.45)",
    backgroundColor: "rgba(255, 145, 145, 0.14)",
  },
  practiceSessionStatusText: {
    color: "rgba(226,232,244,0.82)",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  practiceSessionStatusTextActive: {
    color: "#f5f7fb",
  },
  practiceRecoveryCard: {
    gap: 8,
    marginTop: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 170, 170, 0.18)",
    backgroundColor: "rgba(255, 145, 145, 0.10)",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  practiceRecoveryTitle: {
    color: "#ffe8e8",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  practiceRecoveryBody: {
    color: "rgba(255,245,245,0.9)",
    fontSize: 13,
    lineHeight: 18,
  },
  practiceRecoveryHint: {
    color: "rgba(255,235,235,0.82)",
    fontSize: 12,
    lineHeight: 17,
  },
  practiceRecoveryWords: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  practiceRecoveryWordChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  practiceRecoveryWordText: {
    color: "#fff5f5",
    fontSize: 11,
    fontWeight: "800",
  },
  practiceExerciseScroll: {
    flex: 1,
  },
  practiceExerciseScrollContent: {
    flexGrow: 1,
    paddingBottom: 72,
  },
  practiceQuestionCard: {
    borderRadius: 28,
    backgroundColor: "rgba(7,18,31,0.36)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 12,
    gap: 10,
  },
  practicePrompt: {
    color: "rgba(226,232,244,0.84)",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 15,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  practiceTargetWrap: {
    gap: 4,
    paddingBottom: 2,
  },
  practiceTargetLabel: {
    color: "rgba(255,255,255,0.56)",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  practiceTargetWord: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "900",
    lineHeight: 31,
    letterSpacing: -0.4,
  },
  practiceSentence: {
    color: "rgba(226,232,244,0.8)",
    fontSize: 12,
    lineHeight: 17,
  },
  practiceListenButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  practiceListenButtonDisabled: {
    borderColor: "#334a66",
    backgroundColor: "#162638",
  },
  practiceListenButtonText: {
    color: "#f5f7fb",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  practiceListenButtonTextDisabled: {
    color: "#8ea2bc",
  },
  practiceRelatedFavoriteButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(248,193,92,0.35)",
    backgroundColor: "rgba(248,193,92,0.14)",
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  practiceRelatedFavoriteButtonText: {
    color: "#f8c15c",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  practiceOptions: {
    gap: 6,
  },
  practiceOption: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  practiceOptionSelected: {
    borderColor: "#67b5ff",
    backgroundColor: "rgba(103,181,255,0.14)",
  },
  practiceOptionCorrect: {
    borderColor: "#6ee7b7",
    backgroundColor: "#6ee7b7",
  },
  practiceOptionWrong: {
    borderColor: "#fb7185",
    backgroundColor: "#fb7185",
  },
  practiceOptionText: {
    color: "#f5f7fb",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 16,
  },
  practiceOptionTextOnAccent: {
    color: "#0a1424",
  },
  practiceMatchColumns: {
    flexDirection: "row",
    gap: 6,
  },
  practiceMatchColumn: {
    flex: 1,
    gap: 6,
  },
  practiceMatchLabel: {
    color: "rgba(255,255,255,0.58)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  practiceMatchChip: {
    minHeight: 44,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  practiceMatchChipActive: {
    borderColor: "#67b5ff",
    backgroundColor: "rgba(103,181,255,0.14)",
  },
  practiceMatchChipCorrect: {
    borderColor: "#6ee7b7",
    backgroundColor: "#6ee7b7",
  },
  practiceMatchChipText: {
    color: "#f5f7fb",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  practiceMatchMeaning: {
    minHeight: 44,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  practiceMatchMeaningText: {
    color: "#f5f7fb",
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 14,
    textAlign: "center",
  },
  practiceFooter: {
    alignItems: "stretch",
    paddingTop: 8,
  },
  practiceFooterButton: {
    alignSelf: "stretch",
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  practiceFooterHint: {
    color: "rgba(226,232,244,0.74)",
    fontSize: 11,
    lineHeight: 14,
    textAlign: "center",
    paddingVertical: 16,
  },
  practiceScorePill: {
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  practiceScorePillText: {
    color: "#f5f7fb",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  practiceResultCard: {
    flex: 1,
    justifyContent: "center",
    gap: 16,
  },
  practiceResultScore: {
    color: "#ffffff",
    fontSize: 54,
    fontWeight: "900",
    lineHeight: 58,
  },
  practiceResultText: {
    color: "rgba(226,232,244,0.82)",
    fontSize: 17,
    lineHeight: 25,
  },
  practiceResultStatusText: {
    color: "#b8c9df",
    fontSize: 13,
    lineHeight: 19,
  },
  practiceResultActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  createFeatureGrid: {
    gap: 10,
  },
  createAccordion: {
    gap: 8,
  },
  createSectionCard: {
    gap: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#29435f",
    backgroundColor: "#0f1f34",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  createSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  createSectionHeaderText: {
    flex: 1,
    gap: 4,
  },
  createSectionLabel: {
    color: "#92a8c3",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  createSectionValue: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 20,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(2, 8, 18, 0.62)",
    justifyContent: "center",
  },
  readerIconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: "#315174",
    backgroundColor: "#17304d",
    alignItems: "center",
    justifyContent: "center",
  },
  createPickerModal: {
    marginHorizontal: 20,
    marginVertical: 100,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#29435f",
    backgroundColor: "#102238",
    padding: 16,
    gap: 14,
  },
  createPickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  createPickerOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  createFeatureCard: {
    borderRadius: 20,
    backgroundColor: "#0f1f34",
    borderWidth: 1,
    borderColor: "#29435f",
    padding: 14,
    gap: 6,
  },
  createFeatureTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  createFeatureText: {
    color: "#c3d0e2",
    fontSize: 14,
    lineHeight: 20,
  },
  settingsBillingCard: {
    gap: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#29435f",
    backgroundColor: "#102238",
    padding: 16,
  },
  settingsBillingHeader: {
    gap: 8,
  },
  settingsBillingCopy: {
    gap: 6,
  },
  settingsBillingButton: {
    alignSelf: "stretch",
    marginTop: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  bookDetailContainer: {
    gap: 20,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 128,
  },
  bookDetailTopBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  bookDetailHero: {
    gap: 18,
  },
  bookDetailCover: {
    width: "100%",
    height: 320,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#28415f",
    backgroundColor: "#132238",
  },
  bookDetailBody: {
    gap: 10,
  },
  bookDetailPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  bookDetailPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#3d5470",
    paddingHorizontal: 11,
    paddingVertical: 5,
    backgroundColor: "rgba(21, 37, 58, 0.55)",
  },
  bookDetailPillActive: {
    borderColor: "#9f7f35",
    backgroundColor: "rgba(157, 124, 44, 0.22)",
  },
  bookDetailPillText: {
    color: "#d7e2f1",
    fontSize: 11,
    fontWeight: "700",
  },
  bookDetailPillTextActive: {
    color: "#f4d58e",
  },
  bookDetailTitle: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "800",
    lineHeight: 34,
  },
  bookDetailSubtitle: {
    color: "#dbe9ff",
    fontSize: 18,
    lineHeight: 24,
  },
  bookDetailMeta: {
    color: "#dbe9ff",
    fontSize: 14,
    fontWeight: "700",
  },
  bookDetailDescription: {
    color: "#9cb0c9",
    fontSize: 15,
    lineHeight: 23,
  },
  bookDetailDescriptionToggle: {
    alignSelf: "flex-start",
    marginTop: -2,
  },
  bookDetailDescriptionToggleText: {
    color: "#f8c15c",
    fontSize: 13,
    fontWeight: "700",
  },
  bookDetailStoryList: {
    gap: 12,
  },
  bookStoryControls: {
    gap: 10,
  },
  bookStoryControlRow: {
    flexDirection: "row",
    gap: 10,
  },
  bookStoryControlButton: {
    flex: 1,
    gap: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#29435f",
    backgroundColor: "#102238",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bookStoryControlLabel: {
    color: "#92a8c3",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  bookStoryControlValue: {
    color: "#f5f7fb",
    fontSize: 13,
    fontWeight: "600",
  },
  bookStoryShowingText: {
    color: "#9cb0c9",
    fontSize: 12,
    fontWeight: "500",
  },
  bookStoryListCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 12,
  },
  bookStoryListCover: {
    width: 72,
    height: 96,
    borderRadius: 14,
    backgroundColor: "#17304b",
  },
  bookStoryListBody: {
    flex: 1,
    gap: 4,
  },
  bookStoryListTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 24,
  },
  bookStoryListSubtitle: {
    color: "#f1c35d",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
  bookStoryListMeta: {
    color: "#9cb0c9",
    fontSize: 13,
    lineHeight: 18,
  },
  bookDetailStatsGrid: {
    flexDirection: "row",
    gap: 10,
  },
  bookDetailStatCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 12,
    gap: 4,
  },
  bookDetailStatLabel: {
    color: "#9cb0c9",
    fontSize: 11,
    fontWeight: "700",
  },
  bookDetailStatValue: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
  },
  bookDetailActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  bookContinueCard: {
    gap: 6,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.25)",
    backgroundColor: "rgba(56,189,248,0.12)",
    padding: 14,
  },
  bookContinueEyebrow: {
    color: "#8fdcff",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  bookContinueTitle: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "800",
  },
  bookContinueMeta: {
    color: "#d2e9f7",
    fontSize: 13,
    lineHeight: 18,
  },
  bookDetailTabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingTop: 2,
  },
  bookDetailTab: {
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  bookDetailTabActive: {
    backgroundColor: "#2563eb",
  },
  bookDetailTabText: {
    color: "#dbe9ff",
    fontSize: 13,
    fontWeight: "700",
  },
  bookDetailTabTextActive: {
    color: "#ffffff",
  },
  bookPanelCard: {
    gap: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 16,
  },
  bookVocabWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  bookReviewGrid: {
    gap: 10,
  },
  bookReviewCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 16,
  },
  bookReviewText: {
    color: "#eef4ff",
    fontSize: 14,
    lineHeight: 20,
  },
  settingsPreferenceCard: {
    gap: 10,
    marginTop: 12,
  },
  settingsActionGrid: {
    gap: 8,
    marginTop: 12,
  },
  settingsLegalStack: {
    gap: 12,
  },
  settingsLegalCard: {
    gap: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#29435f",
    backgroundColor: "#102238",
    padding: 14,
  },
  settingsLegalBody: {
    color: "#aebcd3",
    fontSize: 14,
    lineHeight: 21,
  },
  settingsLegalActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  settingsActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#29435f",
    backgroundColor: "#0f1f34",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  settingsActionCopy: {
    flex: 1,
    gap: 2,
  },
  settingsActionTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
  settingsActionText: {
    color: "#c3d0e2",
    fontSize: 13,
    lineHeight: 19,
  },
  progressHeroCard: {
    gap: 10,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "#26425f",
    backgroundColor: "#16304f",
    padding: 16,
  },
  progressHeroMain: {
    gap: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#34516f",
    backgroundColor: "#274b74",
    padding: 14,
  },
  progressHeroValue: {
    color: "#ffffff",
    fontSize: 48,
    fontWeight: "900",
    lineHeight: 50,
  },
  progressHeroLabel: {
    color: "#dbe9ff",
    fontSize: 15,
    fontWeight: "700",
  },
  progressHeroText: {
    color: "#d6dfec",
    fontSize: 13,
    lineHeight: 18,
  },
  progressGoalCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#34516f",
    backgroundColor: "#18314d",
    padding: 14,
    gap: 8,
  },
  progressGoalTitle: {
    color: "#dbe9ff",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  progressGoalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  progressGoalTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "#314861",
    overflow: "hidden",
  },
  progressGoalFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#71dd5a",
  },
  progressGoalMeta: {
    color: "#c3d0e2",
    fontSize: 13,
    lineHeight: 18,
  },
  progressGoalSubmeta: {
    color: "#9cb0c9",
    fontSize: 12,
    lineHeight: 17,
  },
  progressMiniGrid: {
    flexDirection: "row",
    gap: 10,
  },
  librarySwitcherStack: {
    gap: 8,
    paddingBottom: 2,
  },
  librarySnapshotCard: {
    gap: 8,
  },
  librarySnapshotHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  libraryMiniActions: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  libraryMiniActionPrimary: {
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  libraryMiniActionGhost: {
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  librarySwitcherRow: {
    flexDirection: "row",
    gap: 8,
  },
  libraryPanelTab: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#35506f",
    backgroundColor: "#14243b",
    paddingHorizontal: 10,
    paddingVertical: 9,
    alignItems: "center",
  },
  libraryPanelTabActive: {
    borderColor: "#5b92ff",
    backgroundColor: "#274b74",
  },
  libraryPanelTabText: {
    color: "#dbe9ff",
    fontSize: 12,
    fontWeight: "700",
  },
  libraryPanelTabTextActive: {
    color: "#ffffff",
  },
  progressMiniCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#34516f",
    backgroundColor: "#18314d",
    padding: 12,
    gap: 4,
  },
  progressMiniEyebrow: {
    color: "#9cb0c9",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  progressMiniValue: {
    color: "#ffffff",
    fontSize: 26,
    fontWeight: "900",
  },
  progressMiniText: {
    color: "#c3d0e2",
    fontSize: 12,
    lineHeight: 17,
  },
  libraryInlineLink: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
  },
  libraryInlineLinkText: {
    color: "#dbe9ff",
    fontSize: 13,
    fontWeight: "700",
  },
  progressStatsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  progressStatCard: {
    width: "48%",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#27405f",
    backgroundColor: "#14243b",
    padding: 12,
    gap: 6,
  },
  progressStatLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  progressStatLabel: {
    color: "#9cb0c9",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  progressStatValue: {
    color: "#ffffff",
    fontSize: 32,
    fontWeight: "900",
  },
  bottomNav: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    gap: 0,
    backgroundColor: "rgba(10, 22, 38, 0.98)",
    borderTopWidth: 1,
    borderTopColor: "#27405f",
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 14,
  },
  bottomTab: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  bottomTabActive: {
    backgroundColor: "rgba(31, 79, 134, 0.28)",
  },
  bottomTabTourHighlight: {
    borderWidth: 1,
    borderColor: "#f8c15c",
    backgroundColor: "rgba(248, 193, 92, 0.12)",
  },
  bottomTabText: {
    color: "#9cb0c9",
    fontSize: 11,
    fontWeight: "700",
  },
  bottomTabTextTourHighlight: {
    color: "#fff5d6",
  },
  bottomTabTextActive: {
    color: "#ffffff",
  },
  bottomTabIcon: {
    minHeight: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: "rgba(3, 10, 18, 0.45)",
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  menuDismissZone: {
    flex: 1,
  },
  menuPanel: {
    width: 292,
    backgroundColor: "#0d1b2e",
    borderLeftWidth: 1,
    borderLeftColor: "#27405f",
    paddingTop: 56,
    paddingHorizontal: 22,
    paddingBottom: 28,
  },
  menuPanelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  menuTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "800",
  },
  menuClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#203754",
    alignItems: "center",
    justifyContent: "center",
  },
  menuContent: {
    gap: 10,
  },
  menuLink: {
    borderRadius: 14,
    paddingHorizontal: 0,
    paddingVertical: 10,
  },
  menuLinkCompact: {
    paddingVertical: 6,
  },
  menuLinkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  menuLinkIconWrap: {
    width: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  menuLinkText: {
    color: "#dbe9ff",
    fontSize: 15,
    fontWeight: "700",
    flex: 1,
  },
  menuLinkTextAccent: {
    color: "#f8d48a",
  },
  menuChevron: {
    marginLeft: "auto",
  },
  menuLegalBlock: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#27405f",
    paddingTop: 14,
    gap: 10,
  },
  menuLegalTitle: {
    color: "#8da6c6",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  menuLegalLinks: {
    gap: 4,
  },
  feedbackButton: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#27405f",
    backgroundColor: "#14243b",
  },
  feedbackButtonText: {
    color: "#dbe9ff",
    fontSize: 15,
    fontWeight: "700",
  },
});
