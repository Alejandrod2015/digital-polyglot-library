import { Children, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as SecureStore from "expo-secure-store";
import * as Haptics from "expo-haptics";
import { Audio, InterruptionModeIOS, type AVPlaybackStatus } from "expo-av";
import {
  Alert,
  Animated,
  AppState,
  Easing,
  findNodeHandle,
  Linking,
  Modal,
  PanResponder,
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
  formatLanguageAndRegion,
  formatLanguageCode,
  formatLevel,
  formatRegion,
  formatTopic,
  formatVariant,
  formatVariantLabel,
  VARIANT_LABELS,
  VARIANT_OPTIONS_BY_LANGUAGE,
  type AudioWordTimingsPayload,
  type Book,
  type Level,
  type Story,
  type VocabItem,
} from "@digital-polyglot/domain";
import { requireOptionalNativeModule } from "expo-modules-core";
import { ReaderScreen } from "./ReaderScreen";
import { getCoverUrl } from "./coverUrl";
import { NextActionGlow } from "./NextActionGlow";
import { PracticeOrbit, type PracticeModeKey as OrbitModeKey } from "./PracticeOrbit";
import { PulseDots } from "./PulseDots";
import { HomeSkeleton } from "./HomeSkeleton";
import { LanguageFlag } from "./LanguageFlag";
import { JourneysPanel } from "./JourneysPanel";
import { LegalSheet } from "./LegalSheet";
import { LevelTestRunner } from "./LevelTestRunner";
import { hasLevelTest } from "./levelTest";
import { ExtendedSplash } from "./ExtendedSplash";
import { TopicPreviewSheet } from "./TopicPreviewSheet";
import {
  type Journey,
  areJourneysEqual,
  dedupeJourneysById,
  findActiveJourney,
  cefrFromCoarseLevel,
  focusShortLabel,
  journeyDisplayName,
  journeyFlagVariant,
  journeyId,
  languageShortCode,
  synthesizeJourneysFromLegacy,
  targetLanguagesFromJourneys,
} from "./journeys";
import {
  clearStoredJourneys,
  loadStoredJourneys,
  saveStoredJourneys,
} from "./journeyStorage";
import { LanguageSwitchSheet, type LanguageSwitchEntry } from "./LanguageSwitchSheet";
import { OnboardingFlow, type OnboardingPayload } from "./OnboardingFlow";
import { PracticeCelebration } from "./PracticeCelebration";
import { PracticeExitSheet } from "./PracticeExitSheet";
import { PracticeCountdown } from "./PracticeCountdown";
import { ReaderSkeleton } from "./ReaderSkeleton";
import { useOfflineStatus } from "../lib/useOfflineStatus";
import { bg as tokenBg, color as tokenColor } from "../theme/tokens";
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
  clearJourneyCache,
  loadJourneyCache,
  loadOfflineSnapshot,
  removeStoryOffline,
  saveJourneyCache,
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
import { JOURNEY_MILESTONE_CHIME_URI } from "../../../../src/lib/journeyMilestone";
import {
  PRACTICE_CORRECT_SOUND_URI,
  PRACTICE_PERFECT_CHIME_URI,
  PRACTICE_WRONG_SOUND_URI,
} from "../lib/practiceSoundUris";

type ReaderSelection = {
  book: Book;
  story: Story;
  resolvedAudioUrl?: string | null;
  // Local cover URI to try before falling back to story.cover. Set when we
  // have a downloaded copy on disk. The reader swaps to story.cover if this
  // errors (truncated / missing file).
  resolvedCoverUrl?: string | null;
};

type MobileScreen =
  | "home"
  | "explore"
  | "practice"
  | "favorites"
  | "journey"
  | "library"
  | "settings"
  | "create";

type BottomTab = "home" | "explore" | "practice" | "favorites" | "journey" | "signin";
type MenuIconName =
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
      voice?: string;
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
      voice?: string;
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
        voice: options?.voice,
      });
    },
  };
}

// Cached "best voice" lookup. iOS exposes "Default", "Enhanced" and
// "Premium" voice variants — premium being the natural-sounding
// neural ones. We pick the highest-quality match per language code so
// practice prompts no longer use the bare robotic default voice.
//
// `getAvailableVoicesAsync` is async and slightly expensive on the
// first call (it queries CoreTextToSpeech), so we memoize the result
// in module-scope. The map is populated once per app launch.
type CachedVoiceEntry = { identifier: string; quality: "Enhanced" | "Default" };
const bestVoiceByLangCache: Map<string, CachedVoiceEntry> = new Map();
let bestVoicesPromise: Promise<unknown> | null = null;
async function ensureBestVoicesLoaded(): Promise<void> {
  if (bestVoicesPromise) {
    await bestVoicesPromise;
    return;
  }
  bestVoicesPromise = (async () => {
    try {
      const expoSpeech = await import("expo-speech");
      const voices = await expoSpeech.getAvailableVoicesAsync();
      // Group by base language code (the part before any "-" region
      // suffix), then pick the highest-quality voice in that group.
      const groups = new Map<string, typeof voices>();
      for (const voice of voices) {
        const langCode = (voice.language ?? "").toLowerCase();
        if (!langCode) continue;
        const existing = groups.get(langCode) ?? [];
        existing.push(voice);
        groups.set(langCode, existing);
      }
      groups.forEach((groupVoices, langCode) => {
        // Enhanced > Default. Premium is iOS-internal but expo-speech
        // only surfaces Default | Enhanced; the OS still uses Premium
        // when available because it's the user's selected variant.
        const ranked = [...groupVoices].sort((a, b) => {
          const score = (q: string | null | undefined) =>
            q === "Enhanced" ? 2 : q === "Default" ? 1 : 0;
          return score(b.quality as string) - score(a.quality as string);
        });
        const best = ranked[0];
        if (best) {
          const quality: CachedVoiceEntry["quality"] =
            (best.quality as string) === "Enhanced" ? "Enhanced" : "Default";
          bestVoiceByLangCache.set(langCode, {
            identifier: best.identifier,
            quality,
          });
        }
      });
    } catch {
      // expo-speech missing or query failed → silently fall back to
      // the default voice on every speak() call.
    }
  })();
  await bestVoicesPromise;
}
function getBestVoiceFor(language: string | null | undefined): string | undefined {
  if (!language) return undefined;
  const key = language.trim().toLowerCase();
  if (!key) return undefined;
  // Try exact match first ("it-it"), then the base ("it").
  const exact = bestVoiceByLangCache.get(key);
  if (exact) return exact.identifier;
  const base = key.split("-")[0];
  if (base && base !== key) {
    const baseHit = bestVoiceByLangCache.get(base);
    if (baseHit) return baseHit.identifier;
    // Try any "<base>-..." variant.
    for (const [cachedKey, voice] of bestVoiceByLangCache.entries()) {
      if (voice && cachedKey.startsWith(`${base}-`)) return voice.identifier;
    }
  }
  return undefined;
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
  /** Multi-journey model: a user can have several (language, focus)
   *  journeys at once. The legacy fields above (preferredVariant,
   *  preferredLevel, journeyFocus, targetLanguages[0]) keep working
   *  as projections of the *active* journey for backward compat with
   *  call sites that haven't migrated yet. */
  journeys: Journey[];
  activeJourneyId: string | null;
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
  vocabRaw?: string | null;
  language?: string | null;
  variant?: string | null;
  region?: string | null;
  level?: string | null;
  cefrLevel?: string | null;
  topic?: string | null;
  // Remote (http/https) URLs — always safe as a fallback when online.
  coverUrl?: string | null;
  audioUrl?: string | null;
  // Local (file://) URIs — preferred when available because they work
  // offline and skip the network. Callers that construct a standalone from
  // the offline snapshot populate both pairs so the reader can try local
  // first and fall back to remote automatically if the local file is
  // missing / corrupt.
  localCoverUri?: string | null;
  localAudioUri?: string | null;
};

function parseStandaloneVocab(raw?: string | null): VocabItem[] {
  if (!raw || typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (v): v is VocabItem =>
        v && typeof v === "object" && typeof v.word === "string" && typeof v.definition === "string"
    );
  } catch {
    return [];
  }
}

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
    /** Audio listened to completion (>= 95% scrubbed). The story
     *  is "read" but the topic's exercises may still be pending. */
    audioFinished: boolean;
    /** Audio finished AND the topic's checkpoint is passed. This
     *  is what earns the green check — the bar for full mastery. */
    completed: boolean;
    /** Story belongs to a level below the user's placement test
     *  result. Stays unlocked and re-readable, but counted as
     *  "passed" for the purposes of the "next" pointer (so it
     *  jumps to the placement level). Doesn't show a green check —
     *  the user didn't actually read it. */
    skipped: boolean;
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

// Each practice mode owns a different hue from the canonical token
// palette so the four cards read as distinct without inventing
// off-palette colors. `accent` drives the icon, eyebrow text, and
// the progress arc; `background` is the dark color shown UNDER the
// accent (e.g. "Play" text sitting on the accent fill) and is fixed
// to the deepest canvas token for AA contrast against every accent.
const PRACTICE_MODE_CARDS: PracticeModeCard[] = [
  {
    key: "meaning",
    title: "Meaning",
    eyebrow: "Word quest",
    detail: "Choose the meaning that fits a word in context.",
    caption: "Best for locking in definitions with real usage.",
    accent: tokenColor.xp,
    // Backgrounds = primeros 4 colores del TOPIC_PANEL_PALETTE (los
    // mismos que usan los topics del journey). Color decision frozen
    // tras varias iteraciones con el usuario (paleta "Italian Topics").
    background: "#1f7ee0", // azul (1er topic del journey)
    icon: "zap",
  },
  {
    key: "context",
    title: "Context",
    eyebrow: "Sentence run",
    detail: "Complete real phrases and choose what sounds natural in context.",
    caption: "Best for recall, sentence flow, and natural usage.",
    accent: tokenColor.streak,
    background: "#58a700", // verde (2do topic del journey)
    icon: "message-circle",
  },
  {
    key: "listening",
    title: "Listening",
    eyebrow: "Sound check",
    detail: "Hear a word and choose what was said.",
    caption: "Best for audio recognition and fast review.",
    accent: tokenColor.energy,
    background: "#a560e8", // morado (3er topic del journey)
    icon: "headphones",
  },
  {
    key: "match",
    title: "Match",
    eyebrow: "Rapid pairs",
    detail: "Connect words and meanings in a timed matching round.",
    caption: "Best for repetition and confidence under pressure.",
    accent: tokenColor.cyan,
    background: "#ff9600", // naranja (4to topic del journey)
    // Was "brain" — collided with the bottom-tab Practice icon. "link"
    // matches the "Connect words and meanings" copy and is unique
    // among the four practice modes.
    icon: "link",
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

// getCoverUrl lives in its own module so ReaderScreen and anything else that
// renders a cover can share the same Next.js image-optimizer routing.
// See `./coverUrl.ts`.

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
  // Keep remote and local URLs on separate fields so the reader has a real
  // fallback when the local copy is missing / corrupt: `story.cover` and
  // `story.audio` carry the REMOTE URL (works online, even if offline copy
  // broke); `resolvedCoverUrl` / `resolvedAudioUrl` carry the LOCAL URI
  // (works offline when the file is actually on disk).
  const remoteCover = story.coverUrl || undefined;
  const remoteAudio = story.audioUrl || "";
  const localCover = story.localCoverUri || null;
  const localAudio = story.localAudioUri || null;
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
    cover: remoteCover,
    stories: [],
  };
  const mobileStory: Story = {
    id: story.id,
    slug: story.slug,
    title: story.title,
    text: story.text,
    audio: remoteAudio,
    vocab: parseStandaloneVocab(story.vocabRaw),
    language,
    region,
    variant: story.variant?.trim() || undefined,
    level,
    cefrLevel: cefrLevel as Story["cefrLevel"],
    topic: story.topic || "Daily life",
    cover: remoteCover,
    coverUrl: remoteCover,
    book: mobileBook,
    overrideMetadata: true,
  };
  mobileBook.stories = [mobileStory];

  return {
    book: mobileBook,
    story: mobileStory,
    resolvedAudioUrl: localAudio ?? remoteAudio ?? null,
    resolvedCoverUrl: localCover,
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
  if (a.activeJourneyId !== b.activeJourneyId) return false;
  if (!areJourneysEqual(a.journeys, b.journeys)) return false;
  if (a.targetLanguages.length !== b.targetLanguages.length) return false;
  if (a.interests.length !== b.interests.length) return false;
  const langSet = new Set(a.targetLanguages);
  const interestSet = new Set(a.interests.map((item) => item.toLowerCase()));
  return (
    b.targetLanguages.every((item) => langSet.has(item)) &&
    b.interests.every((item) => interestSet.has(item.toLowerCase()))
  );
}

// Componente aislado para el halo pulsante del "next story". Lo
// extraemos a nivel de módulo + React.memo para que el style array
// (que contiene el Animated node `opacity`) NO se reconstruya en
// cada render del shell. Antes el style era inline dentro de
// `renderJourneyStoryNode`, así que el array y el objeto inline
// `{ backgroundColor, opacity }` eran nuevos en cada pase. Eso
// hacía que `Animated.createAnimatedComponent` detache+attache el
// listener nativo bajo presión de renders (scroll del path, sticky
// topic state, etc.) y bajo carga el attach no se completaba: el
// halo quedaba congelado en el último valor mientras el float
// seguía vivo (el float también era inline pero translateY tolera
// mejor el detach/attach que opacity, según observación previa).
// Con `memo` y props estables (color: string memoizado por slug,
// opacity: nodo memoizado a nivel del componente), el inner
// Animated.View no se desmonta ni cambia su style, así que el
// listener nativo queda enganchado de forma persistente.
const NextStoryGlowOverlay = memo(function NextStoryGlowOverlay({
  color,
  opacity,
}: {
  color: string;
  opacity: Animated.AnimatedInterpolation<number>;
}) {
  // Memo del style: si memo() previene re-render por props iguales,
  // este useMemo no se re-ejecuta y el array de style mantiene la
  // misma referencia para el Animated.View. Así, aún si el padre
  // se desmonta y remonta (cambio de tab + vuelta a home), una vez
  // remontado el listener nativo se attach una sola vez al mismo
  // style estable, sin oscilaciones detach+attach que congelaban
  // el halo.
  const style = useMemo(
    () => [styles.journeyNodePillNextGlow, { backgroundColor: color, opacity }],
    [color, opacity]
  );
  return <Animated.View pointerEvents="none" style={style} />;
});

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
  // Tracks the shell ScrollView's vertical offset, used to decide
  // when to surface the floating "scroll to top" button in Favorites.
  // Reset to 0 on tab switches by the same effect below that scrolls
  // the shell back to the top.
  const [shellScrollY, setShellScrollY] = useState(0);
  // Scroll the main shell to the top whenever the user switches tabs, so
  // e.g. Home → Explore doesn't land the new screen mid-list at the same
  // vertical offset as the old one. Journey is the exception: it has its
  // own scroll-restore effect (see `previousActiveScreenRef` below) that
  // returns the user to the same place they were when they last left
  // Journey. Resetting to 0 here would race with that restore and
  // sometimes win, snapping the user back to the top — exactly what the
  // restore was trying to avoid.
  useEffect(() => {
    // After IA swap, the journey path lives in the "home" key. Skip
    // the scroll-reset there so the journey doesn't snap back to top
    // every time the tab becomes active.
    if (activeScreen === "home") return;
    shellScrollRef.current?.scrollTo({ y: 0, animated: false });
    setShellScrollY(0);
  }, [activeScreen]);
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
  // Countdown 3-2-1-GO antes del primer ejercicio. true durante los
  // 3 seg iniciales; mientras está activo el timer y el autoplay del
  // ejercicio NO arrancan, así el usuario tiene un buffer para
  // ubicarse antes de que aparezca la primera pregunta.
  const [practiceCountdownActive, setPracticeCountdownActive] = useState(false);
  // Indica que el ejercicio actual fue revelado por timeout (no por
  // tap manual del usuario). La UI muestra un banner "Time's up" para
  // que el usuario sepa que falló por agotar el timer en lugar de
  // creer que la respuesta correcta era lo que tapeó (que tapeó nada).
  // Se resetea junto con `practiceRevealed` en cada `advancePractice`
  // y al iniciar la sesión.
  const [practiceTimedOut, setPracticeTimedOut] = useState(false);
  // Pausa global de la sesión: detiene el timer, cancela el
  // auto-advance schedule, y silencia el autoplay del audio. Tap manual
  // en TTS/Story/HQ sigue funcionando para que el usuario pueda
  // escuchar tranquilo durante la pausa.
  const [practicePaused, setPracticePaused] = useState(false);
  // Segundos que faltan en el timer del ejercicio actual. Se setea a 10
  // al iniciar cada ejercicio y baja 1 cada segundo. Al llegar a 0
  // revela la respuesta correcta, marca como wrong y dispara el
  // auto-advance.
  const [practiceTimerRemaining, setPracticeTimerRemaining] = useState(10);
  // Controls the "Exit without finishing?" confirmation overlay. Back button
  // opens it when the user is mid-session (has started at least one exercise
  // and hasn't completed the round). The Done button after completion skips
  // straight past it — no confirmation needed then.
  const [practiceExitConfirmVisible, setPracticeExitConfirmVisible] = useState(false);
  // Story ID that should wear the "next up" glow on the topic / book list
  // after a story-based practice session completes. Cleared after a few
  // seconds so the glow is attention-grabbing but not permanent.
  const [highlightedNextStoryId, setHighlightedNextStoryId] = useState<string | null>(null);
  const [speakingPracticePromptId, setSpeakingPracticePromptId] = useState<string | null>(null);
  const [playingPracticeClipId, setPlayingPracticeClipId] = useState<string | null>(null);
  const [playingHqPracticeClipId, setPlayingHqPracticeClipId] = useState<string | null>(null);
  const [hqUrlBySentence, setHqUrlBySentence] = useState<Record<string, string>>({});
  const [practiceLastResult, setPracticeLastResult] = useState<"correct" | "wrong" | null>(null);
  const [practiceSessionStreak, setPracticeSessionStreak] = useState(0);
  const [activeMatchWord, setActiveMatchWord] = useState<string | null>(null);
  const [matchedWords, setMatchedWords] = useState<string[]>([]);
  // Tracks the most recent wrong match attempt so the UI can flash the
  // mis-tapped row red briefly. Cleared on a short timer (700 ms) and
  // when the user moves on to the next exercise. Without this state
  // the previous behavior silently swallowed wrong taps — the user
  // simply couldn't make a mistake, which read as a broken exercise.
  const [wrongMatchAttempt, setWrongMatchAttempt] = useState<{ word: string; value: string } | null>(null);
  const [practiceLaunchContext, setPracticeLaunchContext] = useState<PracticeLaunchContext>({
    source: "favorites",
  });
  const [practiceSeedItems, setPracticeSeedItems] = useState<PracticeFavoriteItem[] | null>(null);
  const [practiceLoadError, setPracticeLoadError] = useState<string | null>(null);
  const [practiceReturnSelection, setPracticeReturnSelection] = useState<ReaderSelection | null>(null);
  // Screen the user was on when story-based practice was launched (typically
  // "journey" if they came from a topic detail, or "home" / "explore" etc.).
  // Restored by closePracticeSession so tapping back out of the reader after
  // a practice session returns them to where they came from, not "practice".
  const [practicePreviousScreen, setPracticePreviousScreen] = useState<MobileScreen | null>(null);
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
  // Initial preferences: synthesize one journey per language from
  // the session token's target list so that even before the first
  // /api/user/preferences hydrate we have a non-empty `journeys`
  // array to drive the chip + sheet. Server hydrate will overwrite
  // this with the canonical list (or backfill it via
  // synthesizeJourneysFromLegacy) once it returns.
  const initialJourneys = (() => {
    const langs = normalizeLanguageSelection(sessionTargetLanguages ?? []);
    if (langs.length === 0) return { journeys: [] as Journey[], activeJourneyId: null };
    return synthesizeJourneysFromLegacy({
      targetLanguages: langs,
      preferredVariant: null,
      preferredLevel: null,
      journeyFocus: null,
    });
  })();
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
    journeys: initialJourneys.journeys,
    activeJourneyId: initialJourneys.activeJourneyId,
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
    journeys: initialJourneys.journeys,
    activeJourneyId: initialJourneys.activeJourneyId,
  });
  const [preferencesStatus, setPreferencesStatus] = useState<SaveStatus>("idle");
  const [preferencesLoading, setPreferencesLoading] = useState(false);
  const [didHydratePreferences, setDidHydratePreferences] = useState(false);
  const [preferencesHint, setPreferencesHint] = useState<string | null>(null);
  const [reminderHint, setReminderHint] = useState<string | null>(null);
  const [customInterestInput, setCustomInterestInput] = useState("");
  // Initial `true` when we already know there's a session token at
  // mount — that way the very first paint already shows the skeleton
  // instead of empty sections waiting for the fetch effect to flip
  // the flag. Without this the previous loadingRemote=false on frame
  // 1 produced the "home incompleta → skeleton → home completa"
  // flicker reported on device.
  const [loadingRemote, setLoadingRemote] = useState(() => Boolean(sessionToken));
  // Tracks whether the first remote hydrate has completed (success OR
  // failure). The Home skeleton is gated on `!didFirstHydrate` rather
  // than `loadingRemote` so the very first paint shows ONLY the
  // skeleton — no flashes of half-loaded sections from local state
  // before the fetch effect runs and flips loadingRemote. Subsequent
  // refreshes don't re-show the skeleton because this flag stays true.
  const [didFirstHydrate, setDidFirstHydrate] = useState(false);

  // Hard cap so the Home skeleton never lingers. If the 6 parallel
  // hydrate fetches haven't all settled by 3 s we flip the flag
  // anyway: most users should see whatever data did arrive, plus
  // empty states for slow endpoints, instead of the skeleton for
  // ~5 s while the slowest request finishes. The fetches keep
  // running and update the UI when they land. Cleared on every
  // sessionToken change so it only fires for the current session.
  useEffect(() => {
    if (didFirstHydrate) return;
    if (!sessionToken) return;
    const timer = setTimeout(() => setDidFirstHydrate(true), 3000);
    return () => clearTimeout(timer);
  }, [didFirstHydrate, sessionToken]);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  // Real "am I offline" signal from the OS via NetInfo, debounced so brief
  // blips (cold-start before the first event, Wi-Fi handoff, captive
  // portal revalidation) don't flash the banner. The banner appears only
  // when the OS reports no connectivity for >800ms; it disappears the
  // instant connectivity returns. This replaces the older heuristic of
  // "every fetch rejected" which caused false positives during the first
  // second of cold-start.
  const isOffline = useOfflineStatus();
  // Tap the offline banner → increment this to trigger a fresh hydrate
  // without waiting for the next natural refresh cycle.
  const [remoteRefreshCounter, setRemoteRefreshCounter] = useState(0);
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
  const [activeJourneyLanguageHydrated, setActiveJourneyLanguageHydrated] = useState(false);
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
  const practiceHqSoundRef = useRef<Audio.Sound | null>(null);
  // Tracks the id del último ejercicio cuyo autoplay ya disparó. Se
  // resetea en openPracticeMode para que la primera reproducción de
  // cada sesión nueva siempre dispare. Declarado acá arriba (no en el
  // effect del autoplay donde se usa) para que `openPracticeMode`
  // pueda escribirlo sin caer en TDZ.
  const lastAutoplayedExerciseIdRef = useRef<string | null>(null);
  const practiceClipStopAtMillisRef = useRef<number | null>(null);
  const practiceFeedbackSoundRef = useRef<Audio.Sound | null>(null);
  // Animated values for the "session complete" celebration. Driven by
  // an effect that fires when practiceComplete flips to true; reset
  // whenever the session is closed or the round restarts.
  const practiceCompleteOpacity = useRef(new Animated.Value(0)).current;
  const practiceCompleteScale = useRef(new Animated.Value(0.85)).current;
  const practiceCompleteTranslate = useRef(new Animated.Value(20)).current;
  // Per-exercise entrance animation: each new exercise slides up + fades
  // in so the transition feels deliberate instead of an instant swap.
  const practiceExerciseOpacity = useRef(new Animated.Value(1)).current;
  const practiceExerciseTranslate = useRef(new Animated.Value(0)).current;
  // Bottom sheet state for the new "Switch language" flow. Opens on
  // tap of the flag chip in the journey top strip and replaces the
  // old full-screen "My Languages" hub.
  const [languageSwitchOpen, setLanguageSwitchOpen] = useState(false);
  // Full-screen panel that opens from the sheet's single "Add journey"
  // CTA. Shows every journey as a rich card and hosts the 2-step
  // (language → focus) creator. Replaces the legacy "See all" /
  // "Add language" routes that used to bounce users to /settings.
  const [journeysPanelOpen, setJourneysPanelOpen] = useState(false);
  // Set of canonical language names ("Spanish", "French", "Korean", …) that
  // exist in the Studio Planning catalog but have NO active Journey record
  // yet. Mobile shows them as "Próximamente" and disables selection. Hardcoded
  // language options not present in Studio at all (Japanese, Chinese) are also
  // treated as coming-soon — Studio is the source of truth.
  const [comingSoonLanguages, setComingSoonLanguages] = useState<Set<string>>(new Set());
  // Bottom sheet that consolidates the 5 legal links (Impressum,
  // Privacy, Cookies, Terms, Data deletion) under a single "Legal"
  // entry in the side menu. Replaces the inline list that used to
  // sit at the bottom of the menu.
  const [legalSheetOpen, setLegalSheetOpen] = useState(false);
  // Bottom-sheet popup for the streak / level / XP stats in the
  // journey top bar. Replaces the previous behavior of jumping to
  // the Progress tab when the user tapped one of those badges —
  // a tab change felt like a navigation, the badges read more like
  // "show me a quick summary".
  const [progressSheetOpen, setProgressSheetOpen] = useState(false);
  // Drag-to-dismiss for the Progress sheet. Mirrors the gesture used in
  // LanguageSwitchSheet — only downward drag is responsive; release > 80pt
  // or velocity > 0.8 closes the sheet, otherwise it springs back to 0.
  const progressSheetDragY = useRef(new Animated.Value(0)).current;
  const progressSheetPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 6,
        onPanResponderMove: (_, gesture) => {
          if (gesture.dy > 0) progressSheetDragY.setValue(gesture.dy);
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy > 80 || gesture.vy > 0.8) {
            setProgressSheetOpen(false);
            progressSheetDragY.setValue(0);
          } else {
            Animated.spring(progressSheetDragY, {
              toValue: 0,
              damping: 22,
              stiffness: 220,
              useNativeDriver: true,
            }).start();
          }
        },
        onPanResponderTerminate: () => {
          Animated.spring(progressSheetDragY, {
            toValue: 0,
            damping: 22,
            stiffness: 220,
            useNativeDriver: true,
          }).start();
        },
      }),
    [progressSheetDragY]
  );
  // Topic preview sheet — opens when the user taps a topic panel on
  // the journey path. Shows the stories that will appear inside the
  // topic plus the vocabulary teaser (real words pulled from the
  // offline cache) so the user gets a concrete preview of what
  // they'll learn before diving in.
  const [topicPreviewOpen, setTopicPreviewOpen] = useState<{
    levelId: string;
    topicLabel: string;
    topicSlug: string;
    bgColor: string;
    stories: Array<{ id: string; title: string; coverUrl: string | null }>;
    vocabWords: string[];
    /** True while a background server fetch for vocab is in flight.
     *  The sheet shows a skeleton placeholder instead of the
     *  fallback hint while this is true, so the user doesn't see
     *  "Open a story..." flash for a frame before the chips arrive. */
    isVocabLoading: boolean;
  } | null>(null);
  // ─── Multi-variant journey persistence ────────────────────────
  // Two-phase: (1) load disk first, override the synthesized list
  // when the disk has more entries; THEN (2) start saving on every
  // change. Earlier these two ran in parallel as soon as
  // didHydratePreferences flipped — the save fired with the
  // server-synthesized 1-entry list and overwrote whatever the
  // disk had BEFORE the load could read it. Result: the user's
  // multi-variant picks were lost on the very next cold start.
  // The `journeysRestored` state gates saves until restore is
  // done.
  const [journeysRestored, setJourneysRestored] = useState(false);

  // (1) Load stored journeys → override if more detailed.
  useEffect(() => {
    if (!didHydratePreferences) return;
    if (journeysRestored) return;
    void (async () => {
      const stored = await loadStoredJourneys();
      if (stored && stored.journeys.length > 0) {
        setPreferences((current) => {
          if (current.journeys.length >= stored.journeys.length) return current;
          return {
            ...current,
            journeys: stored.journeys,
            activeJourneyId: stored.activeJourneyId ?? current.activeJourneyId,
            targetLanguages: targetLanguagesFromJourneys(stored.journeys),
          };
        });
      }
      // Mark restored AFTER the setPreferences call so the save
      // effect (gated below) doesn't fire with the pre-restore
      // value.
      setJourneysRestored(true);
    })();
  }, [didHydratePreferences, journeysRestored]);

  // (2) Save journeys to disk on every change — only AFTER the
  // restore-from-disk pass has completed, to avoid the overwrite
  // race described above.
  useEffect(() => {
    if (!journeysRestored) return;
    void saveStoredJourneys(preferences.journeys, preferences.activeJourneyId);
  }, [preferences.journeys, preferences.activeJourneyId, journeysRestored]);

  // Pull the Studio Planning language catalog so the language pickers (in
  // OnboardingFlow + JourneysPanel) can mark languages without an active
  // Journey record as "Próximamente". The hardcoded LANGUAGE_OPTIONS in those
  // components stays — we just annotate which entries are not ready yet.
  useEffect(() => {
    if (!sessionToken) return;
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiFetch<{
          languages: Array<{ code: string; label: string; comingSoon: boolean }>;
        }>({
          baseUrl: mobileConfig.apiBaseUrl,
          path: "/api/mobile/languages",
          token: sessionToken,
        });
        if (cancelled) return;
        // Studio's `code` is the lowercase canonical language slug
        // ("spanish", "korean", "italian"). Mobile's LANGUAGE_OPTIONS keys
        // languages by their English name with a capital first letter
        // ("Spanish", "Korean", "Italian"). Both forms go into the set so
        // either lookup succeeds without a separate normalization pass.
        const next = new Set<string>();
        for (const lang of data.languages) {
          if (!lang.comingSoon) continue;
          const code = lang.code.trim().toLowerCase();
          next.add(code);
          // Title-case English name: "spanish" → "Spanish".
          if (code) next.add(code[0].toUpperCase() + code.slice(1));
        }
        // Languages NOT in Studio at all are also coming-soon (Studio is the
        // catalog of record). Mobile knows about Japanese/Chinese which the
        // user hasn't added to Studio yet, so flag them too.
        const studioLangs = new Set(data.languages.map((l) => l.code.trim().toLowerCase()));
        for (const known of ["japanese", "chinese"]) {
          if (!studioLangs.has(known)) {
            next.add(known);
            next.add(known[0].toUpperCase() + known.slice(1));
          }
        }
        setComingSoonLanguages(next);
      } catch (err) {
        console.warn("[language-catalog] fetch failed", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionToken]);

  // Modal shown when the user taps a story locked by level — offers
  // the level test as a way to skip ahead instead of just blocking
  // them with a toast.
  const [levelTestOfferOpen, setLevelTestOfferOpen] = useState<{
    targetLevel: string;
    targetLanguage: string;
  } | null>(null);
  // Live the level test runner state — when set, the test screen
  // overlays the rest of the app. The runner handles its own scoring
  // and calls back when finished.
  const [levelTestActive, setLevelTestActive] = useState<{
    language: string;
    source: "onboarding" | "locked-story";
  } | null>(null);
  // ─── Topic panel sticky (JS-driven floating panel) ─────────────
  // We measure each topic block's Y position inside the ScrollView's
  // content via `measureLayout` against the ScrollView's inner node.
  // On scroll, we figure out which topic the user is currently inside
  // (the latest panel that has scrolled past the top of the path) and
  // render its title in a fixed View pinned just below the top bar.
  // The in-flow topic panels still render at their natural positions;
  // the floating one covers them as the user scrolls past.
  type TopicLayoutEntry = {
    y: number;
    height: number;
    label: string;
    levelLabel: string;
    bgColor: string;
    locked: boolean;
  };
  const topicLayoutsRef = useRef<Map<string, TopicLayoutEntry>>(new Map());
  const topicViewsRef = useRef<Map<string, View>>(new Map());
  const [stickyTopic, setStickyTopic] = useState<{
    slug: string;
    label: string;
    levelLabel: string;
    bgColor: string;
    locked: boolean;
  } | null>(null);
  const stickyTopicSlugRef = useRef<string | null>(null);
  // Set of destination slugs that already fired haptic during the current
  // "scroll session" — a session runs from `onScrollBeginDrag` (finger
  // touches the path) to `onMomentumScrollEnd` (deceleration finished).
  // Within a session each unique slug only fires haptic once, so
  // bounce / spring oscillation that revisits a topic the user already
  // crossed produces no extra ticks. Sentinel string is used for the
  // "sticky cleared" transition so going-back-to-top also dedupes if it
  // happens to oscillate. Reset at session boundaries.
  const STICKY_NULL_SENTINEL = "__null__";
  const visitedSlugsInSessionRef = useRef<Set<string>>(new Set());
  // Latest known scroll-Y of the shell ScrollView. Used by
  // `measureTopicY` to seed the floating sticky panel as soon as the
  // first topic is measured, without waiting for the user's first
  // scroll event. Without this seed the panel would mount blank for
  // a frame on entry to the journey screen.
  const shellScrollYRef = useRef(0);
  // Pixel height of the journey top bar (flag chip + stats + menu).
  // We measure it ONCE (latched via `topBarMeasuredRef`) so the
  // floating sticky panel sits pixel-perfect on top of the in-flow
  // topic panel during the eclipse. Earlier we either:
  //   - hardcoded it (wrong by 2–4 px on real devices, which made
  //     the sticky and the in-flow appear as a doubled / vibrating
  //     edge during overlap — the "flicker on eclipse" bug)
  //   - re-measured on every render (created a feedback loop with
  //     setState → re-render → onLayout → setState).
  // Latch + once is the right balance: we get the exact device
  // height once after first paint and never re-fire.
  const [journeyTopBarHeight, setJourneyTopBarHeight] = useState(66);
  const topBarMeasuredRef = useRef(false);
  // Scroll-to-top floating arrow on the journey screen. Shows once
  // the user has scrolled far enough that returning to the start of
  // the path is a meaningful action (one full topic-block down,
  // ~280pt). Tapping it animates the ScrollView smoothly back to
  // y=0.
  const [showJourneyScrollTop, setShowJourneyScrollTop] = useState(false);
  const showJourneyScrollTopRef = useRef(false);

  // Two reasons to force the onboarding to show up after the gate:
  //   - "test"   → polyglot menu entry. Selections are NOT persisted;
  //                cancelling/finishing just clears the flag.
  //   - "proper" → the user landed in the shell with no language
  //                configured (likely completed the legacy survey
  //                without picking one), and tapped the flag chip.
  //                Selections persist normally.
  const [onboardingOverride, setOnboardingOverride] = useState<
    "proper" | null
  >(null);
  // The "test" override variant was dropped — the "Test mode" menu
  // entry now does a full preference reset (handleTestModeReset)
  // and lets the regular `shouldShowOnboardingSurvey` gate fire,
  // so we no longer need a transient flag to override the gate
  // without touching prefs.
  const forceOnboardingProper = onboardingOverride === "proper";

  // MOCK DATA — per-language stats while we don't have a backend
  // aggregator. Same source as the web handoff; reviewer should grep
  // "MOCK_LANG_STATS" to find and remove in one diff once stats land.
  const MOCK_LANG_STATS: Record<string, { streak: number; xpTotal: number; progress: number }> = {
    German: { streak: 7, xpTotal: 1240, progress: 42 },
    Spanish: { streak: 21, xpTotal: 8450, progress: 78 },
    French: { streak: 0, xpTotal: 120, progress: 8 },
    Japanese: { streak: 3, xpTotal: 560, progress: 18 },
    Italian: { streak: 0, xpTotal: 0, progress: 0 },
    Portuguese: { streak: 0, xpTotal: 0, progress: 0 },
    English: { streak: 0, xpTotal: 0, progress: 0 },
    Korean: { streak: 0, xpTotal: 0, progress: 0 },
    Chinese: { streak: 0, xpTotal: 0, progress: 0 },
  };
  // Mapping coarse → CEFR ahora vive en `journeys.ts` como
  // `cefrFromCoarseLevel` para que el card del JourneysPanel y el row
  // de la sheet de switch idiomas usen exactamente la misma fuente.
  // Antes había dos copias y empezaron a diferir — la sheet mostraba
  // "B1" y el card "Intermediate" para el mismo journey.
  const cefrFromPreferredLevel = cefrFromCoarseLevel;
  // When the user has no target languages picked yet (legacy onboarding
  // or a fresh account that skipped the survey), the sheet shows every
  // supported language so they can start a journey from there. Tapping
  // one writes it as the first targetLanguages entry the same way an
  // active switch does.
  const ALL_SUPPORTED_LANGUAGES = [
    "Spanish",
    "French",
    "German",
    "Italian",
    "Portuguese",
    "Japanese",
    "Korean",
    "Chinese",
    "English",
  ];
  const hasUserJourneys = preferences.journeys.length > 0;
  const activeJourney = findActiveJourney(preferences.journeys, preferences.activeJourneyId);
  // Build the rows the JourneySwitchSheet renders: one row per journey
  // (= one row per (language, variant, focus) tuple). Stats are still
  // language-level mocks for now — when per-journey progress lands the
  // lookup key changes to journey.id.
  const journeySwitchEntries: LanguageSwitchEntry[] = preferences.journeys.map((journey) => {
    const stats = MOCK_LANG_STATS[journey.language] ?? { streak: 0, xpTotal: 0, progress: 0 };
    const isActive = preferences.activeJourneyId
      ? journey.id === preferences.activeJourneyId
      : journey === preferences.journeys[0];
    // Solo mostramos el variantLabel cuando el variant es realmente
    // un código regional conocido (us/uk/latam/spain…). Bajo el nuevo
    // modelo "un track por Studio Journey", `journey.variant` puede
    // ser un cuid (Journey.id) — formatVariantLabel lo escupe en
    // mayúscula y el row terminaba mostrando "· CMONCZ14V0000…", que
    // es ruido para el usuario. La región canónica vive en
    // `journey.region` (y para journeys legacy en `journey.variant`).
    const flagRegion = journeyFlagVariant(journey);
    const rawVariant = (flagRegion ?? "").trim().toLowerCase();
    const variantLabel = VARIANT_LABELS[rawVariant as keyof typeof VARIANT_LABELS] ?? null;
    return {
      id: journey.id,
      language: journey.language,
      // El entry expone el código regional (no el cuid) para que la
      // bandera se pinte bien.
      variant: flagRegion,
      variantLabel,
      displayName: journeyDisplayName(journey),
      level: cefrFromPreferredLevel(journey.level),
      active: isActive,
      streak: stats.streak,
      xpTotal: stats.xpTotal,
      progress: stats.progress,
    };
  });

  // Polyglot-only QA reset: wipes the user's preferences on both
  // client and server so the onboarding gate fires again, letting
  // you walk through the flow as a brand-new user with the changes
  // actually persisting. Tied to the "Test mode" menu entry.
  async function handleTestModeReset() {
    const blankPrefs: MobilePreferences = {
      targetLanguages: [],
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
      journeys: [],
      activeJourneyId: null,
    };
    setPreferences(blankPrefs);
    setSavedPreferences(blankPrefs);
    setActiveJourneyLanguage(null);
    setRemoteJourney(null);
    setOnboardingOverride(null);
    setActiveScreen("home");
    journeyCacheByLanguageRef.current.clear();
    // Wipe disk-stored journeys too so the test reset truly starts
    // from zero on next launch. Also reset the "restored" flag so
    // the next save cycle isn't gated by a stale restore that
    // happened pre-reset.
    void clearStoredJourneys();
    setJourneysRestored(false);
    // Clear the server side too so a kill + relaunch mid-flow lands
    // on the same fresh state instead of the previous session.
    if (sessionToken) {
      try {
        await apiFetch({
          baseUrl: mobileConfig.apiBaseUrl,
          path: "/api/mobile/preferences",
          token: sessionToken,
          method: "POST",
          body: {
            targetLanguages: [],
            interests: [],
            preferredLevel: null,
            preferredRegion: null,
            preferredVariant: null,
            journeyFocus: null,
            dailyMinutes: null,
            remindersEnabled: false,
            reminderHour: null,
            journeyPlacementLevel: null,
            onboardingSurveyCompletedAt: null,
          },
        });
      } catch (err) {
        console.warn("[test-mode-reset] failed to clear server prefs", err);
      }
    }
  }

  async function handleJourneyDelete(targetId: string) {
    // Block destructive paths the panel already guards but be
    // defensive — a stale UI tap shouldn't be able to wipe the only
    // journey on the account.
    if (preferences.journeys.length <= 1) return;
    const wasActive = preferences.activeJourneyId === targetId;
    let nextActiveId: string | null = preferences.activeJourneyId;
    let nextJourneys: Journey[] = preferences.journeys;
    setPreferences((current) => {
      const remaining = current.journeys.filter((j) => j.id !== targetId);
      // If we just removed the active journey, promote the first
      // remaining one. Otherwise keep the active id pointing where
      // it did (it's still valid).
      const newActiveId = wasActive ? remaining[0]?.id ?? null : current.activeJourneyId;
      const promoted = newActiveId
        ? remaining.find((j) => j.id === newActiveId) ?? null
        : null;
      nextActiveId = newActiveId;
      nextJourneys = remaining;
      return {
        ...current,
        journeys: remaining,
        activeJourneyId: newActiveId,
        targetLanguages: targetLanguagesFromJourneys(remaining),
        // Surface the promoted journey's variant/focus/level on the
        // legacy fields so call sites that still read them see the
        // new active journey, not the dead one.
        preferredVariant: promoted ? promoted.variant : current.preferredVariant,
        preferredLevel: promoted ? promoted.level ?? current.preferredLevel : current.preferredLevel,
        journeyFocus: promoted ? promoted.focus : current.journeyFocus,
      };
    });
    if (wasActive) {
      const promoted = nextJourneys.find((j) => j.id === nextActiveId) ?? null;
      if (promoted) {
        setActiveJourneyLanguage(promoted.language);
        void loadJourneyForLanguage(promoted.language);
      } else {
        setActiveJourneyLanguage(null);
      }
    }
    if (sessionToken) {
      try {
        await apiFetch({
          baseUrl: mobileConfig.apiBaseUrl,
          path: "/api/mobile/preferences",
          token: sessionToken,
          method: "POST",
          body: {
            targetLanguages: targetLanguagesFromJourneys(nextJourneys),
            journeys: nextJourneys,
            activeJourneyId: nextActiveId,
          },
        });
      } catch (err) {
        console.warn("[journey-delete] failed to persist", err);
      }
    }
  }

  // Synchronous guard against rapid double-tap on the create button.
  // The previous `submitting` state lives in the panel and `existing`
  // check reads `preferences.journeys` from closure — both lag the
  // first call by one render, so two clicks fired ~16ms apart could
  // both pass the existing-id check and emit two journeys with
  // identical ids. A ref flips synchronously and bridges the gap.
  const journeyCreateInFlightRef = useRef<Set<string>>(new Set());

  async function handleJourneyCreate(input: {
    language: string;
    variant: string | null;
    region?: string | null;
    focus: JourneyFocus;
    label?: string | null;
  }) {
    const id = journeyId(input.language, input.variant, input.focus);
    // Defensive: if the user somehow lands on an existing combination,
    // activate it instead of duplicating. The panel disables existing
    // combos but this keeps us correct under race conditions.
    const existing = preferences.journeys.find((j) => j.id === id);
    if (existing) {
      void handleJourneySwitch(id);
      return;
    }
    // Synchronous "already creating this id" check — see ref above.
    if (journeyCreateInFlightRef.current.has(id)) {
      return;
    }
    journeyCreateInFlightRef.current.add(id);
    const newJourney: Journey = {
      id,
      language: input.language,
      variant: input.variant,
      region: input.region?.trim() || null,
      focus: input.focus,
      level: preferences.preferredLevel,
      createdAt: new Date().toISOString(),
      label: input.label?.trim() || null,
    };
    // Computamos el siguiente estado SINCRÓNICAMENTE — antes de
    // setPreferences — para evitar que el updater de React (que con
    // concurrent mode / batching puede correr DESPUÉS del await) deje
    // `persistedJourneys` vacío cuando armamos el body del POST.
    // Bug previo: el body iba con `journeys: []` y el backend borraba
    // la metadata, perdiendo todas las journeys tras kill+launch.
    const nextJourneys = dedupeJourneysById([newJourney, ...preferences.journeys]);
    setPreferences((current) => ({
      ...current,
      journeys: dedupeJourneysById([newJourney, ...current.journeys]),
      activeJourneyId: newJourney.id,
      targetLanguages: targetLanguagesFromJourneys(nextJourneys),
      preferredVariant: newJourney.variant,
      journeyFocus: newJourney.focus,
    }));
    setActiveJourneyLanguage(input.language);
    void loadJourneyForLanguage(input.language);
    if (sessionToken) {
      try {
        await apiFetch({
          baseUrl: mobileConfig.apiBaseUrl,
          path: "/api/mobile/preferences",
          token: sessionToken,
          method: "POST",
          body: {
            targetLanguages: [
              input.language,
              ...preferences.targetLanguages.filter((n) => n !== input.language),
            ],
            preferredVariant: input.variant,
            journeyFocus: input.focus,
            journeys: nextJourneys,
            activeJourneyId: newJourney.id,
          },
        });
      } catch (err) {
        console.warn("[journey-create] failed to persist", err);
      }
    }
    // Release the in-flight slot regardless of how the persist call
    // resolved — the journey is already in client state, and a
    // subsequent retry of the same id would correctly take the
    // "existing" branch above.
    journeyCreateInFlightRef.current.delete(id);
  }

  async function handleJourneySwitch(journeyId: string) {
    if (!sessionToken) return;
    const target = preferences.journeys.find((j) => j.id === journeyId);
    if (!target) {
      setLanguageSwitchOpen(false);
      return;
    }
    if (preferences.activeJourneyId === journeyId) {
      setLanguageSwitchOpen(false);
      return;
    }
    try {
      // Switch the active journey by id only — do NOT reorder
      // `journeys`. The LanguageSwitchSheet renders rows in array
      // order, so reordering on every tap shuffled the list under the
      // user (the language they came from kept jumping to the top),
      // which felt disorienting. Active state is detected by
      // `activeJourneyId === journey.id`, not by position.
      //
      // The legacy `targetLanguages` array still gets reordered with
      // the active language first, because some call sites (and the
      // server) still derive "what's active" from `targetLanguages[0]`.
      setPreferences((current) => {
        const reorderedForLegacy = [
          target,
          ...current.journeys.filter((j) => j.id !== journeyId),
        ];
        return {
          ...current,
          // journeys order intentionally left untouched
          activeJourneyId: journeyId,
          targetLanguages: targetLanguagesFromJourneys(reorderedForLegacy),
          preferredVariant: target.variant,
          preferredLevel: target.level,
          journeyFocus: target.focus,
        };
      });
      setActiveJourneyLanguage(target.language);
      void loadJourneyForLanguage(target.language);

      const nextOrder = [
        target.language,
        ...preferences.targetLanguages.filter((n) => n !== target.language),
      ];
      await apiFetch({
        baseUrl: mobileConfig.apiBaseUrl,
        path: "/api/mobile/preferences",
        token: sessionToken,
        method: "POST",
        body: {
          targetLanguages: nextOrder,
          preferredVariant: target.variant,
          journeyFocus: target.focus,
          journeys: preferences.journeys,
          activeJourneyId: journeyId,
        },
      });
    } catch (err) {
      console.warn("[journey-switch] failed to persist", err);
    } finally {
      setLanguageSwitchOpen(false);
    }
  }

  // Story ID currently being fetched in the background after a tap.
  // Drives the full-screen ReaderSkeleton so the user sees something
  // immediate even when /api/standalone-stories takes a moment.
  const [openingStoryId, setOpeningStoryId] = useState<string | null>(null);

  // Pre-fetched practice items keyed by story slug. The reader kicks
  // off the fetch in the background while the user is still reading,
  // so by the time they tap "Start practice" at the end the data is
  // already in memory and the transition is instant. Falls back to a
  // live fetch with a loading indicator if the user is faster than
  // the network.
  const practicePrefetchBySlugRef = useRef<Map<string, PracticeFavoriteItem[]>>(new Map());
  const practicePrefetchInFlightRef = useRef<Set<string>>(new Set());
  // Visible while a story-practice fetch is in flight after the user
  // tapped "Start practice" but the prefetch hadn't finished. Drives
  // a tiny loader on top of the practice session view.
  const [practiceLaunchLoading, setPracticeLaunchLoading] = useState(false);

  // Hint surfaced when the user taps a locked journey story — tells
  // them what they need to finish first instead of the tap silently
  // doing nothing. Auto-dismissed by an effect below.
  const [lockedStoryHint, setLockedStoryHint] = useState<string | null>(null);
  // No-op del debug trace que estuvo activo para diagnosticar el bug
  // de apertura de stories. Lo dejamos cableado por si vuelve a hacer
  // falta — los call-sites siguen llamando `showDebug(...)` pero el
  // contenido no se renderiza.
  const showDebug = useCallback((_text: string) => {
    // intentionally empty
  }, []);
  const lockedHintAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!lockedStoryHint) {
      lockedHintAnim.setValue(0);
      return;
    }
    Animated.timing(lockedHintAnim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
    const dismiss = setTimeout(() => {
      Animated.timing(lockedHintAnim, {
        toValue: 0,
        duration: 220,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start(() => setLockedStoryHint(null));
    }, 2800);
    return () => clearTimeout(dismiss);
  }, [lockedStoryHint, lockedHintAnim]);

  // Halo respirante detrás de la "next up" del journey — glow estilo
  // Duolingo, indefinido. Un solo loop alimenta el halo + el float de
  // la story. Animated.Value se declara aquí; el effect que maneja el
  // loop vive más abajo (después de que `activeJourneyTrack` y
  // `globalJourneyNextStoryId` están en scope) para poder rearmarse
  // cuando la "next" salta de historia o el track cambia.
  const journeyNextPulse = useRef(new Animated.Value(0.25)).current;
  // Nodos de interpolación estables. ANTES los creábamos inline dentro
  // de `renderJourneyStoryNode` (`journeyNextPulse.interpolate(...)`),
  // que se llama en cada render. Cada render generaba un nodo nuevo, y
  // `createAnimatedComponent` hacía detach+attach de listeners en cada
  // pase; bajo carga (scroll del path con sticky topics, setStates
  // varios) esa secuencia se desincronizaba y el listener nuevo no
  // siempre enganchaba — la opacidad del halo se congelaba en el
  // último valor alcanzado mientras que el translateY del float
  // toleraba mejor el glitch y seguía visible. Memoizamos los nodos
  // para que vivan tanto como el componente y los Animated.View
  // solo monten/desmonten su listener una vez.
  const journeyNextPulseOpacity = useMemo(
    () =>
      journeyNextPulse.interpolate({
        inputRange: [0.25, 0.85],
        outputRange: [0.25, 0.85],
        extrapolate: "clamp",
      }),
    [journeyNextPulse]
  );
  const journeyNextPulseTranslateY = useMemo(
    () =>
      journeyNextPulse.interpolate({
        inputRange: [0.25, 0.85],
        outputRange: [-2.5, 2.5],
      }),
    [journeyNextPulse]
  );
  // Style estable del float vertical de la "next" story. ANTES se
  // construía inline dentro del IIFE de `renderJourneyStoryNode`
  // como `{ transform: [{ translateY: journeyNextPulseTranslateY }] }`,
  // así que cada render del shell creaba un objeto nuevo. Bajo
  // cambio de tab y vuelta a home (Animated.View se desmonta +
  // remonta), el detach+attach del listener nativo de translateY
  // a veces no se completaba y el float quedaba congelado igual
  // que pasaba con el halo. Memoizar a nivel del componente da una
  // referencia estable durante toda la vida del shell.
  const nextStoryFloatStyle = useMemo(
    () => ({ transform: [{ translateY: journeyNextPulseTranslateY }] }),
    [journeyNextPulseTranslateY]
  );

  // Shimmer experiment (variant B). Loop independiente del pulso del
  // "next" para poder espaciar más las pasadas. Cada ciclo: pausa de
  // 2.4 s (la banda invisible fuera del wrap), 1.5 s de pasada, reset
  // instantáneo. Sensación más sutil, menos repetitiva.
  const shimmerPulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(2400),
        Animated.timing(shimmerPulse, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(shimmerPulse, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shimmerPulse]);
  // Set to true while the perfect-score celebration is on screen so
  // PracticeCelebration renders confetti. Reset on close.
  const [practicePerfectActive, setPracticePerfectActive] = useState(false);
  const storyOpenedAtRef = useRef<number>(0);
  const hasSeededExplorePreferencesRef = useRef(false);
  // Keep the last-fetched journey payload per language so switching back to
  // a previously-opened language renders instantly (no empty flash) while we
  // silently re-fetch in the background to refresh stats / unlocks. Mirrored
  // to disk so a cold-start offline can still render Journey for any
  // language the user has opened before.
  const journeyCacheByLanguageRef = useRef<Map<string, MobileJourneyPayload>>(new Map());
  const saveJourneyCacheToDisk = useCallback(() => {
    const serializable: Record<string, MobileJourneyPayload> = {};
    journeyCacheByLanguageRef.current.forEach((value, key) => {
      serializable[key] = value;
    });
    void saveJourneyCache<MobileJourneyPayload>(PREVIEW_OFFLINE_USER_ID, serializable);
  }, []);
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

  // Keep a stable ref to the latest handler so effects that depend on it do
  // not refire every time the parent produces a new onSignOut identity (this
  // used to cascade from Clerk's ~60s token refresh and cause the Journey
  // grid to flash empty for a split second).
  const handleUnauthorizedSessionRef = useRef(handleUnauthorizedSession);
  useEffect(() => {
    handleUnauthorizedSessionRef.current = handleUnauthorizedSession;
  }, [handleUnauthorizedSession]);

  useEffect(() => {
    if (!sessionToken) {
      // Two distinct "no token" cases:
      //   1. No sessionUserId either → genuine signed-out state. Wipe
      //      everything so the next sign-in starts fresh.
      //   2. We have a sessionUserId from the anchor → the user IS signed
      //      in, we just can't call the API right now (offline cold-start
      //      where SecureStore didn't return the JWT). Mark the UI as
      //      offline so the banner appears; keep cached state intact so
      //      Library / Home / Journey still render from the snapshot.
      if (!sessionUserId) {
        setRemoteBooks([]);
        setRemoteStories([]);
        setRemoteEntitlement(null);
        setRemoteProgress(null);
        const clearedLangs = normalizeLanguageSelection(sessionTargetLanguages ?? []);
        const clearedJourneys = clearedLangs.length > 0
          ? synthesizeJourneysFromLegacy({
              targetLanguages: clearedLangs,
              preferredVariant: null,
              preferredLevel: null,
              journeyFocus: null,
            })
          : { journeys: [] as Journey[], activeJourneyId: null };
        const clearedPreferences: MobilePreferences = {
          targetLanguages: clearedLangs,
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
          journeys: clearedJourneys.journeys,
          activeJourneyId: clearedJourneys.activeJourneyId,
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
        journeyCacheByLanguageRef.current.clear();
        void clearJourneyCache(PREVIEW_OFFLINE_USER_ID);
        // Genuine signed-out: no skeleton needed either.
        setDidFirstHydrate(true);
      } else {
        // Anchor-only: we have proof of prior sign-in but no token
        // yet. The skeleton stays visible while Clerk catches up and
        // mints a fresh token — when it does, this effect re-runs
        // with sessionToken set and goes through the full-hydrate
        // branch, which is what flips didFirstHydrate=true normally.
        // If the token never arrives (offline for real), a 4s
        // fallback timer enables the offline content view so the
        // user isn't stuck looking at the skeleton forever.
        setLoadingRemote(false);
        const fallback = setTimeout(() => setDidFirstHydrate(true), 4000);
        return () => clearTimeout(fallback);
      }
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
        handleUnauthorizedSessionRef.current();
        setLoadingRemote(false);
        setDidFirstHydrate(true);
        return;
      }

      const errors: string[] = [];
      // When every single request rejected, we keep any previously
      // loaded remote state intact instead of wiping it. The banner
      // itself is driven by NetInfo (useOfflineStatus), not by this
      // flag — so we only use `allRejected` to decide whether to
      // blank arrays or preserve the last-known-good state.
      const allRejected = [booksResult, storiesResult, entitlementResult, progressResult, continueResult, journeyResult].every(
        (result) => result.status === "rejected"
      );

      if (booksResult.status === "fulfilled") {
        setRemoteBooks(booksResult.value);
      } else if (!allRejected) {
        // Partial failure (this specific endpoint is broken, rest is fine):
        // drop to empty and surface the error like before.
        setRemoteBooks([]);
        if (!sessionBooksCount) {
          errors.push(`Books: ${booksResult.reason instanceof Error ? booksResult.reason.message : "Unable to load"}`);
        }
      }

      if (storiesResult.status === "fulfilled") {
        setRemoteStories(storiesResult.value);
      } else if (!allRejected) {
        setRemoteStories([]);
        if (!sessionStoriesCount) {
          errors.push(
            `Stories: ${storiesResult.reason instanceof Error ? storiesResult.reason.message : "Unable to load"}`
          );
        }
      }

      if (entitlementResult.status === "fulfilled") {
        setRemoteEntitlement(entitlementResult.value);
      } else if (!allRejected && !sessionPlan) {
        setRemoteEntitlement(null);
        errors.push(
          `Plan: ${entitlementResult.reason instanceof Error ? entitlementResult.reason.message : "Unable to load"}`
        );
      }

      if (progressResult.status === "fulfilled") {
        setRemoteProgress(progressResult.value);
      } else if (!allRejected) {
        setRemoteProgress(null);
      }

      if (continueResult.status === "fulfilled") {
        setRemoteContinueListening(continueResult.value);
      } else if (!allRejected) {
        setRemoteContinueListening([]);
      }

      if (journeyResult.status === "fulfilled") {
        setRemoteJourney(journeyResult.value);
        // Seed the per-language cache with whatever the server returned from
        // the no-param call so a subsequent explicit switch to the same
        // language skips the empty state entirely.
        const seedLanguage = journeyResult.value?.language;
        if (typeof seedLanguage === "string" && seedLanguage.trim()) {
          journeyCacheByLanguageRef.current.set(seedLanguage.toLowerCase(), journeyResult.value);
          void saveJourneyCacheToDisk();
        }
      } else if (!allRejected) {
        setRemoteJourney(null);
      }

      setRemoteError(errors.length > 0 ? errors.join("  ") : null);
      setLoadingRemote(false);
      setDidFirstHydrate(true);
    }

    void hydrateRemoteLibrary();

    return () => {
      cancelled = true;
    };
  }, [remoteRefreshCounter, sessionBooksCount, sessionPlan, sessionStoriesCount, sessionToken, sessionUserId]);

  // Ref mirror of the latest preferences so callbacks that don't want
  // to churn deps (like `loadJourneyForLanguage`) can still read the
  // current preferredVariant / activeJourneyId without re-creating
  // every render. Updated synchronously after every render below.
  const preferencesRef = useRef(preferences);
  useEffect(() => {
    preferencesRef.current = preferences;
  }, [preferences]);

  const loadJourneyForLanguage = useCallback(
    async (language: string, options: { clearPrevious?: boolean } = {}) => {
      if (!sessionToken) return;
      const cacheKey = language.toLowerCase();
      const cached = journeyCacheByLanguageRef.current.get(cacheKey);
      // For silent re-fetches (Clerk token refresh, language-mismatch check
      // after hydrate) we keep the currently-rendered journey visible so the
      // grid doesn't flash empty for a split-second. For explicit user-driven
      // language switches we DO clear it — otherwise the old language's story
      // covers ghost under the new header while the new payload loads.
      // However, if we already have a cached payload for this language we can
      // render it instantly and then refresh in the background — no empty
      // state at all.
      const shouldClearPrevious = options.clearPrevious !== false;
      setSelectedJourneyTrackId(null);
      setSelectedJourneyLevelId(null);
      setSelectedJourneyTopicId(null);
      setJourneyDetailTopicId(null);
      setJourneyVariantPickerOpen(false);
      if (cached) {
        setRemoteJourney(cached);
      } else if (shouldClearPrevious) {
        setRemoteJourney(null);
      }
      setJourneyLanguageLoading(!cached);
      try {
        const payload = await apiFetch<MobileJourneyPayload>({
          baseUrl: mobileConfig.apiBaseUrl,
          path: `/api/mobile/journey?language=${encodeURIComponent(language)}`,
          token: sessionToken,
        });
        journeyCacheByLanguageRef.current.set(cacheKey, payload);
        saveJourneyCacheToDisk();
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
        // El variant picker auto-abierto se eliminó: una pantalla de
        // journey sin journey no tiene sentido. Si el idioma trae
        // varios tracks y el usuario aún no escogió uno, `activeJourneyTrack`
        // ([cae al primero][line 9612]) y el path se renderiza siempre.
        // Cambio de track quedaría para un flujo explícito (settings o
        // JourneysPanel), no como bloqueo del journey.
      } catch {
        // Only drop to empty if we have nothing cached to fall back on.
        if (!cached) setRemoteJourney(null);
      } finally {
        setJourneyLanguageLoading(false);
      }
    },
    [saveJourneyCacheToDisk, sessionToken]
  );

  // Lightweight tracks fetcher for the JourneysPanel "pick a journey"
  // step. Hits the same endpoint as `loadJourneyForLanguage` but does
  // NOT mutate the active journey state — the panel needs the track
  // list for an arbitrary language without disturbing what the user
  // is currently viewing on the journey screen.
  const getTracksForLanguage = useCallback(
    async (language: string): Promise<{ id: string; label: string }[]> => {
      if (!sessionToken) return [];
      const cacheKey = language.toLowerCase();
      const cached = journeyCacheByLanguageRef.current.get(cacheKey);
      if (cached?.tracks?.length) {
        return cached.tracks.map((track) => ({ id: track.id, label: track.label }));
      }
      try {
        const payload = await apiFetch<MobileJourneyPayload>({
          baseUrl: mobileConfig.apiBaseUrl,
          path: `/api/mobile/journey?language=${encodeURIComponent(language)}`,
          token: sessionToken,
        });
        journeyCacheByLanguageRef.current.set(cacheKey, payload);
        saveJourneyCacheToDisk();
        return payload.tracks.map((track) => ({ id: track.id, label: track.label }));
      } catch {
        return [];
      }
    },
    [saveJourneyCacheToDisk, sessionToken]
  );

  // Synchronous twin of `getTracksForLanguage` — returns the cached
  // tracks immediately when present, or null when a network fetch
  // would be required. Used by the JourneysPanel to skip the
  // "Loading..." flicker when the prefetch has already populated the
  // cache.
  const getTracksForLanguageSync = useCallback(
    (language: string): { id: string; label: string }[] | null => {
      const cached = journeyCacheByLanguageRef.current.get(language.toLowerCase());
      if (!cached?.tracks?.length) return null;
      return cached.tracks.map((track) => ({ id: track.id, label: track.label }));
    },
    []
  );

  // Prefetch every cover once the journey payload arrives so tapping into a
  // level or topic shows images immediately instead of racing the network.
  // We prefetch the SAME URL shape (`getCoverUrl`) the UI will render with,
  // otherwise RN's Image cache keys won't match and the prefetch is wasted.
  useEffect(() => {
    if (!remoteJourney) return;
    const covers = new Set<string>();
    for (const track of remoteJourney.tracks) {
      for (const level of track.levels) {
        for (const topic of level.topics) {
          for (const story of topic.stories) {
            const url = story.coverUrl;
            if (typeof url === "string" && url.trim()) covers.add(url);
          }
        }
      }
    }
    covers.forEach((url) => {
      // Match the width the journey UI renders covers at: `getCoverUrl(url)`
      // defaults to 400 → snaps to 640 via the Next.js image optimizer. If
      // we prefetched at a different width the cache key wouldn't match and
      // the prefetch would be wasted.
      void Image.prefetch(getCoverUrl(url)).catch(() => undefined);
    });
  }, [remoteJourney]);

  // Hydrate the active journey language from SecureStore on mount so the
  // user's last selection survives app relaunches.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync("digital-polyglot/active-journey-language");
        if (!cancelled && typeof stored === "string" && stored.trim()) {
          setActiveJourneyLanguage(stored.trim());
        }
      } catch {
        // ignore; SecureStore unavailable or corrupted value
      } finally {
        if (!cancelled) setActiveJourneyLanguageHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist the active journey language whenever it changes (after hydration).
  useEffect(() => {
    if (!activeJourneyLanguageHydrated) return;
    (async () => {
      try {
        if (activeJourneyLanguage) {
          await SecureStore.setItemAsync(
            "digital-polyglot/active-journey-language",
            activeJourneyLanguage
          );
        } else {
          await SecureStore.deleteItemAsync("digital-polyglot/active-journey-language");
        }
      } catch {
        // ignore
      }
    })();
  }, [activeJourneyLanguage, activeJourneyLanguageHydrated]);

  // Mantener `activeJourneyLanguage` (la fuente de verdad del contenido)
  // sincronizado con `activeJourney?.language` (la fuente de la bandera
  // y del header) en CADA hydrate, no solo en el primero.
  //
  // Bug histórico (cold start): SecureStore traía Italian y Clerk traía
  // un activeJourneyId alemán. El pill mostraba la bandera alemana y el
  // contenido cargaba italiano. El fix anterior corría una vez por
  // sesión (`hasAutoPickedLanguageRef`), así que cualquier rehidratación
  // posterior (token refresh, race con el POST de switch, disk-restore)
  // volvía a desincronizar y ya no se reconciliaba. Ahora corre cada
  // vez que detecta mismatch — el backend sigue ganando, pero el flag y
  // el contenido nunca se separan.
  useEffect(() => {
    if (!didHydratePreferences) return;
    const backendLang = activeJourney?.language?.trim() ?? null;
    if (backendLang) {
      const sameLang =
        activeJourneyLanguage &&
        activeJourneyLanguage.toLowerCase() === backendLang.toLowerCase();
      if (!sameLang) setActiveJourneyLanguage(backendLang);
      return;
    }
    if (preferences.targetLanguages.length === 1 && !activeJourneyLanguage) {
      setActiveJourneyLanguage(preferences.targetLanguages[0]);
    }
  }, [
    didHydratePreferences,
    preferences.targetLanguages,
    activeJourneyLanguage,
    activeJourney,
  ]);

  // If we restored a language from SecureStore, re-fetch the journey with that
  // explicit language so the initial (no-param) fetch doesn't overwrite it with
  // the server-side fallback.
  useEffect(() => {
    if (!activeJourneyLanguageHydrated) return;
    if (!sessionToken) return;
    if (!activeJourneyLanguage) return;
    if (remoteJourney?.language && remoteJourney.language.toLowerCase() === activeJourneyLanguage.toLowerCase()) {
      return;
    }
    // Silent reconciliation: don't clear the previously-rendered payload; we
    // only want the new one to seamlessly replace it when it arrives.
    void loadJourneyForLanguage(activeJourneyLanguage, { clearPrevious: false });
  }, [activeJourneyLanguageHydrated, activeJourneyLanguage, sessionToken, remoteJourney?.language, loadJourneyForLanguage]);

  // Force-refresh the journey payload every time the user enters the
  // journey screen. Without this, the cached payload (from disk or
  // previous session) wins forever — including stale unlock state
  // from when the user had a `journeyPlacementLevel` set in Clerk
  // that has since been removed. The cached version still renders
  // immediately for snappy UX; this just guarantees a fresh fetch
  // races behind it and replaces the data with reality.
  const lastJourneyFreshFetchRef = useRef<{ key: string; ts: number } | null>(null);
  useEffect(() => {
    // Journey path now lives in the "home" key after the IA swap.
    if (activeScreen !== "home") return;
    if (!sessionToken) return;
    if (!activeJourneyLanguage) return;
    const key = activeJourneyLanguage.toLowerCase();
    const now = Date.now();
    // Throttle: don't re-fetch if we just refreshed under 30 seconds
    // ago. A user toggling tabs quickly shouldn't hammer the API.
    // Excepción: si el cache está vacío de stories (p.ej. el primer
    // fetch global trajo solo el shell sin contenido), saltamos el
    // throttle y forzamos otro fetch — caso reportado: "primera vez
    // solo se veían los temas pero no las historias, tuve que matar
    // la app y volver a entrar".
    // Throttle bajado de 30 s a 4 s. Con 30 s, después de un fix
    // server-side el cliente seguía mostrando el cache stale durante
    // medio minuto entre toques al journey, lo que confundía al usuario
    // ("la next sigue abajo"). 4 s es suficiente para evitar hammering
    // y permite ver fixes server-side casi inmediatamente.
    const prev = lastJourneyFreshFetchRef.current;
    if (prev && prev.key === key && now - prev.ts < 4_000) return;
    lastJourneyFreshFetchRef.current = { key, ts: now };
    void loadJourneyForLanguage(activeJourneyLanguage, { clearPrevious: false });
  }, [activeScreen, sessionToken, activeJourneyLanguage, loadJourneyForLanguage]);

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
        const normalizedTargetLanguages = normalizeLanguageSelection(next.targetLanguages ?? []);
        const resolvedJourneyFocus =
          normalizeJourneyFocusPreference(next.journeyFocus) ??
          getJourneyFocusFromLearningGoal(normalizeLearningGoal(next.learningGoal));
        const resolvedPreferredVariant = next.preferredVariant ?? null;
        const resolvedPreferredLevel = next.preferredLevel ?? null;
        // Backfill the multi-journey list when the server hasn't been
        // migrated yet (or returned an empty array): one journey per
        // language, with the legacy single-focus / variant / level
        // applied to the primary entry. Once we ship the server-side
        // model, the `next.journeys` branch takes over.
        const remoteJourneys = Array.isArray((next as { journeys?: unknown }).journeys)
          ? ((next as { journeys?: Journey[] }).journeys ?? [])
          : [];
        const remoteActiveId =
          typeof (next as { activeJourneyId?: unknown }).activeJourneyId === "string"
            ? ((next as { activeJourneyId?: string }).activeJourneyId ?? null)
            : null;
        const synthesized = synthesizeJourneysFromLegacy({
          targetLanguages: normalizedTargetLanguages,
          preferredVariant: resolvedPreferredVariant,
          preferredLevel: resolvedPreferredLevel,
          journeyFocus: resolvedJourneyFocus,
        });
        const journeys = remoteJourneys.length > 0 ? remoteJourneys : synthesized.journeys;
        const activeJourneyId = remoteActiveId ?? synthesized.activeJourneyId;
        const normalized: MobilePreferences = {
          targetLanguages: normalizedTargetLanguages,
          interests: normalizeInterestSelection(next.interests ?? []),
          preferredLevel: resolvedPreferredLevel,
          preferredRegion: next.preferredRegion ?? null,
          preferredVariant: resolvedPreferredVariant,
          learningGoal: normalizeLearningGoal(next.learningGoal),
          journeyFocus: resolvedJourneyFocus,
          dailyMinutes: normalizeDailyMinutes(next.dailyMinutes),
          remindersEnabled: normalizeRemindersEnabled(next.remindersEnabled),
          reminderHour: normalizeReminderHour(next.reminderHour),
          journeyPlacementLevel:
            typeof next.journeyPlacementLevel === "string" ? next.journeyPlacementLevel : null,
          onboardingSurveyCompletedAt:
            typeof next.onboardingSurveyCompletedAt === "string" ? next.onboardingSurveyCompletedAt : null,
          onboardingTourCompletedAt:
            typeof next.onboardingTourCompletedAt === "string" ? next.onboardingTourCompletedAt : null,
          journeys,
          activeJourneyId,
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
          handleUnauthorizedSessionRef.current();
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
  }, [sessionToken]);

  // Daily-quest celebration effects removed alongside the toast — the
  // related state (activeGamificationCelebration, dismissed IDs, the
  // celebrationAnim ref, CelebrationBurst, dismissGamificationCelebration)
  // is left in place as dead code to keep this diff focused; a follow-up
  // pass can sweep it once we're sure we don't bring the toast back in
  // a different form.

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
      // Cargamos el offlineSnapshot Y el journey cache de disco en
      // paralelo. Antes este efecto sobreescribía el journey cache
      // con `{}` para descartar un pointer "next" stale tras un
      // backend change; el efecto colateral fatal era que cold-start
      // offline NUNCA tenía journey para mostrar (la app entraba al
      // shell pero el path quedaba vacío).
      // Solución: NO destruir el cache. Cuando el usuario está
      // online, el fetch fresco sobreescribe el cache stale por
      // entries actualizados. Cuando está offline, el cache es lo
      // único que tenemos para renderear el path.
      const [snapshot, journeyCache] = await Promise.all([
        loadOfflineSnapshot(PREVIEW_OFFLINE_USER_ID),
        loadJourneyCache<MobileJourneyPayload>(PREVIEW_OFFLINE_USER_ID),
      ]);
      if (cancelled) return;
      setOfflineSnapshot(snapshot);
      if (journeyCache) {
        for (const [language, payload] of Object.entries(journeyCache)) {
          if (payload) journeyCacheByLanguageRef.current.set(language, payload);
        }
        // Seed inmediato del journey state desde el cache para que el
        // path renderice cold-start offline. Sin esto, el ref tenía el
        // payload pero `remoteJourney` quedaba null hasta que el fetch
        // online resolviera (que offline nunca pasa). Tomamos la
        // primera lengua disponible; si después el flujo online setea
        // otra activa, la sobreescribe.
        const firstEntry = Object.entries(journeyCache).find(
          ([, payload]) => payload != null
        );
        if (firstEntry) {
          const [language, payload] = firstEntry;
          setRemoteJourney(payload);
          setActiveJourneyLanguage((current) => current ?? language);
        }
      }
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
  // Lookup adicional por storySlug. CRÍTICO: las stories descargadas
  // desde el journey (vía /api/standalone-stories) se guardan con el
  // storyId del endpoint standalone, que NO coincide con el storyId
  // del journey API. El reader abre la story con el id del journey y
  // el lookup por id no encontraba el offline copy → cover y audio
  // caían a las URLs HTTP y fallaban offline. El slug es estable
  // entre ambos endpoints.
  const offlineStoriesBySlug = useMemo(
    () =>
      new Map(
        (offlineSnapshot?.stories ?? [])
          .filter((story) => typeof story.storySlug === "string" && story.storySlug.length > 0)
          .map((story) => [story.storySlug as string, story])
      ),
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

  /**
   * Words the user got wrong during a NON-checkpoint round. Lets the
   * "session complete" panel offer "Review wrong answers" so the user
   * can retry only the misses instead of replaying every exercise.
   * Empty in the checkpoint flow (that one already has its own
   * `checkpointMissedItems`).
   */
  const practiceMissedItems = useMemo(() => {
    if (
      practiceLaunchContext.source === "journey" &&
      practiceLaunchContext.kind === "checkpoint"
    ) {
      return [] as PracticeFavoriteItem[];
    }
    const wordMap = new Map(
      (practiceSeedItems ?? []).map((item) => [normalizePracticeWord(item.word), item] as const)
    );
    const missed = new Set<string>();
    for (const [word, score] of Object.entries(practiceReviewScores)) {
      if (score === "again") missed.add(word);
    }
    return Array.from(missed)
      .map((word) => wordMap.get(word))
      .filter((item): item is PracticeFavoriteItem => Boolean(item));
  }, [practiceLaunchContext, practiceReviewScores, practiceSeedItems]);
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
          const offlineStory =
            (selection.story.slug
              ? offlineStoriesBySlug.get(selection.story.slug)
              : undefined) ?? offlineStoriesById.get(story.storyId);
          return { remote: story, selection, offlineStory };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null),
    [offlineStoriesById, offlineStoriesBySlug, remoteStories]
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
  // Journeys-first: el listado de favoritos por defecto se acota al
  // idioma del journey activo. La lógica anterior mezclaba palabras
  // de todos los idiomas, lo cual diluía el foco del journey actual.
  const activeJourneyLanguageLower = useMemo(() => {
    return (activeJourney?.language ?? "").trim().toLowerCase();
  }, [activeJourney]);
  const journeyScopedFavoriteCards = useMemo(() => {
    if (!activeJourneyLanguageLower) return favoriteCards;
    return favoriteCards.filter(
      ({ item }) => (item.language ?? "").trim().toLowerCase() === activeJourneyLanguageLower
    );
  }, [favoriteCards, activeJourneyLanguageLower]);
  // Slugs de las stories que están en el nivel actual del journey
  // activo (primer nivel desbloqueado). Sirven como criterio para el
  // filtro "Related" — palabras saved que viven en stories cercanas
  // a donde el usuario está parado en el path.
  const currentLevelStorySlugs = useMemo(() => {
    const set = new Set<string>();
    if (!remoteJourney?.tracks?.length) return set;
    const variantId = getJourneyVariantFromPreferences(
      remoteJourney.language ?? "Spanish",
      preferences.preferredVariant,
      preferences.preferredRegion
    );
    const track =
      remoteJourney.tracks.find((t) => t.id === variantId) ?? remoteJourney.tracks[0] ?? null;
    if (!track) return set;
    const level = track.levels.find((l) => l.unlocked) ?? track.levels[0] ?? null;
    if (!level) return set;
    for (const topic of level.topics ?? []) {
      for (const story of topic.stories ?? []) {
        if (story.storySlug) set.add(story.storySlug);
      }
    }
    return set;
  }, [remoteJourney, preferences.preferredVariant, preferences.preferredRegion]);
  const nowMillis = useMemo(() => Date.now(), [favoriteWords]);
  const journeyKindFilteredCards = useMemo(() => {
    if (favoritePracticeModeKind === "due") {
      return journeyScopedFavoriteCards.filter(({ item }) => {
        if (!item.nextReviewAt) return false;
        const ts = Date.parse(item.nextReviewAt);
        return Number.isFinite(ts) && ts <= nowMillis;
      });
    }
    if (favoritePracticeModeKind === "related") {
      if (currentLevelStorySlugs.size === 0) return [];
      return journeyScopedFavoriteCards.filter(
        ({ item }) => item.storySlug && currentLevelStorySlugs.has(item.storySlug)
      );
    }
    return journeyScopedFavoriteCards;
  }, [
    journeyScopedFavoriteCards,
    favoritePracticeModeKind,
    currentLevelStorySlugs,
    nowMillis,
  ]);
  const filteredFavoriteCards = useMemo(
    () =>
      journeyKindFilteredCards.filter(({ item }) =>
        selectedFavoriteType === "all" ? true : getFavoriteType(item) === selectedFavoriteType
      ),
    [journeyKindFilteredCards, selectedFavoriteType]
  );
  // Counts mostrados en cada pill (siempre journey-scoped, sin importar
  // el tipo seleccionado, para que el usuario vea cuántas palabras hay
  // en cada modo antes de tocar).
  const journeyDueCount = useMemo(() => {
    return journeyScopedFavoriteCards.reduce((n, { item }) => {
      if (!item.nextReviewAt) return n;
      const ts = Date.parse(item.nextReviewAt);
      return Number.isFinite(ts) && ts <= nowMillis ? n + 1 : n;
    }, 0);
  }, [journeyScopedFavoriteCards, nowMillis]);
  const journeyAllCount = journeyScopedFavoriteCards.length;
  const journeyRelatedCount = useMemo(() => {
    if (currentLevelStorySlugs.size === 0) return 0;
    return journeyScopedFavoriteCards.reduce(
      (n, { item }) =>
        item.storySlug && currentLevelStorySlugs.has(item.storySlug) ? n + 1 : n,
      0
    );
  }, [journeyScopedFavoriteCards, currentLevelStorySlugs]);
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
          coverUrl: getCoverUrl(item.story.cover ?? item.story.coverUrl ?? item.book.cover),
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
          coverUrl: getCoverUrl(selection.story.cover ?? selection.story.coverUrl ?? selection.book.cover),
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
        subtitle: formatLanguageAndRegion(story.language ?? "", story.region ?? "") || "Standalone story",
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
          subtitle: formatLanguageAndRegion(story.language ?? "", story.region ?? "") || "Standalone story",
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
        { key: "journey", label: "Library" },
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
      setActiveScreen("home");
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
    storyOpenedAtRef.current = Date.now();
    // Warm up the practice items in the background so that hitting
    // "Start practice" at the end of the story is instant. The fetch
    // happens once per slug per session; result lives in a ref.
    prefetchStoryPracticeItems(selection);
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

    // Start prefetching the big reader cover at the same size the reader will
    // render it. This overlaps the image network transfer with the
    // standalone-story fetch and the navigation transition, so by the time
    // ReaderScreen mounts the cover is usually already cached locally.
    if (story.coverUrl) {
      void Image.prefetch(getCoverUrl(story.coverUrl, 640)).catch(() => undefined);
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

  // Throttle state updates from the reader scroll to at most one per
  // 2.5 s + a guaranteed final update ~1 s after the last scroll event.
  // Before this, every 3 % of scroll ratio fired a setReadingProgress
  // which re-rendered the 13k-line Shell in the middle of scrolling,
  // making the reader feel sluggish on iOS.
  const lastRecordProgressRef = useRef<{ storyId: string | null; at: number }>({
    storyId: null,
    at: 0,
  });
  const pendingRecordProgressRef = useRef<{
    timer: ReturnType<typeof setTimeout> | null;
    args: { book: Book; story: Story; details?: { progressRatio?: number; currentBlockIndex?: number; totalBlocks?: number } } | null;
  }>({ timer: null, args: null });

  const commitRecordProgress = useCallback(
    (
      book: Book,
      story: Story,
      details?: { progressRatio?: number; currentBlockIndex?: number; totalBlocks?: number }
    ) => {
      lastRecordProgressRef.current = { storyId: story.id, at: Date.now() };
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
    },
    []
  );

  const recordProgress = useCallback(
    (
      book: Book,
      story: Story,
      details?: { progressRatio?: number; currentBlockIndex?: number; totalBlocks?: number }
    ) => {
      const now = Date.now();
      const last = lastRecordProgressRef.current;
      // If the same story was persisted recently, queue a trailing update
      // and let later calls replace the args (keeps only the latest).
      if (last.storyId === story.id && now - last.at < 2500) {
        pendingRecordProgressRef.current.args = { book, story, details };
        if (!pendingRecordProgressRef.current.timer) {
          pendingRecordProgressRef.current.timer = setTimeout(() => {
            const queued = pendingRecordProgressRef.current.args;
            pendingRecordProgressRef.current.timer = null;
            pendingRecordProgressRef.current.args = null;
            if (queued) {
              commitRecordProgress(queued.book, queued.story, queued.details);
            }
          }, 1000);
        }
        return;
      }
      // Cold call or different story: commit immediately.
      if (pendingRecordProgressRef.current.timer) {
        clearTimeout(pendingRecordProgressRef.current.timer);
        pendingRecordProgressRef.current.timer = null;
        pendingRecordProgressRef.current.args = null;
      }
      commitRecordProgress(book, story, details);
    },
    [commitRecordProgress]
  );

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
      const normalizedTargetLanguages = normalizeLanguageSelection(next.targetLanguages ?? []);
      const resolvedJourneyFocus =
        normalizeJourneyFocusPreference(next.journeyFocus) ??
        getJourneyFocusFromLearningGoal(normalizeLearningGoal(next.learningGoal));
      const resolvedPreferredVariant = next.preferredVariant ?? null;
      const resolvedPreferredLevel = next.preferredLevel ?? null;
      // Server may not echo journeys yet — we keep the local list if
      // the response omits it, so saving global prefs (interests,
      // reminders, etc.) doesn't wipe the multi-journey state.
      const remoteJourneys = Array.isArray((next as { journeys?: unknown }).journeys)
        ? ((next as { journeys?: Journey[] }).journeys ?? [])
        : null;
      const remoteActiveId =
        typeof (next as { activeJourneyId?: unknown }).activeJourneyId === "string"
          ? ((next as { activeJourneyId?: string }).activeJourneyId ?? null)
          : null;
      const journeys = remoteJourneys ?? preferences.journeys;
      const activeJourneyId = remoteActiveId ?? preferences.activeJourneyId;
      const normalized: MobilePreferences = {
        targetLanguages: normalizedTargetLanguages,
        interests: normalizeInterestSelection(next.interests ?? []),
        preferredLevel: resolvedPreferredLevel,
        preferredRegion: next.preferredRegion ?? null,
        preferredVariant: resolvedPreferredVariant,
        learningGoal: normalizeLearningGoal(next.learningGoal),
        journeyFocus: resolvedJourneyFocus,
        dailyMinutes: normalizeDailyMinutes(next.dailyMinutes),
        remindersEnabled: normalizeRemindersEnabled(next.remindersEnabled),
        reminderHour: normalizeReminderHour(next.reminderHour),
        journeyPlacementLevel:
          typeof next.journeyPlacementLevel === "string" ? next.journeyPlacementLevel : null,
        onboardingSurveyCompletedAt:
          typeof next.onboardingSurveyCompletedAt === "string" ? next.onboardingSurveyCompletedAt : null,
        onboardingTourCompletedAt:
          typeof next.onboardingTourCompletedAt === "string" ? next.onboardingTourCompletedAt : null,
        journeys,
        activeJourneyId,
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
      const normalizedTargetLanguages = normalizeLanguageSelection(next.targetLanguages ?? []);
      const resolvedJourneyFocus =
        normalizeJourneyFocusPreference(next.journeyFocus) ??
        getJourneyFocusFromLearningGoal(normalizeLearningGoal(next.learningGoal));
      const resolvedPreferredVariant = next.preferredVariant ?? null;
      const resolvedPreferredLevel = next.preferredLevel ?? null;
      const remoteJourneys = Array.isArray((next as { journeys?: unknown }).journeys)
        ? ((next as { journeys?: Journey[] }).journeys ?? [])
        : [];
      const remoteActiveId =
        typeof (next as { activeJourneyId?: unknown }).activeJourneyId === "string"
          ? ((next as { activeJourneyId?: string }).activeJourneyId ?? null)
          : null;
      // Onboarding is the moment the user first declares languages,
      // so we always synthesize from the freshly-saved targetLanguages
      // when the server hasn't rolled out the journeys field yet.
      const synthesized = synthesizeJourneysFromLegacy({
        targetLanguages: normalizedTargetLanguages,
        preferredVariant: resolvedPreferredVariant,
        preferredLevel: resolvedPreferredLevel,
        journeyFocus: resolvedJourneyFocus,
      });
      const journeys = remoteJourneys.length > 0 ? remoteJourneys : synthesized.journeys;
      const activeJourneyId = remoteActiveId ?? synthesized.activeJourneyId;
      const normalized: MobilePreferences = {
        targetLanguages: normalizedTargetLanguages,
        interests: normalizeInterestSelection(next.interests ?? []),
        preferredLevel: resolvedPreferredLevel,
        preferredRegion: next.preferredRegion ?? null,
        preferredVariant: resolvedPreferredVariant,
        learningGoal: normalizeLearningGoal(next.learningGoal),
        journeyFocus: resolvedJourneyFocus,
        dailyMinutes: normalizeDailyMinutes(next.dailyMinutes),
        remindersEnabled: normalizeRemindersEnabled(next.remindersEnabled),
        reminderHour: normalizeReminderHour(next.reminderHour),
        journeyPlacementLevel:
          typeof next.journeyPlacementLevel === "string" ? next.journeyPlacementLevel : null,
        onboardingSurveyCompletedAt:
          typeof next.onboardingSurveyCompletedAt === "string" ? next.onboardingSurveyCompletedAt : null,
        onboardingTourCompletedAt:
          typeof next.onboardingTourCompletedAt === "string" ? next.onboardingTourCompletedAt : null,
        journeys,
        activeJourneyId,
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
      if (!standalone) {
        setLockedStoryHint("No se pudo descargar: el servidor no devolvió datos.");
        return;
      }
      const nextSnapshot = await saveStandaloneStoryOffline(
        PREVIEW_OFFLINE_USER_ID,
        standalone
      );
      setOfflineSnapshot(nextSnapshot);
      // Verificación dura: el snapshot dice "descargada" pero ¿los
      // archivos realmente quedaron en disco? Si `cacheRemoteFile`
      // falló silenciosamente (red intermitente, server error, URL
      // muerta), `localCoverUri` y `localAudioUri` pueden ser null y
      // la story quedaba marcada como descargada sin tener los media.
      // Avisamos al usuario en lugar de fingir éxito.
      const saved = nextSnapshot.stories.find((s) => s.storyId === standalone.id);
      const coverOk = Boolean(saved?.localCoverUri);
      const audioOk = Boolean(saved?.localAudioUri);
      if (!coverOk || !audioOk) {
        const missing = [
          !coverOk ? "imagen" : null,
          !audioOk ? "audio" : null,
        ]
          .filter(Boolean)
          .join(" + ");
        setLockedStoryHint(
          `Descarga incompleta (${missing} no se pudo guardar). Verifica tu conexión y vuelve a intentar.`
        );
      }
    } catch (error) {
      console.error("[mobile journey] failed to download journey story offline", error);
      setLockedStoryHint("No se pudo descargar la historia. Verifica tu conexión.");
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
    showDebug(`tap: ${story.storySlug ?? "no-slug"}`);
    if (!story.storySlug) {
      showDebug("abort: no slug");
      // Surface the failure instead of silently doing nothing —
      // the user reported "tap and nothing happens", which traced
      // back to journey stories whose slug never made it into the
      // payload (a data inconsistency on the Studio side).
      setLockedStoryHint("Esta historia aún no está disponible. Prueba con otra.");
      return;
    }

    // Warm the large reader cover while we fetch the story body + navigate.
    if (story.coverUrl) {
      void Image.prefetch(getCoverUrl(story.coverUrl, 640)).catch(() => undefined);
    }

    // Use locally cached version if available. If the cached copy is missing
    // vocab (older downloads saved before vocabRaw was persisted), try the
    // network first so the reader can still highlight words; if the network
    // fails we fall back to the local text-only copy further down.
    // Lookup primero por slug (estable entre journey y standalone API):
    // los IDs difieren porque journey usa Postgres id y standalone usa
    // otra serie. El slug es el único identificador estable.
    const offlineCopy =
      (story.storySlug
        ? offlineStoriesBySlug.get(story.storySlug)
        : undefined) ??
      offlineSnapshot?.stories.find((s) => s.storySlug === story.storySlug);
    const hasOfflineVocab =
      typeof offlineCopy?.vocabRaw === "string" && offlineCopy.vocabRaw.trim().length > 0;
    showDebug(
      `lookup: snap=${offlineSnapshot?.stories.length ?? 0} found=${offlineCopy ? "Y" : "N"} text=${offlineCopy?.text ? "Y" : "N"} vocab=${hasOfflineVocab ? "Y" : "N"}`
    );
    // Si la story está descargada (tiene text local), abrir directo
    // sin pasar por fetch network. Antes el flow exigía vocab además
    // del text, y caía al fetch online cuando faltaba vocab; offline
    // ese fetch fallaba siempre y aunque el catch tenía fallback,
    // cualquier inconsistencia silenciosa del flow podía quedar el
    // tap sin abrir nada. Saltarse el round-trip cuando tenemos
    // datos locales es lo más robusto.
    if (offlineCopy?.text) {
      const standalone: MobileStandaloneStory = {
        id: offlineCopy.storyId,
        slug: offlineCopy.storySlug ?? story.storySlug,
        title: offlineCopy.title,
        text: offlineCopy.text,
        vocabRaw: offlineCopy.vocabRaw ?? null,
        language: offlineCopy.language ?? null,
        variant: offlineCopy.variant ?? null,
        region: offlineCopy.region ?? null,
        level: offlineCopy.level ?? null,
        cefrLevel: offlineCopy.cefrLevel ?? null,
        topic: offlineCopy.topic ?? null,
        coverUrl: offlineCopy.coverUrl ?? null,
        audioUrl: offlineCopy.audioUrl ?? null,
        localCoverUri: offlineCopy.localCoverUri ?? null,
        localAudioUri: offlineCopy.localAudioUri ?? null,
      };
      openSelection(createSelectionFromStandaloneStory(standalone));
      return;
    }

    // Show the reader skeleton if the network fetch takes more than
    // ~150ms so a fast response doesn't flash a placeholder. Clear it
    // on every exit path below (success, no-result, network failure).
    const skeletonTimer = setTimeout(() => setOpeningStoryId(story.id), 150);
    showDebug(`fetch start: token=${sessionToken ? "Y" : "N"}`);
    try {
      const payload = await apiFetch<{ stories?: MobileStandaloneStory[] }>({
        baseUrl: mobileConfig.apiBaseUrl,
        path: `/api/standalone-stories?slugs=${encodeURIComponent(story.storySlug)}`,
        token: sessionToken,
        timeoutMs: 15000,
      });
      const standalone = payload.stories?.[0];
      showDebug(`fetch ok: ${standalone ? "got story" : "no story in payload"}`);
      if (!standalone) {
        clearTimeout(skeletonTimer);
        setOpeningStoryId(null);
        // The journey points at this slug but the standalone
        // catalog doesn't have it. Tell the user instead of
        // failing silently.
        setLockedStoryHint("No se pudo cargar esta historia. Inténtalo de nuevo.");
        return;
      }
      clearTimeout(skeletonTimer);
      setOpeningStoryId(null);
      showDebug("openSelection (network)");
      openSelection(createSelectionFromStandaloneStory(standalone));
      // If this story is already downloaded offline but was saved before
      // vocabRaw was persisted, backfill the snapshot so next offline open
      // has highlights without needing a re-download.
      if (offlineCopy && !hasOfflineVocab && typeof standalone.vocabRaw === "string") {
        try {
          const next = await saveStandaloneStoryOffline(PREVIEW_OFFLINE_USER_ID, standalone);
          setOfflineSnapshot(next);
        } catch (err) {
          console.warn("[mobile journey] failed to backfill vocab into offline copy", err);
        }
      }
    } catch (error) {
      clearTimeout(skeletonTimer);
      setOpeningStoryId(null);
      const errMsg = error instanceof Error ? error.message : String(error);
      showDebug(`fetch fail: ${errMsg.slice(0, 40)}`);
      console.error("[mobile journey] failed to open journey story", error);
      // We're likely offline AND the local copy has no vocab. Better to open
      // the text-only version than to do nothing.
      if (offlineCopy?.text) {
        showDebug("openSelection (fallback)");
        const standalone: MobileStandaloneStory = {
          id: offlineCopy.storyId,
          slug: offlineCopy.storySlug ?? story.storySlug,
          title: offlineCopy.title,
          text: offlineCopy.text,
          vocabRaw: offlineCopy.vocabRaw ?? null,
          language: offlineCopy.language ?? null,
          variant: offlineCopy.variant ?? null,
          region: offlineCopy.region ?? null,
          level: offlineCopy.level ?? null,
          cefrLevel: offlineCopy.cefrLevel ?? null,
          topic: offlineCopy.topic ?? null,
          coverUrl: offlineCopy.coverUrl ?? null,
          audioUrl: offlineCopy.audioUrl ?? null,
          localCoverUri: offlineCopy.localCoverUri ?? null,
          localAudioUri: offlineCopy.localAudioUri ?? null,
        };
        openSelection(createSelectionFromStandaloneStory(standalone));
      } else {
        showDebug("dead-end: no offline + no net");
        // Sin offline copy y sin red: feedback claro al usuario en
        // lugar de tap silencioso. Antes el catch terminaba sin hacer
        // nada visible y el reporte era "no deja hacer tap en las
        // historias" — el tap funcionaba, simplemente no había nada
        // que abrir.
        setLockedStoryHint(
          "Esta historia no está descargada. Conéctate a internet o descárgala primero."
        );
      }
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
            setActiveScreen("home");
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
            setActiveScreen("home");
            setSelectedJourneyLevelId(nextLevel.id);
            setJourneyDetailTopicId(null);
            setJourneyMilestone(null);
          },
        };
      }

      return {
        title: "Checkpoint cleared",
        body: `${topic.label} is fully cleared.`,
        cta: "Back to journey",
        onPress: () => {
          setActiveScreen("home");
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
        cta: topic.checkpointPassed ? "Back to journey" : "Start checkpoint",
        onPress: () => {
          setActiveScreen("home");
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
    // Warm up the iOS voice cache once so the first listening prompt
    // already uses an Enhanced/Premium voice instead of the default.
    void ensureBestVoicesLoaded();
    setActivePracticeMode(mode);
    setPracticeLoadError(null);
    setPracticeExercises(exercises);
    setPracticeIndex(0);
    setPracticeScore(0);
    setPracticeSelectedOption(null);
    setPracticeRevealed(false);
    setPracticeTimedOut(false);
    setPracticeComplete(false);
    setPracticeLastResult(null);
    setPracticeSessionStreak(0);
    setPracticeReviewScores({});
    setPracticeCheckpointToken(null);
    setPracticeCheckpointResponses({});
    setPracticeCheckpointSaveState("idle");
    setPracticeJourneyReviewMeta(null);
    setActiveMatchWord(null); setWrongMatchAttempt(null);
    setMatchedWords([]);
    setLastPracticeActivityAt(new Date().toISOString());
    setMenuOpen(false);
    // Arranca con countdown activo + pausa off + timer en 10 seg.
    // Estos states se reinician en cada apertura para que la sesión
    // siempre empiece "limpia".
    setPracticeCountdownActive(true);
    setPracticePaused(false);
    setPracticeTimerRemaining(10);
    // Reset del ref del autoplay. Sin esto, si la sesión anterior
    // terminó en un ejercicio cuyo id se repite por azar en la nueva
    // (improbable pero posible con palabras compartidas), el autoplay
    // no dispararía. Más importante: garantiza que la primera vez
    // SIEMPRE suene aunque el ref tenga basura de un mount previo del
    // shell. Hay que llamarlo aquí (no en el effect) porque el effect
    // mismo escribe el ref y nunca lo resetea.
    lastAutoplayedExerciseIdRef.current = null;
    // Parar cualquier audio del reader que pueda estar sonando si
    // venimos directo del end-of-story prompt: el story sound puede
    // continuar reproduciéndose en background y enmascarar el
    // autoplay del primer ejercicio.
    void stopPracticeContextClip();
    void stopPracticeHqClip();
    getOptionalSpeechModule()?.stop();
  }

  /**
   * Build the URL params for /api/story-practice. Shared between the
   * background prefetch and the live fetch so the cache key matches.
   */
  function buildStoryPracticePath(selection: ReaderSelection): string {
    const params = new URLSearchParams({ storySlug: selection.story.slug });
    const hasRealBookSlug =
      selection.book.slug &&
      selection.book.slug !== "standalone-stories" &&
      !selection.book.slug.startsWith("generated-book-");
    if (hasRealBookSlug) {
      params.set("bookSlug", selection.book.slug);
    }
    return `/api/story-practice?${params.toString()}`;
  }

  /**
   * Background fetch kicked off when the reader opens. Stores the
   * resulting items so `openStoryPractice` is instant when the user
   * taps the end-of-story prompt. Idempotent: a second call for the
   * same slug while the first is still in flight is a no-op.
   */
  function prefetchStoryPracticeItems(selection: ReaderSelection) {
    if (!sessionToken) return;
    const slug = selection.story.slug;
    if (!slug) return;
    if (practicePrefetchBySlugRef.current.has(slug)) return;
    if (practicePrefetchInFlightRef.current.has(slug)) return;
    practicePrefetchInFlightRef.current.add(slug);
    void apiFetch<{ items: PracticeFavoriteItem[] }>({
      baseUrl: mobileConfig.apiBaseUrl,
      path: buildStoryPracticePath(selection),
      token: sessionToken,
    })
      .then((payload) => {
        const items = Array.isArray(payload.items) ? payload.items : [];
        practicePrefetchBySlugRef.current.set(slug, items);
      })
      .catch(() => {
        // Swallow — openStoryPractice will retry with a live fetch and
        // surface the error there if it still fails.
      })
      .finally(() => {
        practicePrefetchInFlightRef.current.delete(slug);
      });
  }

  /**
   * Apply a loaded set of practice items to the practice-session
   * state. Pulled out of openStoryPractice so the prefetch path and
   * the live-fetch path share the exact same setter sequence.
   */
  function commitStoryPracticeItems(selection: ReaderSelection, items: PracticeFavoriteItem[]) {
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
    setPracticePreviousScreen(activeScreen);
    setPracticeLoadError(null);
    setActivePracticeMode("context");
    setPracticeExercises(exercises);
    setPracticeIndex(0);
    setPracticeScore(0);
    setPracticeSelectedOption(null);
    setPracticeRevealed(false);
    setPracticeTimedOut(false);
    setPracticeComplete(false);
    setPracticeLastResult(null);
    setPracticeSessionStreak(0);
    setPracticeReviewScores({});
    setPracticeCheckpointToken(null);
    setPracticeCheckpointResponses({});
    setPracticeCheckpointSaveState("idle");
    setPracticeJourneyReviewMeta(null);
    setActiveMatchWord(null); setWrongMatchAttempt(null);
    setMatchedWords([]);
    setSelection(null);
    setActiveScreen("practice");
  }

  async function openStoryPractice(selection: ReaderSelection) {
    if (!sessionToken) {
      onRequestSignIn?.();
      return;
    }

    // Fast path: items already in cache from the reader's prefetch.
    const cached = practicePrefetchBySlugRef.current.get(selection.story.slug);
    if (cached) {
      commitStoryPracticeItems(selection, cached);
      return;
    }

    // Slow path: user beat the prefetch. Switch to the practice tab
    // immediately with a loading indicator so the reader doesn't sit
    // visible while the network request resolves.
    setPracticeLaunchLoading(true);
    setActivePracticeMode("context");
    setActiveScreen("practice");
    setSelection(null);

    try {
      const payload = await apiFetch<{ items: PracticeFavoriteItem[] }>({
        baseUrl: mobileConfig.apiBaseUrl,
        path: buildStoryPracticePath(selection),
        token: sessionToken,
      });
      const items = Array.isArray(payload.items) ? payload.items : [];
      practicePrefetchBySlugRef.current.set(selection.story.slug, items);
      setPracticeLaunchLoading(false);
      commitStoryPracticeItems(selection, items);
    } catch (error) {
      setPracticeLaunchLoading(false);
      setPracticeSeedItems(null);
      setPracticeLoadError(error instanceof Error ? error.message : "Could not load story practice.");
      setActivePracticeMode(null);
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
      setActiveMatchWord(null); setWrongMatchAttempt(null);
      setMatchedWords([]);
      setActiveScreen("practice");
    } catch (error) {
      setPracticeSeedItems(null);
      setPracticeLoadError(error instanceof Error ? error.message : "Could not load journey practice.");
      setActiveScreen("practice");
    }
  }

  // Back-arrow handler. Si la sesión ya está completa, cerramos directo
  // (no hay nada que ofrecer). En cualquier otro caso mostramos el
  // popup de confirm: el usuario abrió Practice intencionalmente y un
  // tap accidental en back no debería cerrar la sesión sin chance de
  // reanudar, ni siquiera en el primer ejercicio antes de tapear nada
  // (el countdown 3-2-1 ya gastó su atención, lo último que queremos
  // es perderla por un tap perdido).
  //
  // Pausamos la sesión al abrir el sheet para que el timer no siga
  // corriendo mientras el usuario decide.
  function requestClosePracticeSession() {
    if (practiceComplete) {
      closePracticeSession();
      return;
    }
    if (!activePracticeMode) {
      closePracticeSession();
      return;
    }
    setPracticePaused(true);
    setPracticeExitConfirmVisible(true);
  }

  function confirmExitPracticeSession() {
    setPracticeExitConfirmVisible(false);
    closePracticeSession();
  }

  function closePracticeSession() {
    getOptionalSpeechModule()?.stop();
    setSpeakingPracticePromptId(null);
    setActivePracticeMode(null);
    setPracticeExitConfirmVisible(false);
    if (practiceLaunchContext.source === "story" && practiceReturnSelection) {
      // If the user actually finished the round we DON'T re-open the story
      // they just read — we send them back to the list (topic detail /
      // library) with the next story glowing, so the natural next action is
      // visible the moment the practice screen clears. If they bailed
      // mid-session we restore the reader so they can keep listening.
      const sourceBook = practiceReturnSelection.book;
      const finishedStoryId = practiceReturnSelection.story.id;
      const finishedIndex = sourceBook.stories.findIndex((s) => s.id === finishedStoryId);
      const nextStory =
        practiceComplete && finishedIndex >= 0 && finishedIndex < sourceBook.stories.length - 1
          ? sourceBook.stories[finishedIndex + 1]
          : null;
      if (nextStory) {
        setSelection(null);
        setActiveScreen(practicePreviousScreen ?? "journey");
        setHighlightedNextStoryId(nextStory.id);
        // Clear the glow after a few seconds so it's an attention cue
        // rather than a permanent decoration.
        setTimeout(() => {
          setHighlightedNextStoryId((current) => (current === nextStory.id ? null : current));
        }, 5000);
      } else {
        // Last story in the book, or the user exited mid-session.
        setSelection(practiceReturnSelection);
        setActiveScreen(practicePreviousScreen ?? "journey");
      }
    } else if (practiceLaunchContext.source === "journey") {
      setActiveScreen("home");
    }
    setPracticeSeedItems(null);
    setPracticeLaunchContext({ source: "favorites" });
    setPracticeReturnSelection(null);
    setPracticePreviousScreen(null);
    setPracticeExercises([]);
    setPracticeIndex(0);
    setPracticeScore(0);
    setPracticeSelectedOption(null);
    setPracticeRevealed(false);
    setPracticeTimedOut(false);
    setPracticeComplete(false);
    setPracticeLastResult(null);
    setPracticeSessionStreak(0);
    setPracticeReviewScores({});
    setPracticeCheckpointToken(null);
    setPracticeCheckpointResponses({});
    setPracticeCheckpointSaveState("idle");
    setPracticeJourneyReviewMeta(null);
    setActiveMatchWord(null); setWrongMatchAttempt(null);
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
      setActiveMatchWord(null); setWrongMatchAttempt(null);
      setMatchedWords([]);
      return;
    }

    setPracticeIndex((current) => current + 1);
    setPracticeSelectedOption(null);
    setPracticeRevealed(false);
    setPracticeTimedOut(false);
    setPracticeLastResult(null);
    setActiveMatchWord(null); setWrongMatchAttempt(null);
    setMatchedWords([]);
  }

  // ─── Practice timer + auto-advance + autoplay del audio ───────────
  //
  // Tres useEffects que cooperan para una sesión "auto-pilot":
  //   1. Reset del timer a 10 seg en cada ejercicio nuevo.
  //   2. Tick del timer cada segundo; al llegar a 0 marca como wrong
  //      (timeout) y revela la respuesta correcta.
  //   3. Auto-advance 1.5 seg después de revelar (manual o por
  //      timeout) → siguiente ejercicio.
  //   4. Autoplay del mejor audio (HQ→TTS) al arrancar cada ejercicio.
  //
  // Todos los effects respetan `practicePaused`: al pausar, el timer
  // se congela, el auto-advance se cancela, y los autoplays no
  // disparan. Tap manual en TTS/Story/HQ sigue funcionando para que
  // el usuario pueda escuchar tranquilo durante la pausa.
  //
  // Tampoco corren durante el countdown 3-2-1 inicial (se respeta
  // `practiceCountdownActive`).

  // (1) Reset del timer cuando cambia el ejercicio actual o cuando
  // arranca una sesión nueva. 10 seg para multiple-choice y match
  // por igual (decisión: igual para todo, simple y predecible).
  useEffect(() => {
    if (!activePracticeMode) return;
    setPracticeTimerRemaining(10);
  }, [practiceIndex, activePracticeMode]);

  // (2) Tick del timer. Solo decrementa cuando hay ejercicio activo,
  // no en countdown, no pausado, no revelado, no completo, y el
  // ejercicio actual es multiple-choice. Match tiene su propio flow
  // de pares con su propia presión de tiempo implícita; meterle un
  // timer global lo descoordinaría. Cuando llega a 0 dispara el
  // timeout-as-wrong en el siguiente effect.
  useEffect(() => {
    if (!activePracticeMode) return;
    if (practiceCountdownActive) return;
    if (practicePaused) return;
    if (practiceRevealed) return;
    if (practiceComplete) return;
    if (practiceTimerRemaining <= 0) return;
    const current = practiceExercises[practiceIndex];
    if (!current || current.kind !== "multiple-choice") return;
    const id = setTimeout(() => {
      setPracticeTimerRemaining((value) => Math.max(0, value - 1));
    }, 1000);
    return () => clearTimeout(id);
  }, [
    activePracticeMode,
    practiceCountdownActive,
    practicePaused,
    practiceRevealed,
    practiceComplete,
    practiceTimerRemaining,
    practiceExercises,
    practiceIndex,
  ]);

  // (3) Cuando el timer llega a 0 sin haber revelado: marcar como
  // timeout (wrong por defecto). Replicamos el flow completo de una
  // respuesta incorrecta manual: revelar, romper la racha de la
  // sesión, anotar "again" en `practiceReviewScores` (alimenta el SRS
  // del backend), y disparar el sonido de feedback negativo. Sin esto
  // el timeout no actualizaba el SRS y la palabra quedaba due
  // permanentemente. El effect (4) de auto-advance se encarga del
  // paso al siguiente ejercicio. Sólo aplica a multiple-choice; el
  // ejercicio de match tiene su propio flujo de pares y no entra al
  // contador de timer global (filtrado en effect (1) abajo).
  useEffect(() => {
    if (!activePracticeMode) return;
    if (practiceCountdownActive) return;
    if (practicePaused) return;
    if (practiceRevealed) return;
    if (practiceComplete) return;
    if (practiceTimerRemaining > 0) return;
    const current = practiceExercises[practiceIndex];
    if (!current || current.kind !== "multiple-choice") return;
    setPracticeRevealed(true);
    setPracticeTimedOut(true);
    setPracticeLastResult("wrong");
    setPracticeSessionStreak(0);
    setPracticeReviewScores((currentScores) => ({
      ...currentScores,
      [normalizePracticeWord(current.favorite.word)]: "again",
    }));
    if (practiceLaunchContext.source === "journey" && practiceLaunchContext.kind === "checkpoint") {
      // Para checkpoints registramos el timeout con un sentinel
      // distinto de cualquier opción real; el backend lo trata como
      // respuesta inválida (wrong) y no como una opción del set.
      setPracticeCheckpointResponses((currentResponses) => ({
        ...currentResponses,
        [current.id]: "__TIMEOUT__",
      }));
    }
    void playPracticeFeedbackSound(false);
  }, [
    activePracticeMode,
    practiceCountdownActive,
    practicePaused,
    practiceRevealed,
    practiceComplete,
    practiceTimerRemaining,
    practiceExercises,
    practiceIndex,
    practiceLaunchContext,
  ]);

  // (4) Auto-advance 1.5 seg después de revelar. Sólo aplica a
  // multiple-choice; en match el usuario completa los pares uno por
  // uno y prefiere ver el resultado completo antes de pasar, así que
  // ese flow se mantiene manual. Si el usuario pausa durante la
  // ventana de 1.5 seg, el cleanup cancela el timeout; al despausar,
  // el effect re-corre y vuelve a programar.
  useEffect(() => {
    if (!practiceRevealed) return;
    if (practiceComplete) return;
    if (practicePaused) return;
    const current = practiceExercises[practiceIndex];
    if (!current || current.kind !== "multiple-choice") return;
    const id = setTimeout(() => {
      advancePractice();
    }, 1500);
    return () => clearTimeout(id);
  }, [practiceRevealed, practiceComplete, practicePaused, practiceExercises, practiceIndex]);

  // (5) Autoplay del audio del ejercicio nuevo. Dispara una sola vez
  // por ejercicio gracias al ref que recuerda el último id que ya
  // sonó. Espera a que termine el countdown y a que la pausa esté
  // off, así no arranca el audio si el usuario pausa antes del primer
  // tick. El ref se declara arriba (junto a practiceClipSoundRef) para
  // que openPracticeMode pueda resetearlo sin TDZ.
  useEffect(() => {
    if (!activePracticeMode) return;
    if (practiceCountdownActive) return;
    if (practicePaused) return;
    if (practiceComplete) return;
    if (practiceRevealed) return;
    const exId = currentPracticeExercise?.id ?? null;
    if (!exId) return;
    if (lastAutoplayedExerciseIdRef.current === exId) return;
    lastAutoplayedExerciseIdRef.current = exId;
    void playPracticeContextClipBest();
    // playPracticeContextClipBest tiene su propia lógica HQ→TTS y
    // maneja errores adentro; no necesitamos un catch aquí.
  }, [
    activePracticeMode,
    practiceCountdownActive,
    practicePaused,
    practiceComplete,
    practiceRevealed,
    currentPracticeExercise?.id,
  ]);

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

  // Slide + fade the exercise card on every index change. Skip the
  // animation when no session is active so we don't churn values.
  useEffect(() => {
    if (!activePracticeMode || practiceComplete) return;
    practiceExerciseOpacity.setValue(0);
    practiceExerciseTranslate.setValue(16);
    Animated.parallel([
      Animated.timing(practiceExerciseOpacity, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(practiceExerciseTranslate, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [activePracticeMode, practiceComplete, practiceExerciseOpacity, practiceExerciseTranslate, practiceIndex]);

  // Run the entrance animation + perfect-score celebration whenever
  // we transition into the "session complete" state. Reset back to the
  // initial values when the user leaves the complete screen so the
  // animation plays fresh next time.
  useEffect(() => {
    if (!practiceComplete) {
      practiceCompleteOpacity.setValue(0);
      practiceCompleteScale.setValue(0.85);
      practiceCompleteTranslate.setValue(20);
      setPracticePerfectActive(false);
      return;
    }
    Animated.parallel([
      Animated.timing(practiceCompleteOpacity, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(practiceCompleteScale, {
        toValue: 1,
        duration: 380,
        easing: Easing.out(Easing.back(1.4)),
        useNativeDriver: true,
      }),
      Animated.timing(practiceCompleteTranslate, {
        toValue: 0,
        duration: 380,
        easing: Easing.out(Easing.back(1.2)),
        useNativeDriver: true,
      }),
    ]).start();
    // Perfect score → confetti + a louder chime overlay.
    if (
      practiceExercises.length > 0 &&
      practiceScore === practiceExercises.length
    ) {
      setPracticePerfectActive(true);
      void playPracticePerfectChime();
    }
  }, [
    practiceComplete,
    practiceCompleteOpacity,
    practiceCompleteScale,
    practiceCompleteTranslate,
    practiceExercises.length,
    practiceScore,
  ]);

  /**
   * One-shot "perfect score" chime — louder + longer than the correct
   * tone so the moment feels like a real reward, not a repeat. Only
   * called when the user finishes a session with 100% accuracy.
   */
  async function playPracticePerfectChime() {
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: PRACTICE_PERFECT_CHIME_URI },
        { shouldPlay: true, volume: 0.9 }
      );
      sound.setOnPlaybackStatusUpdate((status) => {
        if ("didJustFinish" in status && status.didJustFinish) {
          void sound.unloadAsync().catch(() => undefined);
        }
      });
    } catch {
      // Best-effort
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
    const speechLang = getSpeechSynthesisLang(currentPracticeExercise.language);
    Speech.speak(speechText, {
      language: speechLang,
      voice: getBestVoiceFor(speechLang),
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

  async function stopPracticeHqClip() {
    const sound = practiceHqSoundRef.current;
    setPlayingHqPracticeClipId(null);
    if (!sound) return;
    practiceHqSoundRef.current = null;
    try { await sound.stopAsync(); } catch { /* ignore */ }
    try { await sound.unloadAsync(); } catch { /* ignore */ }
  }

  // Three focused helpers for the practice context buttons. Each one stops
  // the others first so only one playback is active at a time.

  async function playPracticeContextClipTtsOnly() {
    if (!currentPracticeExercise || currentPracticeExercise.kind !== "multiple-choice") return;
    const clip = currentPracticeExercise.audioClip;
    const speechText = clip?.sentence?.trim();
    const Speech = getOptionalSpeechModule();
    if (!speechText || !Speech) return;
    if (speakingPracticePromptId === currentPracticeExercise.id) {
      Speech.stop();
      setSpeakingPracticePromptId(null);
      return;
    }
    await stopPracticeContextClip();
    await stopPracticeHqClip();
    Speech.stop();
    setSpeakingPracticePromptId(currentPracticeExercise.id);
    const lang = getSpeechSynthesisLang(clip?.language);
    Speech.speak(speechText, {
      language: lang,
      voice: getBestVoiceFor(lang),
      rate: 0.92,
      pitch: 1,
      onDone: () => setSpeakingPracticePromptId((c) => c === currentPracticeExercise.id ? null : c),
      onStopped: () => setSpeakingPracticePromptId((c) => c === currentPracticeExercise.id ? null : c),
      onError: () => setSpeakingPracticePromptId((c) => c === currentPracticeExercise.id ? null : c),
    });
  }

  async function playPracticeContextClipStoryOnly() {
    if (!currentPracticeExercise || currentPracticeExercise.kind !== "multiple-choice") {
      console.log("[mobile practice] Story skipped: not a multiple-choice exercise");
      return;
    }
    const clip = currentPracticeExercise.audioClip;
    if (!clip) {
      console.log("[mobile practice] Story skipped: no audioClip");
      return;
    }
    console.log("[mobile practice] Story attempt", {
      storySlug: clip.storySlug,
      hasSegmentId: !!clip.segmentId,
      sentence: clip.sentence?.slice(0, 60),
    });
    if (playingPracticeClipId === currentPracticeExercise.id) {
      await stopPracticeContextClip();
      return;
    }
    const storyAudio = await ensurePracticeClipStoryAudio(clip);
    const segment = findSegmentForClip(storyAudio, clip);
    const baseAudioUrl = resolvePracticeAudioUri(storyAudio?.audioUrl);
    const segmentClipUrl = resolvePracticeAudioUri(segment?.clipUrl ?? null);
    const audioUrl = segmentClipUrl ?? baseAudioUrl;
    console.log("[mobile practice] Story resolution", {
      hasStoryAudio: !!storyAudio,
      hasSegment: !!segment,
      hasBaseAudioUrl: !!baseAudioUrl,
      hasSegmentClipUrl: !!segmentClipUrl,
      finalUrl: audioUrl ? audioUrl.slice(0, 80) : null,
    });
    // Si no hay audio del story disponible, no hay nada que tocar como
    // "Story". El botón ya viene gateado por `storyAvailable` en el
    // render, esto es solo defensa.
    if (!audioUrl) return;

    await stopPracticeContextClip();
    await stopPracticeHqClip();
    getOptionalSpeechModule()?.stop();
    setSpeakingPracticePromptId(null);

    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        allowsRecordingIOS: false,
        interruptionModeIOS: InterruptionModeIOS.DoNotMix,
      });
      // Si tenemos segment con start/end y NO hay clipUrl directo,
      // saltamos al inicio del segmento y paramos al final. Si no hay
      // segment, tocamos el audio completo desde el inicio (mejor que
      // silencio cuando el matching de oración falla pero el story
      // sí tiene audio).
      const hasDirectClip = Boolean(segmentClipUrl);
      const hasSegmentRange = !hasDirectClip && segment != null;
      const rawStartSec = hasDirectClip
        ? 0
        : hasSegmentRange
          ? Math.max(0, segment.startSec - CLIP_START_PADDING_SEC)
          : 0;
      const rawEndSec = hasSegmentRange
        ? Math.max(rawStartSec + 0.2, segment.endSec - CLIP_END_TRIM_SEC)
        : Number.NaN;
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
      practiceClipStopAtMillisRef.current = hasSegmentRange ? rawEndSec * 1000 : null;
      setPlayingPracticeClipId(currentPracticeExercise.id);
    } catch (error) {
      console.error("[mobile practice] story clip playback failed", error);
      await stopPracticeContextClip();
    }
  }

  async function playPracticeContextClipHqOnly() {
    if (!currentPracticeExercise || currentPracticeExercise.kind !== "multiple-choice") {
      console.log("[mobile practice] HQ skipped: not a multiple-choice exercise");
      return;
    }
    const clip = currentPracticeExercise.audioClip;
    if (!clip?.sentence) {
      console.log("[mobile practice] HQ skipped: no clip.sentence", { hasClip: !!clip, hasSentence: !!clip?.sentence });
      return;
    }
    console.log("[mobile practice] HQ attempt", {
      sentence: clip.sentence.slice(0, 60),
      language: clip.language ?? "(null→german fallback)",
      hasStorySlug: !!clip.storySlug,
    });
    if (playingHqPracticeClipId === currentPracticeExercise.id) {
      await stopPracticeHqClip();
      return;
    }
    await stopPracticeContextClip();
    await stopPracticeHqClip();
    getOptionalSpeechModule()?.stop();
    setSpeakingPracticePromptId(null);

    const cacheKey = `${clip.language ?? ""}|${clip.sentence}`;
    let url = hqUrlBySentence[cacheKey];
    if (!url) {
      try {
        const resp = await apiFetch<{ url?: string }>({
          baseUrl: mobileConfig.apiBaseUrl,
          path: "/api/practice/sentence-tts",
          method: "POST",
          token: sessionToken ?? undefined,
          body: { sentence: clip.sentence, language: clip.language ?? "german" },
        });
        if (!resp?.url) {
          console.log("[mobile practice] HQ endpoint returned no url", { resp });
          return;
        }
        url = resp.url;
        setHqUrlBySentence((prev) => ({ ...prev, [cacheKey]: url! }));
      } catch (err) {
        console.error("[mobile practice] HQ TTS request failed", err);
        return;
      }
    }
    console.log("[mobile practice] HQ url resolved", { url: url.slice(0, 80) });

    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        allowsRecordingIOS: false,
        interruptionModeIOS: InterruptionModeIOS.DoNotMix,
      });
      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true },
        (status) => {
          if ("didJustFinish" in status && status.didJustFinish) {
            void stopPracticeHqClip();
          }
        }
      );
      practiceHqSoundRef.current = sound;
      setPlayingHqPracticeClipId(currentPracticeExercise.id);
    } catch (err) {
      console.error("[mobile practice] HQ playback failed", err);
      await stopPracticeHqClip();
    }
  }

  /**
   * Autoplay del ejercicio actual con cadena Story → HQ → silencio.
   * Story (audio real grabado de la historia) es la mejor opción
   * cuando existe; si la oración no tiene segmento de audio
   * matcheable, caemos a HQ (ElevenLabs Moritz, expresivo, cacheado
   * en R2 desde el primer fetch). Nunca caemos a TTS on-device en
   * autoplay porque el speechSynthesis nativo iOS suena robotizado y
   * el usuario lo califica explícitamente como "no expresivo".
   *
   * El usuario puede tocar manualmente el botón TTS si quiere la voz
   * del sistema; el botón HQ sigue exponiendo HQ on-demand también.
   */
  async function playPracticeContextClipBest() {
    if (!currentPracticeExercise || currentPracticeExercise.kind !== "multiple-choice") return;
    const clip = currentPracticeExercise.audioClip;
    if (!clip) return;

    // Intentamos Story primero. `playPracticeContextClipStoryOnly`
    // setea `playingPracticeClipId` cuando un Audio.Sound se carga
    // exitosamente; si no hay audioUrl resuelto, retorna sin tocar
    // ese estado, así que podemos detectar fallo silencioso.
    try {
      await playPracticeContextClipStoryOnly();
    } catch (err) {
      console.error("[mobile practice] autoplay Story failed", err);
    }
    if (practiceClipSoundRef.current) return; // Story arrancó OK
    // Story no produjo audio (no había clip URL resoluble). Probamos
    // HQ. Igual de defensivo: HQ valida que la oración exista y que
    // el endpoint devuelva URL.
    try {
      await playPracticeContextClipHqOnly();
    } catch (err) {
      console.error("[mobile practice] autoplay HQ fallback failed", err);
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
      const contextLang = getSpeechSynthesisLang(clip.language);
      Speech.speak(speechText, {
        language: contextLang,
        voice: getBestVoiceFor(contextLang),
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

    // If the TTS fallback is currently speaking, a second tap should stop it.
    if (speakingPracticePromptId === currentPracticeExercise.id) {
      getOptionalSpeechModule()?.stop();
      setSpeakingPracticePromptId(null);
      return;
    }

    const storyAudio = await ensurePracticeClipStoryAudio(clip);
    const segment = findSegmentForClip(storyAudio, clip);
    const baseAudioUrl = resolvePracticeAudioUri(storyAudio?.audioUrl);
    const segmentClipUrl = resolvePracticeAudioUri(segment?.clipUrl ?? null);
    const audioUrl = segmentClipUrl ?? baseAudioUrl;
    // Journey stories don't yet ship with per-sentence alignment segments, so
    // there's no precise clip we can scrub into. Instead of silently no-oping
    // the Play button, fall back to on-device TTS of the context sentence in
    // the story's language. Works for every journey story, uses the right
    // voice (it-IT, de-DE, etc.), and the audio sync is accurate enough for
    // a short sentence.
    if (!audioUrl || !segment) {
      const speechText = clip.sentence?.trim();
      const Speech = getOptionalSpeechModule();
      if (!speechText || !Speech) return;
      await stopPracticeContextClip();
      Speech.stop();
      setSpeakingPracticePromptId(currentPracticeExercise.id);
      const fallbackLang = getSpeechSynthesisLang(clip.language);
      Speech.speak(speechText, {
        language: fallbackLang,
        voice: getBestVoiceFor(fallbackLang),
        rate: 0.92,
        pitch: 1,
        onDone: () =>
          setSpeakingPracticePromptId((cur) =>
            cur === currentPracticeExercise.id ? null : cur
          ),
        onStopped: () =>
          setSpeakingPracticePromptId((cur) =>
            cur === currentPracticeExercise.id ? null : cur
          ),
        onError: () =>
          setSpeakingPracticePromptId((cur) =>
            cur === currentPracticeExercise.id ? null : cur
          ),
      });
      return;
    }

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

    if (pair.answer !== value) {
      // Wrong match: previously this branch silently returned, which
      // made the exercise feel broken (the user would tap an option
      // and nothing happened). Now we surface the miss: flash the
      // mis-tapped row red, mark the word as "again" in SRS, drop
      // the streak, and clear the active selection so the user can
      // retry without an extra tap.
      setWrongMatchAttempt({ word: activeMatchWord, value });
      setPracticeSessionStreak(0);
      setPracticeLastResult("wrong");
      setPracticeReviewScores((currentScores) => ({
        ...currentScores,
        [normalizePracticeWord(activeMatchWord)]: "again",
      }));
      void playPracticeFeedbackSound(false);
      // Hold the red flash long enough to register as feedback,
      // then deselect so a new tap starts a fresh attempt.
      setTimeout(() => {
        setWrongMatchAttempt(null);
        setActiveMatchWord(null); setWrongMatchAttempt(null);
      }, 700);
      return;
    }

    const nextMatched = [...matchedWords, activeMatchWord];
    setMatchedWords(nextMatched);
    setActiveMatchWord(null); setWrongMatchAttempt(null);

    if (nextMatched.length === current.pairs.length) {
      setPracticeScore((value) => value + 1);
      setPracticeRevealed(true);
      setPracticeLastResult("correct");
      setPracticeSessionStreak((value) => value + 1);
      setPracticeReviewScores((currentScores) => {
        const nextScores = { ...currentScores };
        for (const pair of current.pairs) {
          // Only mark pairs that weren't previously flagged as
          // "again" — otherwise a perfect finish after one or two
          // misses would erase the SRS "again" signal and the user
          // wouldn't see the word pop back for review.
          const key = normalizePracticeWord(pair.word);
          if (nextScores[key] !== "again") {
            nextScores[key] = "good";
          }
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
    if (activeScreen === "settings" && preferencesDirty) {
      Alert.alert(
        "Unsaved changes",
        "You have unsaved preferences. Discard them?",
        [
          { text: "Stay", style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => {
              setPreferences(savedPreferences);
              setActiveScreen(tab);
            },
          },
        ]
      );
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
              coverUrl: getCoverUrl(story.cover ?? story.coverUrl ?? book.cover),
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

  // Reader comprehension events. Captures per-word interactions for adaptive
  // learning + corpus asset value. Fire-and-forget; failures are logged but
  // never block reader UX.
  async function trackReaderEvent(
    eventType:
      | "vocab_clicked"
      | "word_dwell"
      | "audio_segment_replay"
      | "story_abandoned"
      | "vocab_marked_known"
      | "vocab_marked_unknown",
    payload: { storySlug: string; bookSlug?: string; value?: number; metadata?: Record<string, unknown> }
  ) {
    if (!sessionToken) return;
    try {
      await apiFetch<{ success: true }>({
        baseUrl: mobileConfig.apiBaseUrl,
        path: "/api/mobile/metrics",
        token: sessionToken,
        method: "POST",
        body: {
          storySlug: payload.storySlug,
          bookSlug: payload.bookSlug,
          eventType,
          value: payload.value,
          metadata: payload.metadata ?? {},
        },
      });
    } catch (error) {
      console.error("[mobile reader] failed to track reader event", error);
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
          const journeyLang = activeJourneyLanguage || remoteJourney?.language || "Spanish";
          const payload = await apiFetch<MobileJourneyPayload>({
            baseUrl: mobileConfig.apiBaseUrl,
            path: `/api/mobile/journey?language=${encodeURIComponent(journeyLang)}`,
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
                coverUrl: getCoverUrl(story.cover ?? story.coverUrl ?? book.cover),
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
          subtitle: [formatLanguageAndRegion(book.language, book.region ?? ""), level]
            .filter(Boolean)
            .join(" · "),
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
            subtitle: [
              book.title,
              formatLanguageAndRegion(story.language ?? book.language, story.region ?? book.region ?? ""),
              level,
            ]
              .filter(Boolean)
              .join(" · "),
            coverUrl: getCoverUrl(story.cover ?? story.coverUrl ?? book.cover),
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
          subtitle: [formatLanguageAndRegion(story.language ?? "", story.region ?? ""), level]
            .filter(Boolean)
            .join(" · "),
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
              coverUrl: getCoverUrl(story.cover ?? story.coverUrl ?? book.cover),
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
          setActiveScreen("home");
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
            <Text style={styles.eyebrow}>Library</Text>
            <Text style={styles.title}>Library</Text>
            <Text style={styles.subtitle}>Continue, discover and jump into your next story.</Text>
          </View>
          <MenuTrigger onPress={() => setMenuOpen(true)} />
        </View>
      </View>

      {/* Loading placeholder that matches the shapes of the real cards
          that are about to arrive (Continue listening + New releases),
          so the layout doesn't jump and the user has something to look
          at during the ~500-900 ms hydration window. Gated on
          `didFirstHydrate`, NOT `loadingRemote` — that distinction
          matters because `loadingRemote` only flips to true inside the
          fetch effect, after the first render has already painted the
          local-state sections. The flag stays true after the first
          hydrate so subsequent silent refreshes don't redraw it. */}
      {/* Show the skeleton on first paint regardless of whether the
          token is already in memory: an anchor-only mount (cold-
          start before Clerk has minted the JWT) used to slip past
          this gate because isSignedIn = Boolean(sessionToken) was
          still false at frame 1, so the user saw an empty Home for
          a beat before the skeleton kicked in. Using sessionUserId
          (which is populated by the anchor on mount) covers both
          cases. */}
      {!didFirstHydrate && (isSignedIn || Boolean(sessionUserId)) ? <HomeSkeleton /> : null}

      {didFirstHydrate && remoteProgress?.gamification ? (
        <View style={styles.section}>
          <Pressable
            onPress={() => setProgressSheetOpen(true)}
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

      {didFirstHydrate && continueReadingCards.length > 0 ? (
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

      {didFirstHydrate && (remoteStoryCards.length > 0 || personalizedStoryCards.length > 0) ? (
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

      {/* New releases uses static bundled data so it's available at T=0.
          The sections above (Continue listening, Recommended next) depend
          on async data and land ~500-900 ms later — if we render New
          Releases before those arrive, it flashes at the top of the list
          and then jumps down. Gate on loadingRemote so the home layout
          stabilizes in a single paint. */}
      {/* Books and stories used to share a single "New releases" rail,
          but the two cards have different intrinsic heights — the
          shorter ones left a visual gap under them when alignItems
          collapsed everyone to the row's tallest card. Splitting them
          into two rails keeps each carousel uniform and makes the
          Home page feel deliberate instead of ragged. */}
      {didFirstHydrate && latestBookCards.length > 0 ? (
      <View
        style={[styles.section, activeOnboardingTourTarget === "reader" ? styles.onboardingHighlightedSurface : null]}
        accessibilityLabel="qa-home-latest-books-section"
        testID="qa-home-latest-books-section"
      >
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>Library</Text>
            <Text style={styles.sectionTitle}>New books</Text>
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="normal" contentContainerStyle={styles.carousel}>
          {latestBookCards.slice(0, 5).map((item) => (
            <BookWebCard key={item.key} item={item} />
          ))}
        </ScrollView>
      </View>
      ) : null}

      {didFirstHydrate && (latestStoryCards.length > 0 || homeStandaloneStoryCards.length > 0) ? (
      <View style={styles.section} accessibilityLabel="qa-home-latest-stories-section" testID="qa-home-latest-stories-section">
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionEyebrow}>Library</Text>
            <Text style={styles.sectionTitle}>New stories</Text>
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="normal" contentContainerStyle={styles.carousel}>
          {[...latestStoryCards.slice(0, 5), ...homeStandaloneStoryCards.slice(0, 3)].slice(0, 6).map((item) => (
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
          ))}
        </ScrollView>
      </View>
      ) : null}
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

  // Distribución visual de las palabras due en los 4 modos para el ring
  // del PracticeOrbit. Por ahora es ponderada (40/30/20/10), no por
  // propiedades reales de cada palabra. Funciona para el preview;
  // cuando implementemos la sesión mixta real, este breakdown puede
  // alimentarse desde el mismo builder.
  const orbitModeBreakdown = useMemo(() => {
    const totalDue = duePracticeItems.length;
    if (totalDue === 0) return { meaning: 0, context: 0, listening: 0, match: 0 };
    const weights: Record<OrbitModeKey, number> = {
      meaning: 0.4,
      context: 0.3,
      listening: 0.2,
      match: 0.1,
    };
    const result: Record<OrbitModeKey, number> = {
      meaning: Math.floor(totalDue * weights.meaning),
      context: Math.floor(totalDue * weights.context),
      listening: Math.floor(totalDue * weights.listening),
      match: Math.floor(totalDue * weights.match),
    };
    const order: OrbitModeKey[] = ["meaning", "context", "listening", "match"];
    let assigned = order.reduce((sum, key) => sum + result[key], 0);
    let i = 0;
    while (assigned < totalDue) {
      result[order[i % order.length]] += 1;
      assigned += 1;
      i += 1;
    }
    // Match agrupa de 4 en 4 en backend; si total < 4 lo dejamos en 0
    // y reparto a meaning para no mostrar "Match 1" sin sentido visual.
    if (totalDue < 4 && result.match > 0) {
      result.meaning += result.match;
      result.match = 0;
    }
    return result;
  }, [duePracticeItems]);

  // Topic label: por ahora fijo. El campo "From {topic}" del mockup
  // requiere saber el topic dominante de las palabras due, lo cual
  // necesita metadata de cada Favorite (storySlug → topic). Se va a
  // resolver en una iteración siguiente; por ahora "Your saved words"
  // funciona como fallback honesto.
  const orbitTopicLabel = "Your saved words";

  // `orbitUpNextWords` removido: el card "Up Next" se sacó de la
  // pantalla Practice para que todo el contenido entre sin scroll.
  // Si volvemos a mostrar palabras antes de empezar, recuperar el
  // useMemo desde git.

  const orbitDailyGoalPercent = useMemo(() => {
    const goal = 50; // XP / día (placeholder hasta exponer el goal real)
    const today = remoteProgress?.gamification?.todayXp ?? 0;
    return goal > 0 ? (today / goal) * 100 : 0;
  }, [remoteProgress]);

  const orbitStreak = remoteProgress?.gamification?.dailyStreak ?? maxFavoriteStreak ?? 0;

  const practiceView = (
    <>
      {!isSignedIn ? (
        <>
          <View style={styles.hero}>
            <View style={styles.heroHeaderRow}>
              <View style={styles.heroTextBlock}>
                <Text style={styles.eyebrow}>Get started</Text>
                <Text style={styles.title}>Practice</Text>
              </View>
              <MenuTrigger onPress={() => setMenuOpen(true)} />
            </View>
          </View>
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
        </>
      ) : (
        <>
          {practiceLoadError ? (
            <View style={[styles.card, styles.accountCard, styles.practiceErrorCard]}>
              <Text style={styles.errorText}>{practiceLoadError}</Text>
            </View>
          ) : null}
          <PracticeOrbit
            topicLabel={favoriteWords.length === 0 ? null : orbitTopicLabel}
            totalDue={duePracticeItems.length}
            xpReward={12}
            modeBreakdown={orbitModeBreakdown}
            streakDays={orbitStreak}
            dailyGoalPercent={orbitDailyGoalPercent}
            onStart={() => void openPracticeMode(recommendedPracticeMode ?? "meaning")}
            onPickSkill={(mode) => void openPracticeMode(mode)}
            emptyState={favoriteWords.length === 0}
          />
        </>
      )}
    </>
  );

  // `practiceSessionView` se invoca como función (no const-eager) para
  // que su body se evalúe DESPUÉS de los memos de journey
  // (`globalJourneyNextStoryId`, `activeJourneyTrack`, etc.) que están
  // declarados más abajo. Sin esto el "next-step CTA" del result card
  // dispararía ReferenceError por TDZ.
  const renderPracticeSessionView = () =>
    activePracticeMode && activePracticeCard ? (
      <View style={styles.practiceSessionShell}>
        <View style={styles.practiceSessionCard}>
          <View style={styles.practiceSessionHeader}>
            <Pressable onPress={requestClosePracticeSession} style={styles.practiceSessionClose}>
              <Feather name="arrow-left" size={18} color="#f5f7fb" />
            </Pressable>
            <View style={styles.practiceSessionTitleWrap}>
              <Text style={[styles.practiceSessionEyebrow, { color: activePracticeCard.accent }]}>
                {activePracticeCard.eyebrow}
              </Text>
              <Text style={styles.practiceSessionTitle}>{activePracticeCard.title}</Text>
            </View>
            {/* Botón pausa/reanudar. Toggle del state global
                `practicePaused`. Cuando está activo el icon es ⏸; cuando
                pausado pasa a ▶. La pausa congela el timer, cancela el
                auto-advance, silencia el autoplay y DETIENE cualquier
                audio que esté sonando (TTS, Story o HQ) para que el
                pause sea audible y no solo visual. Tap manual en
                TTS/Story/HQ sigue funcionando para que el usuario
                pueda escuchar tranquilo durante la pausa.
                hitSlop generoso (10) porque el botón es chico. */}
            <Pressable
              onPress={() => {
                setPracticePaused((current) => {
                  const next = !current;
                  if (next) {
                    // Pausando: detener todo el audio en curso.
                    void stopPracticeContextClip();
                    void stopPracticeHqClip();
                    getOptionalSpeechModule()?.stop();
                    setSpeakingPracticePromptId(null);
                  } else {
                    // Despausando: el effect de autoplay no vuelve a
                    // disparar porque su ref `lastAutoplayedExerciseIdRef`
                    // ya tiene el id del ejercicio actual. Lo reseteamos
                    // para que el effect detecte un "ejercicio nuevo"
                    // y vuelva a tocar el audio. Si no, el play de un
                    // pause/play es solo visual: barra retoma pero sin
                    // sonido.
                    lastAutoplayedExerciseIdRef.current = null;
                  }
                  return next;
                });
              }}
              hitSlop={10}
              style={styles.practiceSessionPauseButton}
              accessibilityRole="button"
              accessibilityLabel={practicePaused ? "qa-practice-resume" : "qa-practice-pause"}
              testID={practicePaused ? "qa-practice-resume" : "qa-practice-pause"}
            >
              <Feather
                name={practicePaused ? "play" : "pause"}
                size={16}
                color="#f5f7fb"
              />
            </Pressable>
          </View>

          {/* Barra de timer del ejercicio. Solo visible mientras hay
              sesión activa post-countdown, no completa, y el
              ejercicio actual es multiple-choice (match no usa el
              timer). Decrece de 100% a 0% en 10 seg. Si el usuario
              pausa, la barra se tiñe de naranja para señalizar que el
              timer está congelado. */}
          {!practiceCountdownActive &&
          !practiceComplete &&
          !practiceLaunchLoading &&
          currentPracticeExercise?.kind === "multiple-choice" ? (
            <View style={styles.practiceTimerBarTrack}>
              <View
                style={[
                  styles.practiceTimerBarFill,
                  {
                    width: `${Math.max(0, Math.min(100, (practiceTimerRemaining / 10) * 100))}%`,
                    // Amarillo SIEMPRE en la barra del timer; rojo
                    // cuando crítico (≤3 seg). Antes usaba el
                    // `activePracticeCard.accent` que en el modo
                    // "Context" es `tokenColor.streak` (`#fb923c`,
                    // naranja) y chocaba feo con el azul del fondo.
                    // El amarillo `#f8c15c` es el mismo de los popups
                    // y el endOfStory.
                    backgroundColor: practiceTimerRemaining <= 3 ? "#f87171" : "#f8c15c",
                  },
                ]}
              />
            </View>
          ) : null}

          {practiceLaunchLoading ? (
            <View style={styles.practiceLaunchLoaderCard}>
              <PulseDots label="Preparing your practice…" />
            </View>
          ) : practiceComplete ? (
            <Animated.View
              style={[
                styles.practiceResultCard,
                {
                  opacity: practiceCompleteOpacity,
                  transform: [
                    { scale: practiceCompleteScale },
                    { translateY: practiceCompleteTranslate },
                  ],
                },
              ]}
            >
              {practiceScore === practiceExercises.length && practiceExercises.length > 0 ? (
                // Perfect-score header: trophy ring + bouncing emoji-style
                // wordmark. Replaces the small "Session complete" pill so
                // the moment feels noticeably different from a normal
                // finish.
                <>
                  <View style={styles.practicePerfectRing}>
                    <View style={styles.practicePerfectRingInner}>
                      <Feather name="award" size={28} color={tokenBg[1]} />
                    </View>
                  </View>
                  <Text style={styles.practicePerfectTitle}>Perfect!</Text>
                  <Text style={styles.practiceResultScore}>
                    {practiceScore}/{practiceExercises.length}
                  </Text>
                </>
              ) : (
                <>
                  <View style={styles.practiceFocusPill}>
                    <Feather name="award" size={13} color={activePracticeCard.accent} />
                    <Text style={styles.practiceFocusPillText}>Session complete</Text>
                  </View>
                  <Text style={styles.practiceResultScore}>
                    {practiceScore}/{practiceExercises.length}
                  </Text>
                </>
              )}
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
                    ? "Every answer correct. Your words are locked in for the next step."
                    : `${practiceExercises.length - practiceScore} to review · keep going.`}
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
                {/* PRIMARY CTA = "next step" único y forward-looking:
                    1. Si quedan palabras due en favoritos → "Review N more due"
                    2. Si hay próxima historia en el path del journey → "Continue to {title}"
                    3. Fallback → "Back to journey"
                    Para checkpoint NO pasado, lo escondemos para que el
                    "Retry checkpoint" (abajo) sea el camino obvio. */}
                {(() => {
                  const inCheckpoint =
                    practiceLaunchContext.source === "journey" &&
                    practiceLaunchContext.kind === "checkpoint";
                  if (inCheckpoint && !checkpointPassed) return null;

                  // Encontrar la story object del global next pointer
                  let nextStory:
                    | MobileJourneyTopicSummary["stories"][number]
                    | null = null;
                  if (globalJourneyNextStoryId && activeJourneyTrack) {
                    for (const lvl of activeJourneyTrack.levels) {
                      for (const tp of lvl.topics) {
                        const found = tp.stories.find(
                          (s) => s.id === globalJourneyNextStoryId
                        );
                        if (found) {
                          nextStory = found;
                          break;
                        }
                      }
                      if (nextStory) break;
                    }
                  }

                  // Si quedan due (y no fue checkpoint), proponer otra ronda.
                  if (dueFavoritesCount > 0 && !inCheckpoint) {
                    return (
                      <Pressable
                        onPress={() =>
                          void openPracticeMode(recommendedPracticeMode, true)
                        }
                        style={[
                          styles.inlineButton,
                          styles.primaryButton,
                          styles.practiceResultActionButton,
                        ]}
                      >
                        <Text style={[styles.inlineButtonText, styles.primaryButtonText]}>
                          Review {dueFavoritesCount} more due
                        </Text>
                      </Pressable>
                    );
                  }

                  if (nextStory) {
                    const nextTitle = nextStory.title?.trim() || "next story";
                    const captured = nextStory;
                    return (
                      <Pressable
                        onPress={() => {
                          closePracticeSession();
                          void openJourneyStory(captured);
                        }}
                        style={[
                          styles.inlineButton,
                          styles.primaryButton,
                          styles.practiceResultActionButton,
                        ]}
                      >
                        <Text style={[styles.inlineButtonText, styles.primaryButtonText]}>
                          Continue to {nextTitle}
                        </Text>
                      </Pressable>
                    );
                  }

                  return (
                    <Pressable
                      onPress={() => {
                        closePracticeSession();
                        setActiveScreen("home");
                      }}
                      style={[
                        styles.inlineButton,
                        styles.primaryButton,
                        styles.practiceResultActionButton,
                      ]}
                    >
                      <Text style={[styles.inlineButtonText, styles.primaryButtonText]}>
                        Back to journey
                      </Text>
                    </Pressable>
                  );
                })()}

                {/* SECONDARY CTAs (lo que antes eran primary):
                    Retry checkpoint / Review N wrongs / Play again. */}
                {practiceLaunchContext.source === "journey" && practiceLaunchContext.kind === "checkpoint" ? (
                  <Pressable
                    onPress={() => void openPracticeMode(activePracticeMode, false)}
                    style={[styles.inlineButton, styles.practiceResultActionButton]}
                  >
                    <Text style={styles.inlineButtonText}>
                      Retry checkpoint
                    </Text>
                  </Pressable>
                ) : practiceMissedItems.length > 0 ? (
                  <Pressable
                    onPress={() => void openPracticeMode(activePracticeMode, true, practiceMissedItems)}
                    style={[styles.inlineButton, styles.practiceResultActionButton]}
                  >
                    <Text style={styles.inlineButtonText}>
                      Review {practiceMissedItems.length} wrong{practiceMissedItems.length === 1 ? "" : "s"}
                    </Text>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => void openPracticeMode(activePracticeMode, false)}
                    style={[styles.inlineButton, styles.practiceResultActionButton]}
                  >
                    <Text style={styles.inlineButtonText}>
                      Play again
                    </Text>
                  </Pressable>
                )}

                {/* Recovery weak spots para checkpoint failed sigue ahí. */}
                {practiceLaunchContext.source === "journey" &&
                practiceLaunchContext.kind === "checkpoint" &&
                !checkpointPassed &&
                checkpointRecoveryMode &&
                checkpointMissedItems.length > 0 ? (
                  <Pressable
                    onPress={() => void openPracticeMode(checkpointRecoveryMode, true, checkpointMissedItems)}
                    style={[styles.inlineButton, styles.practiceResultActionButton]}
                  >
                    <Text style={styles.inlineButtonText}>Review weak spots</Text>
                  </Pressable>
                ) : null}

                {/* "Play again" extra cuando el secundario ya es "Review wrongs". */}
                {practiceMissedItems.length > 0 &&
                !(practiceLaunchContext.source === "journey" && practiceLaunchContext.kind === "checkpoint") ? (
                  <Pressable
                    onPress={() => void openPracticeMode(activePracticeMode, false)}
                    style={[styles.inlineButton, styles.practiceResultActionButton]}
                  >
                    <Text style={styles.inlineButtonText}>Play again</Text>
                  </Pressable>
                ) : null}
              </View>
            </Animated.View>
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
                        : practiceTimedOut
                          ? "Time's up!"
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
                contentContainerStyle={[
                  styles.practiceExerciseScrollContent,
                  currentPracticeExercise.kind === "multiple-choice" &&
                  currentPracticeExercise.mode === "meaning"
                    ? styles.practiceExerciseScrollContentMeaning
                    : null,
                ]}
                showsVerticalScrollIndicator={false}
              >
                <Animated.View
                  style={{
                    opacity: practiceExerciseOpacity,
                    transform: [{ translateY: practiceExerciseTranslate }],
                  }}
                >
                {currentPracticeExercise.kind === "multiple-choice" ? (
                  // The "make options + sentence bigger to fill the card on
                  // tall devices" pass that fixes the empty space below the
                  // prompt for context / listening / match. Meaning already
                  // had the right vertical balance with the original sizes,
                  // so we keep its smaller typography + tighter spacing —
                  // otherwise meaning ends up taller than the screen and
                  // forces a scroll.
                  (() => {
                    const isMeaningExercise = currentPracticeExercise.mode === "meaning";
                    return (
                  <View
                    style={[
                      styles.practiceQuestionCard,
                      isMeaningExercise ? styles.practiceQuestionCardMeaning : null,
                    ]}
                  >
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
                    {currentPracticeExercise.audioClip ? (() => {
                      const clip = currentPracticeExercise.audioClip;
                      const exId = currentPracticeExercise.id;
                      const ttsActive = speakingPracticePromptId === exId;
                      const storyActive = playingPracticeClipId === exId;
                      const hqActive = playingHqPracticeClipId === exId;
                      const storyAudio =
                        clip.storySource === "standalone"
                          ? standaloneStoryAudioBySlug[normalizeStorySlug(clip.storySlug)]
                          : userStoryAudioBySlug[normalizeStorySlug(clip.storySlug)];
                      // Story button enabled si el story tiene audio,
                      // aunque no se haya matcheado un segmento por
                      // oración: en ese caso la función arranca el
                      // audio desde el inicio en vez de silencio.
                      const storyAvailable = Boolean(storyAudio?.audioUrl);
                      return (
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                          <Pressable
                            onPress={() => { void playPracticeContextClipTtsOnly(); }}
                            disabled={!practiceSpeechAvailable}
                            style={[
                              styles.practiceListenButton,
                              !practiceSpeechAvailable ? styles.practiceListenButtonDisabled : null,
                            ]}
                          >
                            <Feather name={ttsActive ? "square" : "volume-2"} size={14} color={practiceSpeechAvailable ? "#f5f7fb" : "#8ea2bc"} />
                            <Text style={[styles.practiceListenButtonText, !practiceSpeechAvailable ? styles.practiceListenButtonTextDisabled : null]}>
                              {ttsActive ? "Stop" : "TTS"}
                            </Text>
                          </Pressable>
                          <Pressable
                            onPress={() => { void playPracticeContextClipStoryOnly(); }}
                            disabled={!storyAvailable}
                            style={[
                              styles.practiceListenButton,
                              !storyAvailable ? styles.practiceListenButtonDisabled : null,
                            ]}
                          >
                            <Feather name={storyActive ? "square" : "play"} size={14} color={storyAvailable ? "#f5f7fb" : "#8ea2bc"} />
                            <Text style={[styles.practiceListenButtonText, !storyAvailable ? styles.practiceListenButtonTextDisabled : null]}>
                              {storyActive ? "Stop" : "Story"}
                            </Text>
                          </Pressable>
                          <Pressable
                            onPress={() => { void playPracticeContextClipHqOnly(); }}
                            style={styles.practiceListenButton}
                          >
                            <Feather name={hqActive ? "square" : "volume-2"} size={14} color="#f5f7fb" />
                            <Text style={styles.practiceListenButtonText}>
                              {hqActive ? "Stop" : "HQ"}
                            </Text>
                          </Pressable>
                        </View>
                      );
                    })() : null}
                    {currentPracticeExercise.sentence ? (
                      <Text
                        style={[
                          styles.practiceSentence,
                          isMeaningExercise ? styles.practiceSentenceMeaning : null,
                        ]}
                      >
                        {currentPracticeExercise.sentence}
                      </Text>
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
                    <View
                      style={[
                        styles.practiceOptions,
                        isMeaningExercise ? styles.practiceOptionsMeaning : null,
                      ]}
                    >
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
                              isMeaningExercise ? styles.practiceOptionMeaning : null,
                              isSelected ? styles.practiceOptionSelected : null,
                              isCorrect ? styles.practiceOptionCorrect : null,
                              isWrong ? styles.practiceOptionWrong : null,
                            ]}
                          >
                            <Text
                              style={[
                                styles.practiceOptionText,
                                isMeaningExercise ? styles.practiceOptionTextMeaning : null,
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
                    );
                  })()
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
                          const isWrong = wrongMatchAttempt?.word === pair.word;
                          return (
                            <Pressable
                              key={pair.word}
                              onPress={() => {
                                if (practiceRevealed) return;
                                if (wrongMatchAttempt) return;
                                setActiveMatchWord((current) => (current === pair.word ? null : pair.word));
                              }}
                              style={[
                                styles.practiceMatchChip,
                                isActive ? styles.practiceMatchChipActive : null,
                                isMatched ? styles.practiceMatchChipCorrect : null,
                                isWrong ? styles.practiceMatchChipWrong : null,
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
                          const isWrong = wrongMatchAttempt?.value === meaning;
                          return (
                            <Pressable
                              key={meaning}
                              onPress={() => chooseMatchValue(meaning)}
                              disabled={
                                practiceRevealed ||
                                !activeMatchWord ||
                                Boolean(matchedPair) ||
                                Boolean(wrongMatchAttempt)
                              }
                              style={[
                                styles.practiceMatchMeaning,
                                matchedPair ? styles.practiceMatchChipCorrect : null,
                                isWrong ? styles.practiceMatchChipWrong : null,
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
                </Animated.View>
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
        {practiceExitConfirmVisible ? (
          <PracticeExitSheet
            accent={activePracticeCard?.accent ?? tokenColor.xp}
            exercisesDone={practiceIndex}
            exercisesTotal={practiceExercises.length}
            // `practiceScore` cuenta sólo aciertos. Si los 4 ejercicios
            // hechos fueron timeout/wrong, el score es 0 y el sheet
            // muestra "Don't give up" en lugar de un falso "Nice work".
            exercisesCorrect={practiceScore}
            onContinuePracticing={() => {
              // Cierra el sheet y reanuda. La pausa se levanta para
              // que el timer y el auto-advance retomen donde quedaron.
              setPracticeExitConfirmVisible(false);
              setPracticePaused(false);
            }}
            onExitAnyway={() => {
              // Cierra la sesión y manda al usuario al journey (Home
              // tab) sin importar de dónde haya entrado a Practice.
              // Importante: `closePracticeSession` para sesiones
              // source === "story" mid-sesión hace
              // `setSelection(practiceReturnSelection)` reabriendo el
              // reader como overlay; nuestro `setActiveScreen("home")`
              // sólo no alcanza porque el reader queda encima. Por eso
              // limpiamos selection explícitamente: el botón promete
              // journey, debe llevar a journey.
              setPracticeExitConfirmVisible(false);
              closePracticeSession();
              setSelection(null);
              setActiveScreen("home");
            }}
          />
        ) : null}
        <PracticeCelebration active={practicePerfectActive} />
        {practiceCountdownActive ? (
          <PracticeCountdown
            accent={activePracticeCard.accent}
            onComplete={() => setPracticeCountdownActive(false)}
          />
        ) : null}
      </View>
    ) : null;

  const favoritesView = (
    <>
      <View style={styles.favoritesHero}>
        <View style={styles.heroHeaderRow}>
          <View style={styles.favoritesHeroTextBlock}>
            <Text style={styles.eyebrow}>Favorites</Text>
            <Text style={styles.favoritesHeroTitle}>
              {activeJourney
                ? `${activeJourney.language} vocabulary`
                : "Saved vocabulary"}
            </Text>
          </View>
          <MenuTrigger onPress={() => setMenuOpen(true)} />
        </View>
        {favoriteCards.length > 0 ? (
          <View style={styles.favoritesHeroStats}>
            {journeyDueCount > 0 ? (
              <View style={styles.favoritesCompactPill}>
                <Text style={styles.favoritesCompactDueText}>{journeyDueCount} due</Text>
              </View>
            ) : null}
            <View style={styles.favoritesCompactPill}>
              <Text style={styles.favoritesCompactPillText}>{journeyAllCount} in journey</Text>
            </View>
            <View style={styles.favoritesCompactPill}>
              <Text style={styles.favoritesCompactPillText}>{formatStreakLabel(Math.max(maxFavoriteStreak, 1))}</Text>
            </View>
          </View>
        ) : null}
      </View>

      {favoriteCards.length > 0 ? (
        <>
          <View style={styles.favoritesCompactBar}>
            <View style={styles.favoritesCompactActions}>
              {/* Pills journey-scoped: filtran la lista visible (no
                  navegan a Practice). El botón "Practice these" abajo
                  arranca la sesión respetando el filtro activo. */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} decelerationRate="normal" contentContainerStyle={styles.favoritesModePills}>
                <Pressable
                  onPress={() => setFavoritePracticeModeKind("due")}
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
                    Due ({journeyDueCount})
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setFavoritePracticeModeKind("all")}
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
                    All ({journeyAllCount})
                  </Text>
                </Pressable>
                {journeyRelatedCount > 0 ? (
                  <Pressable
                    onPress={() => setFavoritePracticeModeKind("related")}
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
                      Related ({journeyRelatedCount})
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
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${item.word}`}
                  hitSlop={12}
                  onPress={() => void removeFavoriteItem(item)}
                  style={({ pressed }) => [
                    styles.favoriteRemove,
                    pressed ? styles.favoriteRemovePressed : null,
                  ]}
                >
                  <Feather name="x" size={14} color="#f5b5b5" />
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
          {filteredFavoriteCards.length > 0 ? (
            <Pressable
              onPress={() => {
                const itemsForPractice = filteredFavoriteCards.map((c) => c.item);
                setActiveScreen("practice");
                void openPracticeMode(
                  recommendedPracticeMode,
                  false,
                  buildPracticeFavorites(itemsForPractice),
                  favoritePracticeModeKind
                );
              }}
              style={styles.favoritesPracticeCta}
            >
              <Feather name="play-circle" size={18} color={tokenBg[1]} />
              <Text style={styles.favoritesPracticeCtaText}>
                {`Practice these (${filteredFavoriteCards.length})`}
              </Text>
            </Pressable>
          ) : (
            <View style={styles.favoritesEmptyFilter}>
              <Text style={styles.favoritesEmptyFilterText}>
                {favoritePracticeModeKind === "due"
                  ? "Nothing due right now."
                  : favoritePracticeModeKind === "related"
                    ? "No saved words from your current level yet."
                    : "No favorites match this filter."}
              </Text>
            </View>
          )}
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
      ? [
          {
            key: "settings-language-none",
            label: "No preference",
            active: preferences.targetLanguages.length === 0,
            onPress: () => {
              setPreferences((current) => ({
                ...current,
                targetLanguages: [],
              }));
              setPreferencesStatus("idle");
            },
          },
          ...LANGUAGE_OPTIONS.filter((l) => l !== "Chinese").map((language) => ({
            key: `settings-language-${language}`,
            label: language,
            active: preferences.targetLanguages.includes(language),
            onPress: () => {
              setPreferences((current) => {
                const has = current.targetLanguages.includes(language);
                const next = has
                  ? current.targetLanguages.filter((l) => l !== language)
                  : [...current.targetLanguages, language];
                return { ...current, targetLanguages: next };
              });
              setPreferencesStatus("idle");
            },
          })),
        ]
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
                  ? [] // journeyFocus picker removed; focus is captured in onboarding
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
        // "Journey focus" se removió de Settings: el focus ahora se
        // captura en el onboarding eligiendo el Journey de Studio.
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
      onSavePicker={settingsPickerSection === "language" ? () => {
        setSettingsPickerSection(null);
        void savePreferences();
      } : undefined}
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

  // Globally-next story across the whole track (all levels, all topics).
  // This is what the Duolingo-style scroll renders with the "START"
  // bubble + cyan circle; every other node is greyed out. Walks the
  // track in order and returns the first story that's unlocked but not
  // completed. Returns null when everything is done.
  const globalJourneyNextStoryId = useMemo<string | null>(() => {
    if (!activeJourneyTrack) return null;
    for (const level of activeJourneyTrack.levels) {
      for (const topic of level.topics) {
        for (const story of topic.stories) {
          // The "next" pointer skips three states:
          //  - completed: audio + exercises done (full mastery)
          //  - audioFinished: user listened to the story already
          //    (read it once, exercises pending)
          //  - skipped: below the placement test level
          // The first story that's unlocked AND none of those is
          // the user's current target.
          if (
            story.unlocked &&
            !story.completed &&
            !story.audioFinished &&
            !story.skipped
          ) {
            return story.id;
          }
        }
      }
    }
    return null;
  }, [activeJourneyTrack]);

  // Set of story ids that come AFTER the global "next" pointer in
  // the path's logical order. Tapping any of these should show the
  // placement-test offer popup instead of opening the reader —
  // they're the user's "future" content, not yet earned. Stories
  // before the next (completed, audioFinished, skipped) are
  // re-readable; the next itself opens normally.
  const postNextStoryIds = useMemo<Set<string>>(() => {
    // Model B: candado solo en niveles que están bloqueados (CEFR boundary).
    // Dentro de un nivel desbloqueado, todas las historias son accesibles —
    // el orden secuencial sigue siendo visible vía la pill "next" pero ya
    // no es un gate. Una historia entra en este Set solo cuando el backend
    // marcó `unlocked: false`, lo que significa que su nivel todavía no ha
    // sido alcanzado por el usuario.
    const set = new Set<string>();
    if (!activeJourneyTrack) return set;
    for (const level of activeJourneyTrack.levels) {
      for (const topic of level.topics) {
        for (const story of topic.stories) {
          if (!story.unlocked) set.add(story.id);
        }
      }
    }
    return set;
  }, [activeJourneyTrack]);

  // Ref attached to the "next" node once it renders, plus a flag that
  // makes sure the auto-scroll only fires once per track load. The
  // actual scroll is a one-shot in the onLayout handler of the next
  // node — we measure its offset inside shellScrollRef and jump there.
  const journeyNextNodeRef = useRef<View | null>(null);
  const journeyAutoScrolledRef = useRef<string | null>(null);
  useEffect(() => {
    // Reset when the track changes so the auto-scroll fires again for
    // the new track's next.
    journeyAutoScrolledRef.current = null;
  }, [activeJourneyTrack?.id, globalJourneyNextStoryId]);

  // Loop del halo + float de la story "next". Se rearma ante varias
  // señales para no quedar "muerto":
  //   - El journey se vuelve visible (activeScreen pasa a "home").
  //   - El track activo cambia (el usuario picó otro Studio Journey)
  //     — los Animated.View se desmontan/remontan y necesitan
  //     re-suscribirse al valor.
  //   - La "next" salta a otra historia (los views previos se
  //     desmontan; los nuevos necesitan ver el valor oscilando).
  //   - La app vuelve de background — iOS puede pausar timings y al
  //     despertar el loop puede no reanudar solo.
  // JS-driven (useNativeDriver:false): con native driver el loop se
  // pausa a mitad bajo Low Power Mode / frame drops y queda congelado.
  // El loop sólo controla 1 valor de opacity + 1 translateY, así que
  // el costo de manejarlo en JS es despreciable.
  useEffect(() => {
    if (activeScreen !== "home") return;
    if (!globalJourneyNextStoryId) return;

    let loop: Animated.CompositeAnimation | null = null;
    function startPulse() {
      if (loop) loop.stop();
      // stopAnimation defensivo: si una timing previa quedó "in
      // flight" (p.ej. interrumpida por un AppState change) podría
      // seguir corriendo en paralelo con la nueva loop y pisar el
      // valor. Forzar el stop antes del setValue garantiza arranque
      // limpio.
      journeyNextPulse.stopAnimation();
      journeyNextPulse.setValue(0.25);
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(journeyNextPulse, {
            toValue: 0.85,
            duration: 1100,
            easing: Easing.inOut(Easing.ease),
            // JS-driven (useNativeDriver:false) a propósito. Con
            // native driver el loop se quedaba congelado al cambiar
            // de tab + interactuar + volver a home: el rearm del
            // useEffect creaba una loop nueva mientras el thread
            // nativo aún tenía el estado inconsistente del anterior,
            // y la nueva timing arrancaba muerta. La razón histórica
            // para pasar a native driver fue evitar congelamientos
            // bajo carga de renders, pero la causa real era que el
            // style del Animated.View se reconstruía inline cada
            // render y disparaba detach+attach del listener. Eso ya
            // está resuelto memoizando los styles (NextStoryGlowOverlay
            // + nextStoryFloatStyle), así que JS driver vuelve a ser
            // seguro y resuelve el problema del rearm.
            useNativeDriver: false,
          }),
          Animated.timing(journeyNextPulse, {
            toValue: 0.25,
            duration: 1100,
            easing: Easing.inOut(Easing.ease),
            // Mismo driver que el timing previo: mezclar JS y native
            // en una `Animated.sequence` crashea RN al mount con
            // "Attempting to run JS driven animation on animated node
            // that has been moved to native driver". El timing previo
            // ya está en JS driver por la razón documentada arriba,
            // este DEBE estar igual.
            useNativeDriver: false,
          }),
        ])
      );
      loop.start();
    }

    startPulse();

    const sub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") startPulse();
    });

    return () => {
      sub.remove();
      if (loop) loop.stop();
    };
  }, [journeyNextPulse, activeScreen, activeJourneyTrack?.id, globalJourneyNextStoryId]);

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
      setActiveScreen("home");
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
      const journeyLang = activeJourneyLanguage || remoteJourney?.language || "Spanish";
      const payload = await apiFetch<MobileJourneyPayload>({
        baseUrl: mobileConfig.apiBaseUrl,
        path: `/api/mobile/journey?language=${encodeURIComponent(journeyLang)}`,
        token: sessionToken,
      });
      setRemoteJourney(payload);
    } catch (error) {
      console.error("[mobile journey] failed to refresh after placement update", error);
    }
  }

  // (Removed: an older "force scrollTo(0) every time activeScreen
  // becomes journey" effect lived here. It was added to defeat a now-
  // gone auto-scroll-to-next behavior, and competed with the new
  // scroll-restore-on-tab-return useEffect — its rAF would fire AFTER
  // the restore, snapping the user back to the top. The restore path
  // already covers first-visit-lands-at-top because shellScrollYRef
  // defaults to 0.)

  // Auto-select the first target language when the user lands in
  // Journey for the first time. Replaces the old "My Languages" full-
  // screen hub: the user is always inside a journey, switching is a
  // bottom-sheet action via the flag chip.
  useEffect(() => {
    if (activeJourneyLanguage) return;
    if (!sessionToken) return;
    const first = preferences.targetLanguages[0];
    if (!first) return;
    setActiveJourneyLanguage(first);
    void loadJourneyForLanguage(first);
    // Intentionally narrow deps: we only want this to fire when the
    // user's target list arrives or changes meaningfully — not on
    // every loadJourneyForLanguage identity bump.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeJourneyLanguage, preferences.targetLanguages, sessionToken]);
  // The hub is gone — kept as a const for the few places below that
  // still branch on it, but it's always false now.
  const showJourneyHub = false;

  // Helper that renders a single story node row inside the journey
  // path. Extracted so the path render can be a flat ReactNode[]
  // (no nested .map wrappers) — that flat structure is required for
  // the ScrollView's native `stickyHeaderIndices` to pin the topic
  // panels at the top of the screen and produce the proper Duolingo
  // "next panel slides over previous" eclipse swap.
  const renderJourneyStoryNode = (
    story: NonNullable<typeof activeJourneyTrack>["levels"][number]["topics"][number]["stories"][number],
    storyIdx: number,
    level: NonNullable<typeof activeJourneyTrack>["levels"][number],
    topic: NonNullable<typeof activeJourneyTrack>["levels"][number]["topics"][number]
  ) => {
    const offlineCopy =
      offlineStoriesById.get(story.id) ??
      offlineSnapshot?.stories.find((s) => s.storySlug === story.storySlug);
    const durationMin = offlineCopy?.text
      ? estimateReadMinutes(offlineCopy.text)
      : null;
    // Soft serpentine: each story pill sits at a horizontal offset
    // that walks rightward by a fixed step until it hits the right
    // edge of the path, then walks back left, then back right, etc.
    // Independent of total story count — with 3 stories we get
    // 0/25/50 (still ascending, no return yet); with 5 we get
    // 0/25/50/25/0 (full cycle); with 7 we get 0/25/50/25/0/25/50.
    // Earlier versions used a triangle wave with peak at the middle,
    // which caused short topics (3 stories) to "return" too early —
    // the third story landed back at the leftmost position even
    // though the second had only just reached the right edge.
    const STEP_PX = 28;
    const MAX_WAVE_OFFSET_PX = 112;
    const PERIOD = (MAX_WAVE_OFFSET_PX / STEP_PX) * 2; // 8 with these values
    const phase = storyIdx % PERIOD;
    const waveOffsetPx =
      phase <= PERIOD / 2 ? phase * STEP_PX : (PERIOD - phase) * STEP_PX;
    // ANY locked story → open the level test offer modal. We
    // always show the modal (no toast fallback): the journey
    // screen guarantees a language, and falling back to the toast
    // hid the modal in edge cases where activeJourneyLanguage was
    // momentarily null right after a navigation event.
    const showLockedHint = () => {
      const lang =
        activeJourney?.language ??
        activeJourneyLanguage ??
        remoteJourney?.language ??
        preferences.targetLanguages[0] ??
        "Spanish";
      setLevelTestOfferOpen({
        targetLevel: (level.id ?? "").toUpperCase() || level.title,
        targetLanguage: lang,
      });
    };
    const isNextAction = globalJourneyNextStoryId === story.id;
    const isPostNext = postNextStoryIds.has(story.id);
    // Five-state variant for visual rendering:
    //   - completed: audio + exercises done → green check (mastery)
    //   - audioFinished: audio done, exercises pending → subtle
    //     intermediate indicator (no green check, just "you've
    //     been here")
    //   - next: the current target → bright "START NOW" pill
    //   - locked: a story past `next` that the user hasn't earned →
    //     greyed out; tap shows the placement-test offer popup
    //   - step: re-readable but not progressed (e.g. a `skipped`
    //     story below the placement level)
    const nodeVariant:
      | "completed"
      | "audioFinished"
      | "next"
      | "locked"
      | "step" = story.completed
      ? "completed"
      : story.audioFinished
        ? "audioFinished"
        : isNextAction
          ? "next"
          : isPostNext
            ? "locked"
            : "step";
    const pillLabel = story.title?.trim() || `Story ${storyIdx + 1}`;

    // El glow del "next" usa el color del tema actual, así la
    // historia recomendada queda visualmente integrada con el panel
    // del topic en el que vive.
    const topicColor = topicPanelColor(topic.slug, level.id);

    return (
      <View
        // Compound key (level.id + topic.slug + story.id) — story
        // ids should be globally unique already, but compound keys
        // are cheap insurance against any duplicate-key dedupe bug
        // similar to the topic-panel one we just fixed.
        key={`sn-${level.id}-${topic.slug}-${story.id}`}
        style={[
          styles.journeyPathNodeRow,
          { paddingLeft: waveOffsetPx },
        ]}
      >
        {(() => {
          // The "next" variant used to render a separate bright-white pill
          // wrapped in a glowing halo. It read as oversized and gritty
          // against the path of neutral cards. Now it renders through the
          // same Pressable as every other story, so the BOX itself stays
          // identical in size and weight; we only overlay a thin cyan
          // breathing inset ring + a subtle background tint so the user's
          // eye lands on it without the row screaming.
          // Glow pulsante del color del topic. Renderizado vía
          // `NextStoryGlowOverlay` (memo) a nivel de módulo: ni el
          // style array ni el objeto `{ backgroundColor, opacity }`
          // se reconstruyen entre renders del shell, así el listener
          // nativo del Animated.View del halo queda enganchado de
          // forma persistente. Memoizar sólo el `interpolate()` no
          // alcanzaba: el style inline cambiaba referencia en cada
          // render igual y disparaba detach+attach.
          const nextOverlay =
            nodeVariant === "next" ? (
              <NextStoryGlowOverlay
                color={topicColor}
                opacity={journeyNextPulseOpacity}
              />
            ) : null;

          // Sheen superior translúcido (variante E elegida) sobre el
          // sólido del color del topic — sólo en la "next".
          const nextSheen =
            nodeVariant === "next" ? (
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: "55%",
                  backgroundColor: "rgba(255,255,255,0.16)",
                  borderTopLeftRadius: 18,
                  borderTopRightRadius: 18,
                }}
              />
            ) : null;

          // Banda diagonal que pasa cada ~4 s usando shimmerPulse
          // (loop con delay) — sólo en la "next".
          const nextShimmer =
            nodeVariant === "next" ? (
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  borderRadius: 18,
                  overflow: "hidden",
                }}
              >
                <Animated.View
                  style={{
                    position: "absolute",
                    top: -40,
                    left: 0,
                    width: 90,
                    height: 200,
                    backgroundColor: "rgba(255,255,255,0.12)",
                    transform: [
                      {
                        translateX: shimmerPulse.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-180, 360],
                        }),
                      },
                      { rotate: "20deg" },
                    ],
                  }}
                />
              </View>
            ) : null;

          // Float vertical sutil. Usa el style memoizado a nivel del
          // shell (`nextStoryFloatStyle`) en vez de construirlo inline
          // aquí, así el Animated.View no detache+attache su listener
          // native al cambiar de tab y volver a home.
          const nextFloatStyle = nodeVariant === "next" ? nextStoryFloatStyle : null;

          const pressable = (
          <Pressable
            onPress={() => {
              // Tap behavior is now driven by position vs the
              // "next" pointer, not by `unlocked`. Stories that
              // come after `next` show the placement-test offer
              // popup; everything before (or at) next opens for
              // (re)reading. This preserves the rule that the
              // green check is earned only via audio + exercises
              // — placement still gates progression but doesn't
              // forge completions.
              if (postNextStoryIds.has(story.id)) {
                showLockedHint();
                return;
              }
              openJourneyStory(story);
            }}
            accessibilityRole="button"
            accessibilityLabel={`qa-journey-story-${story.id}`}
            testID={`qa-journey-story-${story.id}`}
            style={[
              styles.journeyNodePill,
              nodeVariant === "completed" ? styles.journeyNodePillCompleted : null,
              nodeVariant === "audioFinished" ? styles.journeyNodePillAudioFinished : null,
              nodeVariant === "locked" ? styles.journeyNodePillLocked : null,
              nodeVariant === "step" ? styles.journeyNodePillStep : null,
              // La "next" usa la variante E elegida: sólida del color
              // del topic + sheen overlay arriba (renderizado abajo) +
              // glow pulsante + shimmer cada 4 s + float vertical sutil.
              nodeVariant === "next"
                ? { backgroundColor: topicColor, borderColor: topicColor, borderWidth: 0 }
                : null,
            ]}
          >
            {nextOverlay}
            {nextSheen}
            {nextShimmer}
            <View
              style={[
                styles.journeyNodePillIcon,
                nodeVariant === "completed" ? styles.journeyNodePillIconCompleted : null,
                nodeVariant === "audioFinished" ? styles.journeyNodePillIconAudioFinished : null,
                nodeVariant === "locked" ? styles.journeyNodePillIconLocked : null,
                nodeVariant === "step" ? styles.journeyNodePillIconStep : null,
              ]}
            >
              {story.coverUrl ? (
                <>
                  <View
                    style={[
                      styles.journeyNodePillThumbWrap,
                          ]}
                  >
                    <ProgressiveImage
                      uri={getCoverUrl(story.coverUrl, 128)}
                      style={[
                        styles.journeyNodePillCoverThumb,
                                // The "next" recommended story shows its cover at
                        // full brightness — same as `completed` — so the
                        // box reads as luminous, not muted. Only past/locked
                        // stories get the dim treatment.
                        nodeVariant === "completed" || nodeVariant === "next"
                          ? styles.journeyNodePillCoverThumbCompleted
                          : styles.journeyNodePillCoverThumbDim,
                      ]}
                      resizeMode="cover"
                    />
                  </View>
                  {/* Status badge — completed gets a green check
                      ("you mastered this"), audioFinished gets a
                      headphones icon ("you've heard this but the
                      exercises are pending"), locked gets the
                      padlock. step doesn't render a badge. */}
                  {nodeVariant === "completed" ||
                  nodeVariant === "audioFinished" ||
                  nodeVariant === "locked" ? (
                    <View
                      style={[
                        styles.journeyNodePillThumbBadge,
                        nodeVariant === "completed"
                          ? styles.journeyNodePillThumbBadgeCompleted
                          : nodeVariant === "audioFinished"
                            ? styles.journeyNodePillThumbBadgeAudioFinished
                            : styles.journeyNodePillThumbBadgeLocked,
                      ]}
                    >
                      {nodeVariant === "completed" ? (
                        <Feather name="check" size={11} color="#0c1626" />
                      ) : nodeVariant === "audioFinished" ? (
                        // Outline check (same shape as the green
                        // mastery check) to convey "started, not
                        // mastered" — the badge style itself is
                        // hollow cyan, see journeyNodePillThumb-
                        // BadgeAudioFinished.
                        <Feather name="check" size={11} color="#7dd3fc" />
                      ) : (
                        <Feather name="lock" size={10} color="#cdd9ec" />
                      )}
                    </View>
                  ) : null}
                </>
              ) : nodeVariant === "completed" ? (
                <Feather name="check" size={18} color="#0c1626" />
              ) : nodeVariant === "audioFinished" ? (
                <Feather name="check" size={16} color="#7dd3fc" />
              ) : nodeVariant === "locked" ? (
                <Feather name="lock" size={15} color="#7a8aa5" />
              ) : (
                <Feather name="play" size={16} color="#cdd9ec" />
              )}
            </View>
            <View style={styles.journeyNodePillTextStack}>
              <Text style={styles.journeyNodePillLabel} numberOfLines={2}>
                {pillLabel}
              </Text>
              {/* Duración eliminada: el usuario no quiere ver "X min"
                  bajo el título de la story porque sólo aparecía en
                  algunas (las que tenían text offline cacheado) y la
                  inconsistencia se notaba. */}
            </View>
          </Pressable>
          );
          return nextFloatStyle ? (
            <Animated.View style={nextFloatStyle}>{pressable}</Animated.View>
          ) : (
            pressable
          );
        })()}
      </View>
    );
  };

  // Duolingo-style level palette: each level gets its own bright
  // background color so the user gets a visual cue when they cross
  // a level boundary. Falls back to the cyan-blue base for unknown
  // level ids.
  const levelPanelColor = (levelId: string | null | undefined): string => {
    const id = (levelId ?? "").toLowerCase();
    switch (id) {
      case "a1":
        return "#1f7ee0"; // cyan-blue (current default)
      case "a2":
        return "#58a700"; // green
      case "b1":
        return "#a560e8"; // purple
      case "b2":
        return "#ff9600"; // orange
      case "c1":
        return "#ff4b4b"; // red
      default:
        return "#1f7ee0";
    }
  };

  // Color por tema (no por nivel). Asignamos colores en ORDEN de
  // aparición (recorriendo levels → topics) en una paleta de 10
  // colores. Eso garantiza que dos topics consecutivos NUNCA tengan
  // el mismo color, cosa que el hash anterior no aseguraba.
  const TOPIC_PANEL_PALETTE = [
    "#1f7ee0", // blue
    "#58a700", // green
    "#a560e8", // purple
    "#ff9600", // orange
    "#ff4b4b", // red
    "#00b894", // teal
    "#e17055", // terracotta
    "#5dd9e8", // cyan
    "#f5b942", // amber
    "#ff8aa8", // pink
  ];
  const topicColorByKey = useMemo(() => {
    const map = new Map<string, string>();
    if (!activeJourneyTrack) return map;
    let idx = 0;
    for (const lvl of activeJourneyTrack.levels) {
      for (const t of lvl.topics) {
        map.set(`${lvl.id}:${t.slug}`, TOPIC_PANEL_PALETTE[idx % TOPIC_PANEL_PALETTE.length]);
        idx++;
      }
    }
    return map;
  }, [activeJourneyTrack]);
  const topicPanelColor = (
    topicSlug: string | null | undefined,
    levelId: string | null | undefined
  ): string => {
    const slug = (topicSlug ?? "").toLowerCase();
    if (!slug || !levelId) return levelPanelColor(levelId);
    const fromMap = topicColorByKey.get(`${levelId}:${slug}`);
    return fromMap ?? levelPanelColor(levelId);
  };

  // Measure a topic block's Y position relative to the ScrollView's
  // content view. Called from each topic block's `ref` and `onLayout`
  // so the position stays accurate as the layout settles (e.g. as
  // story cover images load and push content down).
  const measureTopicY = useCallback(
    (
      slug: string,
      label: string,
      levelLabel: string,
      bgColor: string,
      locked: boolean,
      viewNode: View
    ) => {
      const scrollable = shellScrollRef.current;
      if (!scrollable || !viewNode) return;
      // Older React Native exposes `getInnerViewNode()`; newer
      // versions return the node handle from `findNodeHandle` on the
      // inner ref. We prefer the former when present.
      const innerNode =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        typeof (scrollable as any).getInnerViewNode === "function"
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ? (scrollable as any).getInnerViewNode()
          : null;
      if (innerNode == null) return;
      viewNode.measureLayout(
        innerNode,
        (_x, y, _w, height) => {
          // ONLY accept the first measurement for each slug. Later
          // re-measurements (image loads shifting the topic by a
          // few px) overwrite layout.y while the scroll handler is
          // mid-flight, which causes the sticky panel to "rotate"
          // between two topics on every eclipse — exactly the
          // flicker the user reported.
          //
          // The trade-off is that if a cover loads after the user
          // scrolls past its block, the sticky's swap point is off
          // by however much that block shifted. In practice covers
          // load within the first 1–2s and the user is at the top,
          // so this is barely visible. Stable beats precise.
          if (topicLayoutsRef.current.has(slug)) return;
          topicLayoutsRef.current.set(slug, {
            y,
            height,
            label,
            levelLabel,
            bgColor,
            locked,
          });
          // Layout-driven recompute → silent. The haptic is reserved
          // for genuine onScroll-driven transitions; without this flag
          // every newly-measured topic would re-trigger recompute and
          // potentially fire its own haptic, multiplying ticks on fast
          // scroll where state changes drive bursts of remeasurement.
          recomputeStickyTopicRef.current?.(shellScrollYRef.current, true);
        },
        () => {
          // measureLayout failures are common during fast scroll —
          // we just skip and rely on the next onLayout / scroll pass.
        }
      );
    },
    []
  );
  // Forward declaration so `measureTopicY` can call the recompute
  // function defined just below without creating a circular
  // dependency in the useCallback dep arrays.
  const recomputeStickyTopicRef = useRef<((y: number, silent?: boolean) => void) | null>(null);

  // Re-evaluate which topic should be sticky based on the current
  // scroll Y. `silent=true` skips the haptic — used by layout-driven
  // call sites (measureTopicY, scroll-restore on tab return) so layout
  // re-measurements and programmatic scroll don't masquerade as user
  // scroll events. Only `handleJourneyScroll` (the genuine onScroll
  // path) leaves `silent` defaulted to `false` so the haptic fires
  // exactly once per real user-driven topic transition.
  const recomputeStickyTopic = useCallback((scrollY: number, silent: boolean = false) => {
    if (activeScreen !== "home" || journeyDetailTopicId) {
      if (stickyTopicSlugRef.current !== null) {
        stickyTopicSlugRef.current = null;
        setStickyTopic(null);
      }
      return;
    }
    // Eclipse trigger = 0: pixel-perfect overlap teórico cuando
    // `scrollY === layout.y`. En la práctica el throttle de onScroll
    // (16 ms) más el re-render de React (otro frame) introducen ~30 ms
    // de lag, lo que se ve como un breve "corte" antes de que el
    // flotante aparezca. Probamos TRIGGER=12 para anticipar pero el
    // resultado fue un "salto magnético" del panel hacia el top
    // (peor). Volvemos a 0 como fallback mientras el flotante JS
    // sigue siendo el mecanismo. La solución real es usar
    // `stickyHeaderIndices` nativo del ScrollView (sin lag).
    const TRIGGER = 0;
    const sortedByY = Array.from(topicLayoutsRef.current.entries()).sort(
      (a, b) => a[1].y - b[1].y
    );
    let foundCurrent: {
      slug: string;
      label: string;
      levelLabel: string;
      bgColor: string;
      locked: boolean;
    } | null = null;
    for (const [slug, layout] of sortedByY) {
      if (scrollY + TRIGGER >= layout.y) {
        foundCurrent = {
          slug,
          label: layout.label,
          levelLabel: layout.levelLabel,
          bgColor: layout.bgColor,
          locked: layout.locked,
        };
      }
    }
    // The sticky panel is only visible once a topic has actually
    // crossed the eclipse trigger. Before that, it stays null so
    // the in-flow first topic shows in its natural position.
    let current: typeof foundCurrent;
    if (foundCurrent) {
      current = foundCurrent;
    } else if (stickyTopicSlugRef.current === null) {
      // Nothing has crossed yet, no previous value to keep — stay
      // hidden (current === null).
      current = null;
    } else {
      // Had a value, but nothing currently crosses the trigger.
      // Two cases:
      //   1. User scrolled all the way back above every topic →
      //      hide the sticky so the in-flow first topic is visible
      //      in its natural position again. We detect this with
      //      `scrollY < firstY`.
      //   2. Same scroll position, just a stray re-measurement
      //      (image loaded, layout settled) → keep the previous
      //      value to avoid the banner switching on its own.
      const firstY = sortedByY[0]?.[1].y;
      if (firstY !== undefined && scrollY + TRIGGER < firstY) {
        current = null;
      } else {
        return;
      }
    }
    if (current?.slug !== stickyTopicSlugRef.current) {
      // Subtle iOS haptic at the eclipse moment. `selectionAsync` is
      // the lightest style (same tick as scrubbing through a picker
      // wheel). Tres guardas mantienen esto honesto:
      //
      //   1. `silent`: layout-driven recomputes (measureTopicY when a
      //      topic block first lays out, scroll-restore on tab return)
      //      pass silent=true. The haptic is reserved for genuine
      //      user-scroll-driven transitions only.
      //   2. Session set: within a single scroll gesture (drag + its
      //      momentum decay) each destination slug only fires haptic
      //      once. If iOS spring oscillation crosses a topic boundary
      //      the user already passed in this session, we drop it. A
      //      flick passing 5 topics → 5 haptics no matter the velocity;
      //      the bounce-back oscillation produces zero extra ticks
      //      because those slugs are already in the session set.
      //      Sessions reset on `onScrollBeginDrag` and clear on
      //      `onMomentumScrollEnd`.
      //   3. Solo topic→topic: las transiciones desde/hacia "sin
      //      sticky" (null) no son cambios de tema, son el primer
      //      panel apareciendo o desapareciendo al borde de la lista.
      //      Esos no vibran; sólo el cruce real de un topic a otro.
      const newSlug = current?.slug ?? null;
      const previousSlug = stickyTopicSlugRef.current;
      const isTopicToTopic = previousSlug !== null && newSlug !== null;
      if (!silent && isTopicToTopic) {
        const sessionKey = newSlug;
        if (!visitedSlugsInSessionRef.current.has(sessionKey)) {
          visitedSlugsInSessionRef.current.add(sessionKey);
          Haptics.selectionAsync().catch(() => {
            // Ignore — devices without a Taptic engine just get the
            // visual swap with no haptic.
          });
        }
      }
      stickyTopicSlugRef.current = newSlug;
      setStickyTopic(current);
    }
  }, [activeScreen, journeyDetailTopicId]);
  // Wire up the forward-declared ref above so `measureTopicY` can
  // call this on first measurement to seed the floating panel.
  recomputeStickyTopicRef.current = recomputeStickyTopic;

  // ScrollView onScroll handler. Cheap — just reads contentOffset.y
  // and forwards to the recompute logic. Throttled to 16ms via
  // `scrollEventThrottle` on the ScrollView itself.
  const handleJourneyScroll = useCallback(
    (event: { nativeEvent: { contentOffset: { y: number } } }) => {
      const y = event.nativeEvent.contentOffset.y;
      // Cache the latest scrollY so newly-mounted topic measurements
      // can seed the floating sticky panel against the current
      // scroll position (not stale 0).
      shellScrollYRef.current = y;
      recomputeStickyTopic(y);
      // Toggle the floating "back to top" arrow. ~280pt threshold
      // hides it when the user is near the top so it doesn't crowd
      // the path when not needed.
      const shouldShow = y > 280;
      if (shouldShow !== showJourneyScrollTopRef.current) {
        showJourneyScrollTopRef.current = shouldShow;
        setShowJourneyScrollTop(shouldShow);
      }
    },
    [recomputeStickyTopic]
  );

  // Reset the sticky topic when the user leaves the journey screen
  // (e.g. switches tabs) so a stale topic doesn't briefly flash on
  // top when they return.
  useEffect(() => {
    if (activeScreen !== "home" || journeyDetailTopicId) {
      stickyTopicSlugRef.current = null;
      setStickyTopic(null);
      topicLayoutsRef.current.clear();
      topicViewsRef.current.clear();
      // Hide the floating scroll-to-top arrow when leaving the
      // journey screen; otherwise it'd briefly flash when the
      // user returns at scrollY > 280 from a previous session.
      if (showJourneyScrollTopRef.current) {
        showJourneyScrollTopRef.current = false;
        setShowJourneyScrollTop(false);
      }
    }
  }, [activeScreen, journeyDetailTopicId]);

  // Reset the topic layouts whenever the active journey changes
  // (different language, different track id). Without this, two
  // journeys whose topic slugs collide ("food-everyday-life" exists
  // in Italian + Spanish) inherit each other's measured Y/labels
  // because `topicLayoutsRef` is keyed by slug only — the sticky
  // panel then shows the wrong topic name or position. Clearing on
  // track change forces a fresh measurement pass.
  const trackIdentityRef = useRef<string | null>(null);
  useEffect(() => {
    const identity = activeJourneyTrack
      ? `${activeJourneyLanguage ?? remoteJourney?.language ?? ""}::${activeJourneyTrack.id}`
      : null;
    if (identity !== trackIdentityRef.current) {
      trackIdentityRef.current = identity;
      stickyTopicSlugRef.current = null;
      setStickyTopic(null);
      topicLayoutsRef.current.clear();
      topicViewsRef.current.clear();
    }
  }, [activeJourneyTrack, activeJourneyLanguage, remoteJourney?.language]);

  // Restore the journey scroll position when the user comes back
  // from a story. The shell's early `return <ReaderScreen />`
  // unmounts the ScrollView, so on the way back its contentOffset
  // resets to 0. We saved the user's last journey scrollY in
  // `shellScrollYRef` (updated on every onScroll); we just need to
  // re-apply it once the ScrollView is mounted again. The recompute
  // call right after keeps the sticky panel consistent with the
  // restored position because programmatic scrollTo doesn't always
  // fire onScroll.
  const previousSelectionRef = useRef<typeof selection>(null);
  useEffect(() => {
    const wasOpen = previousSelectionRef.current !== null;
    const isOpen = selection !== null;
    previousSelectionRef.current = selection;
    if (wasOpen && !isOpen) {
      const targetY = shellScrollYRef.current;
      // Defer one frame so the ScrollView is mounted and ready.
      // Silent recompute — programmatic scroll-restore should not
      // emit a haptic.
      requestAnimationFrame(() => {
        shellScrollRef.current?.scrollTo({ y: targetY, animated: false });
        recomputeStickyTopicRef.current?.(targetY, true);
      });
    }
  }, [selection]);

  // Restore the journey scroll position when the user returns to the
  // Journey tab from another tab (Home, Practice, Favorites, …). The
  // shell uses ONE shared <ScrollView> and just swaps content based on
  // `activeScreen`, so the native contentOffset persists across tabs:
  // if the user scrolled Home to Y=400 and taps Journey, the
  // ScrollView lands at Y=400 instead of where Journey was last left.
  // Worse, `shellScrollYRef.current` still holds the journey's last Y
  // (since handleJourneyScroll only fires on Journey), so when topic
  // blocks remeasure on return they call recomputeStickyTopic against
  // the stale Y — surfacing a sticky banner that doesn't match the
  // actual scroll position. Re-applying the cached Y here aligns the
  // visual scroll with the cached value before the recompute runs.
  // Pending journey scroll-Y to restore the next time the ScrollView's
  // contentSize is large enough to honor it. Set when the user returns
  // to Journey from another tab; cleared by onContentSizeChange (once
  // applied) or by onScrollBeginDrag (the user took over). The pending
  // ref pattern is necessary because a single requestAnimationFrame on
  // tab return often fires BEFORE the journey path has finished
  // measuring its contentSize — `scrollTo(1500)` then gets clamped to
  // whatever maxOffset the ScrollView has at that frame (e.g. 400),
  // which silently kills the restore. By keeping the target around and
  // re-applying it whenever contentSize grows, we recover even when
  // images / nested layouts settle several frames late.
  const pendingJourneyRestoreYRef = useRef<number | null>(null);
  const previousActiveScreenRef = useRef(activeScreen);
  useEffect(() => {
    const previous = previousActiveScreenRef.current;
    previousActiveScreenRef.current = activeScreen;
    if (activeScreen !== "home") return;
    if (previous === "journey") return;
    if (selection !== null) return;
    const targetY = shellScrollYRef.current;
    pendingJourneyRestoreYRef.current = targetY;
    // First-attempt scrollTo on the next frame — covers the common case
    // where the content height is already large enough (warm cache,
    // returning from a quick tab visit). If it gets clamped, the
    // onContentSizeChange handler below will pick the pending target up
    // again once the content grows past it.
    requestAnimationFrame(() => {
      shellScrollRef.current?.scrollTo({ y: targetY, animated: false });
      // Silent — programmatic scroll restore on tab return should not
      // fire a haptic.
      recomputeStickyTopicRef.current?.(targetY, true);
    });
  }, [activeScreen, selection]);

  // Lifted out of `journeyView` so the shell can render it OUTSIDE
  // the main ScrollView and have it stay pinned to the top of the
  // screen while the path content scrolls underneath. Earlier this
  // sat at the top of the journey content and scrolled away — the
  // user reported "tampoco queda sticky la primera línea" because
  // of that. Rendered conditionally in the shell render below when
  // `activeScreen === "home" && !journeyDetailTopicId`.
  const journeyPathTopBar = (
    <View style={styles.journeyTopStripFixed}>
      <Pressable
        onPress={() => setLanguageSwitchOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="qa-journey-language-switch"
        testID="qa-journey-language-switch"
        hitSlop={12}
        style={({ pressed }) => [
          styles.journeyHeaderFlagBadge,
          pressed ? styles.journeyHeaderFlagBadgePressed : null,
        ]}
      >
        <LanguageFlag
          language={activeJourney?.language ?? activeJourneyLanguage ?? preferences.targetLanguages[0] ?? null}
          variant={
            activeJourney
              ? journeyFlagVariant(activeJourney)
              : preferences.preferredVariant
          }
          size={34}
        />
        {(() => {
          const lang = activeJourney?.language ?? activeJourneyLanguage ?? preferences.targetLanguages[0] ?? null;
          const code = languageShortCode(lang);
          if (!code) return null;
          return <Text style={styles.journeyHeaderLanguageCode}>{code}</Text>;
        })()}
        <Feather name="chevron-down" size={14} color="rgba(255,255,255,0.55)" />
      </Pressable>

      {remoteProgress?.gamification ? (
        <Pressable
          onPress={() => setProgressSheetOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Open progress sheet"
          style={styles.journeyHeaderStatsRow}
        >
          <View style={styles.journeyHeaderStat}>
            <Feather name="zap" size={13} color={tokenColor.streak} />
            <Text style={[styles.journeyHeaderStatText, { color: tokenColor.streak }]}>
              {remoteProgress.gamification.dailyStreak}
            </Text>
          </View>
          <View style={styles.journeyHeaderStat}>
            <Feather name="award" size={13} color={tokenColor.gold} />
            <Text style={[styles.journeyHeaderStatText, { color: tokenColor.gold }]}>
              Lv {remoteProgress.gamification.currentLevel}
            </Text>
          </View>
          <View style={styles.journeyHeaderStat}>
            <Feather name="star" size={13} color={tokenColor.cyan} />
            <Text style={[styles.journeyHeaderStatText, { color: tokenColor.cyan }]}>
              {remoteProgress.gamification.totalXp >= 1000
                ? `${(remoteProgress.gamification.totalXp / 1000).toFixed(1)}k`
                : remoteProgress.gamification.totalXp}
            </Text>
          </View>
        </Pressable>
      ) : null}
      <MenuTrigger onPress={() => setMenuOpen(true)} />
    </View>
  );

  // Sticky indices for the journey path's topic panels — computed
  // based on their position within the journeyView's flat children
  // list. iOS native `stickyHeaderIndices` on the ScrollView uses
  // these to pin each topic panel at the top of the screen while
  // its stories scroll under it, then slides the next panel over
  // the previous as boundaries cross (Duolingo-style eclipse).
  // Empty array on screens that aren't path mode → ScrollView
  // gets `undefined` and behaves normally.
  const journeyStickyIndices: number[] = [];
  const useNativeJourneySticky =
    activeScreen === "home" &&
    !journeyDetailTopicId &&
    !journeyVariantPickerOpen &&
    Boolean(activeJourneyTrack);
  if (useNativeJourneySticky && activeJourneyTrack) {
    let count = 0;
    activeJourneyTrack.levels.forEach((level, levelIdx) => {
      if (levelIdx > 0) count += 1; // level header item
      level.topics.forEach((topic) => {
        journeyStickyIndices.push(count);
        count += 1; // topic panel itself (the sticky one)
        count += topic.stories.length; // each story node
      });
      // Level-end gate (espejea las condiciones del flatMap más
      // abajo). Sin este conteo, los niveles posteriores quedan
      // corridos por 1 → off-by-one que rompía el sticky nativo.
      const gatingTopics = level.topics.filter((t) => t.storyCount > 0);
      const clearedTopics = gatingTopics.filter((t) => t.checkpointPassed).length;
      const requiredForLevel = Math.max(1, Math.ceil(gatingTopics.length * 0.75));
      const nextLevelInTrackForCount = activeJourneyTrack?.levels[levelIdx + 1] ?? null;
      if (
        level.unlocked &&
        nextLevelInTrackForCount &&
        gatingTopics.length > 0 &&
        clearedTopics < requiredForLevel
      ) {
        count += 1;
      }
    });
  }

  const journeyView = (
    <>
      {/* Detail-mode hero only — the path-mode top strip was lifted
          out of the scroll content and lives in the shell render
          (`journeyPathTopBar`) so it can stay sticky at the top of
          the screen while the path scrolls underneath. */}
      {journeyDetailTopicId && activeJourneyTopic ? (
        <View style={[styles.hero, styles.journeyHero]}>
          <View style={styles.heroHeaderRow}>
            <View style={[styles.heroTextBlock, styles.journeyHeroTextBlock]}>
              <Text style={styles.sectionEyebrow}>{activeJourneyLevel?.title ?? "Journey"}</Text>
              <Text style={styles.journeyHeroTitle}>{activeJourneyTopic.label}</Text>
              <Text style={styles.journeyHeroSubtitle}>Read the stories, practice, then clear the checkpoint.</Text>
            </View>
            <MenuTrigger onPress={() => setMenuOpen(true)} />
          </View>
        </View>
      ) : null}

      {/* Eliminados: el hub "My Languages" (ahora vive en el bottom
          sheet del flag chip), el botón vestigio "All languages" que
          apuntaba a ese hub muerto, y el variant picker que reemplazaba
          el path con una pantalla casi vacía. La selección de variante
          quedaría para JourneysPanel/settings; el path siempre debe
          mostrar contenido. */}

      {/* Old insights bar (progress %, steps, due pills) removed — all that
          info is now inline in the journey top strip. */}

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

      {!showJourneyHub && !journeyVariantPickerOpen && !journeyDetailTopicId && (loadingRemote || journeyLanguageLoading) && !activeJourneyTrack ? (
        <View style={styles.section}>
          <PulseDots label={activeJourneyLanguage ? `Loading ${activeJourneyLanguage} journey…` : "Loading journey…"} />
        </View>
      ) : null}

      {/* Full Duolingo-style path — flattened (no wrapping section /
          level / topic Views) so each topic panel can be a direct
          child of the shell ScrollView. stickyHeaderIndices for the
          topic panels was disabled (see ScrollView prop below) after
          we confirmed it was clipping the path's content to A1 only;
          re-enable once the index off-by-one against the journeyView
          fragment's other children is solved. */}
      {!showJourneyHub && !journeyVariantPickerOpen && activeJourneyTrack
        ? activeJourneyTrack.levels.flatMap((level, levelIdx) => {
            const items: React.ReactNode[] = [];
            // Level header (skip for first level — the top bar
            // already shows the active level code).
            if (levelIdx > 0) {
              items.push(
                <View
                  key={`lh-${level.id}`}
                  style={[
                    styles.journeyPathLevelHeader,
                    !level.unlocked ? styles.journeyPathLevelHeaderLocked : null,
                  ]}
                >
                  <Text style={styles.journeyPathLevelBadge}>{level.title}</Text>
                </View>
              );
            }
            // Compute level progress for the gate hint we render after the
            // last topic. Only gating topics (with stories) count toward the
            // 75% threshold the backend enforces; empty placeholders don't.
            const gatingTopics = level.topics.filter((t) => t.storyCount > 0);
            const clearedTopics = gatingTopics.filter((t) => t.checkpointPassed).length;
            const requiredForLevel = Math.max(1, Math.ceil(gatingTopics.length * 0.75));
            const nextLevelInTrack = activeJourneyTrack?.levels[levelIdx + 1] ?? null;
            level.topics.forEach((topic, topicIdx) => {
              // Topic panel — sticky. Direct sibling of other path
              // children so stickyHeaderIndices on the ScrollView
              // can target it. Compound key (level.id + topic.slug)
              // because the same topic slug ("food", "home", etc.)
              // can repeat across levels — React would silently
              // dedupe siblings with identical keys and skip the
              // A2 / B1 copies, which matches the user's report
              // that "only A1 levels show up".
              const levelLabelForSticky = `LEVEL ${(level.id ?? "").toUpperCase() || level.title}`;
              const bgColorForSticky = topicPanelColor(topic.slug, level.id);
              items.push(
                <View
                  // Wrapper exists so we have a stable native node
                  // to measure with `measureLayout` against the
                  // ScrollView. Used by the JS-driven floating
                  // sticky panel. Pressable would also accept a ref
                  // but its native node varies across RN versions
                  // and platforms — a plain View is the reliable
                  // measurement target.
                  key={`tp-${level.id}-${topic.slug}`}
                  ref={(node) => {
                    if (node) {
                      topicViewsRef.current.set(topic.slug, node);
                      // Only measure if we don't already have a
                      // layout for this slug. Re-renders that fire
                      // the ref callback again with a new node (a
                      // remount) used to also delete and re-measure
                      // — that path turned a stray re-mount into a
                      // recompute, which during a `setState` storm
                      // (e.g. from opening the locked-story modal)
                      // produced the cascading flicker the user
                      // reported. Treat the ref as "pin the node",
                      // not "force a re-measure".
                      if (!topicLayoutsRef.current.has(topic.slug)) {
                        requestAnimationFrame(() => {
                          measureTopicY(
                            topic.slug,
                            topic.label,
                            levelLabelForSticky,
                            bgColorForSticky,
                            !topic.unlocked,
                            node
                          );
                        });
                      }
                    } else {
                      topicViewsRef.current.delete(topic.slug);
                      // Intentionally NOT deleting from
                      // topicLayoutsRef here. If RN remounts the
                      // wrapper for any reason, keeping the layout
                      // means the next mount won't re-measure and
                      // re-fire recompute. The layout is only
                      // cleared when the user leaves the journey
                      // screen (the useEffect below).
                    }
                  }}
                  onLayout={() => {
                    // Re-measure when story covers finish loading
                    // and push content down — keeps the sticky swap
                    // point accurate.
                    const node = topicViewsRef.current.get(topic.slug);
                    if (node)
                      measureTopicY(
                        topic.slug,
                        topic.label,
                        levelLabelForSticky,
                        bgColorForSticky,
                        !topic.unlocked,
                        node
                      );
                  }}
                >
                <Pressable
                  onPress={() => {
                    // Topics are always tappable — even on locked
                    // levels — so the user can preview stories +
                    // vocab as motivation to reach the level. Only
                    // the individual story nodes stay locked.
                    // 1. Open the preview instantly using whatever
                    //    vocab the offline cache has (likely none on
                    //    a fresh install). The sheet renders right
                    //    away so there's no perceived delay.
                    const offlineVocab: string[] = [];
                    const seenWords = new Set<string>();
                    for (const story of topic.stories) {
                      // Lookup primero por slug (estable entre journey
                      // y standalone API), después por id. Sin esto,
                      // las stories descargadas vía journey no
                      // matcheaban porque sus storyIds difieren.
                      const offlineCopy =
                        (story.storySlug
                          ? offlineStoriesBySlug.get(story.storySlug)
                          : undefined) ??
                        offlineStoriesById.get(story.id) ??
                        offlineSnapshot?.stories.find(
                          (s) => s.storySlug === story.storySlug
                        );
                      if (!offlineCopy?.vocabRaw) continue;
                      const items = parseStandaloneVocab(offlineCopy.vocabRaw);
                      for (const item of items) {
                        const word = item.word?.trim();
                        if (!word) continue;
                        const key = word.toLowerCase();
                        if (seenWords.has(key)) continue;
                        seenWords.add(key);
                        offlineVocab.push(word);
                      }
                    }
                    // Decide upfront if a background fetch will run —
                    // we want isVocabLoading to be `true` from the
                    // very first render of the sheet so the loading
                    // skeleton replaces the fallback hint without
                    // any one-frame flash.
                    // Re-fetch from server when the offline cache hasn't
                    // covered every story in the topic — that gives us
                    // the full vocab (all stories, all unique words)
                    // even when the user has only downloaded some.
                    const offlineCoverage = topic.stories.filter((s) => {
                      const cached =
                        (s.storySlug
                          ? offlineStoriesBySlug.get(s.storySlug)
                          : undefined) ??
                        offlineStoriesById.get(s.id) ??
                        offlineSnapshot?.stories.find(
                          (cs) => cs.storySlug === s.storySlug
                        );
                      return Boolean(cached?.vocabRaw);
                    }).length;
                    const willFetchVocab =
                      offlineCoverage < topic.stories.length &&
                      Boolean(sessionToken) &&
                      topic.stories.some((s) => Boolean(s.storySlug));
                    setTopicPreviewOpen({
                      levelId: (level.id ?? "").toUpperCase() || level.title,
                      topicLabel: topic.label,
                      topicSlug: topic.slug,
                      bgColor: topicPanelColor(topic.slug, level.id),
                      stories: topic.stories.map((s) => ({
                        id: s.id,
                        title: s.title,
                        coverUrl: s.coverUrl ?? null,
                      })),
                      vocabWords: offlineVocab,
                      isVocabLoading: willFetchVocab,
                    });

                    // 2. If the offline cache didn't fully populate
                    //    the chip row, batch-fetch vocab from the
                    //    `/api/standalone-stories?slugs=` endpoint
                    //    (single request, comma-separated slugs).
                    //    Skip when we already have ≥6 words offline
                    //    or when no session token is available.
                    if (!willFetchVocab) return;
                    const slug = topic.slug;
                    const storySlugs = topic.stories
                      .map((s) => s.storySlug)
                      .filter((s): s is string => Boolean(s));
                    if (storySlugs.length === 0) return;
                    void (async () => {
                      try {
                        const payload = await apiFetch<{
                          stories?: Array<{ vocabRaw?: string | null; storySlug?: string }>;
                        }>({
                          baseUrl: mobileConfig.apiBaseUrl,
                          path: `/api/standalone-stories?slugs=${encodeURIComponent(storySlugs.join(","))}`,
                          token: sessionToken,
                          timeoutMs: 12000,
                        });
                        const remoteStories = payload.stories ?? [];
                        const fetchedVocab: string[] = [...offlineVocab];
                        const fetchedSeen = new Set(seenWords);
                        for (const remote of remoteStories) {
                          const items = parseStandaloneVocab(remote.vocabRaw ?? null);
                          for (const item of items) {
                            const word = item.word?.trim();
                            if (!word) continue;
                            const key = word.toLowerCase();
                            if (fetchedSeen.has(key)) continue;
                            fetchedSeen.add(key);
                            fetchedVocab.push(word);
                          }
                        }
                        // Only update if the preview is still open
                        // for the same topic — otherwise the user
                        // moved on and we'd be overwriting unrelated
                        // state.
                        setTopicPreviewOpen((current) => {
                          if (!current || current.topicSlug !== slug) return current;
                          return { ...current, vocabWords: fetchedVocab, isVocabLoading: false };
                        });
                      } catch (err) {
                        console.warn("[topic-preview] vocab fetch failed", err);
                        setTopicPreviewOpen((current) => {
                          if (!current || current.topicSlug !== slug) return current;
                          return { ...current, isVocabLoading: false };
                        });
                      }
                    })();
                  }}
                  style={[
                    styles.journeyTopicPanel,
                    styles.journeyTopicPanelBevel,
                    { backgroundColor: topicPanelColor(topic.slug, level.id) },
                    // Con sticky nativo iOS no escondemos el in-flow:
                    // iOS pinea el View directamente. Si lo
                    // ocultáramos con opacity:0 estaría pineando un
                    // panel invisible. Esta rama sólo aplica al
                    // overlay JS-driven (cuando useNativeJourneySticky=false).
                    !useNativeJourneySticky && stickyTopic?.slug === topic.slug
                      ? styles.journeyTopicPanelHidden
                      : null,
                  ]}
                >
                  <View style={styles.journeyTopicPanelTextBlock}>
                    <Text style={styles.journeyTopicPanelEyebrow}>
                      LEVEL {(level.id ?? "").toUpperCase() || level.title}
                    </Text>
                    <Text style={styles.journeyTopicPanelTitle} numberOfLines={2}>
                      {topic.label}
                    </Text>
                  </View>
                  <View style={styles.journeyTopicPanelIconWrap}>
                    <Feather name="list" size={18} color="#ffffff" />
                  </View>
                </Pressable>
                </View>
              );
              // Story nodes for this topic.
              topic.stories.forEach((story, storyIdx) => {
                items.push(renderJourneyStoryNode(story, storyIdx, level, topic));
              });
            });

            // Level-end gate block. Two purposes:
            //   1. Surface the 75% rule so the user knows what they're
            //      working toward instead of "next level just appeared".
            //   2. Discoverable express lane via the level test (already
            //      reachable from locked stories — this makes it proactive).
            // Shown only on unlocked levels that have a next level above
            // and at least one gating topic. The user has nothing to "test
            // out of" at the last CEFR level, and an empty-scaffold level
            // has no checkpoints to chase.
            if (
              level.unlocked &&
              nextLevelInTrack &&
              gatingTopics.length > 0 &&
              clearedTopics < requiredForLevel
            ) {
              const remaining = requiredForLevel - clearedTopics;
              const lang = activeJourney?.language ?? activeJourneyLanguage ?? null;
              items.push(
                <View
                  key={`lg-${level.id}`}
                  style={styles.journeyLevelGateBlock}
                >
                  <View style={styles.journeyLevelGateProgressRow}>
                    <Feather name="trending-up" size={14} color="rgba(255,255,255,0.55)" />
                    <Text style={styles.journeyLevelGateProgressText}>
                      {clearedTopics}/{requiredForLevel} topics to unlock {nextLevelInTrack.title}
                    </Text>
                  </View>
                  <Text style={styles.journeyLevelGateHint}>
                    {remaining === 1
                      ? `1 more topic to clear, or pass the test to jump to ${nextLevelInTrack.title}.`
                      : `Clear checkpoints or take the test to jump to ${nextLevelInTrack.title}.`}
                  </Text>
                  <Pressable
                    onPress={() => {
                      if (!lang) {
                        setLockedStoryHint("Activate a journey to take the test.");
                        return;
                      }
                      setLevelTestOfferOpen({
                        targetLevel:
                          (nextLevelInTrack.id ?? "").toUpperCase() || nextLevelInTrack.title,
                        targetLanguage: lang,
                      });
                    }}
                    style={styles.journeyLevelGateCta}
                  >
                    <Feather name="zap" size={13} color={tokenColor.gold} />
                    <Text style={styles.journeyLevelGateCtaText}>
                      Take {level.title} test
                    </Text>
                  </Pressable>
                </View>
              );
            }
            return items;
          })
        : null}

      {/* (Old nested-View rendering removed — the flat flatMap above
          replaces the section / level-block / topic-block wrappers
          so the topic panels can be direct children of the
          ScrollView for native sticky.) */}
      {false ? (
      <View>
        {activeJourneyTrack?.levels.map((level, levelIdx) => (
          <View key={level.id}>
            {levelIdx > 0 ? (
              <View
                style={[
                  styles.journeyPathLevelHeader,
                  !level.unlocked ? styles.journeyPathLevelHeaderLocked : null,
                ]}
              >
                <Text style={styles.journeyPathLevelBadge}>{level.title}</Text>
              </View>
            ) : null}

            {level.topics.map((topic, topicIdx) => {
              return (
                <View
                  key={topic.slug}
                  // Topic block carries the ref + onLayout that drive
                  // the floating sticky panel. We measure the block's
                  // top against the ScrollView's content view so the
                  // floating panel's swap point lines up with where
                  // the in-flow panel would have left the viewport.
                  ref={(node) => {
                    const levelLabel = `LEVEL ${(level.id ?? "").toUpperCase() || level.title}`;
                    const bgColor = topicPanelColor(topic.slug, level.id);
                    if (node) {
                      topicViewsRef.current.set(topic.slug, node);
                      requestAnimationFrame(() => {
                        measureTopicY(topic.slug, topic.label, levelLabel, bgColor, !topic.unlocked, node);
                      });
                    } else {
                      topicViewsRef.current.delete(topic.slug);
                      topicLayoutsRef.current.delete(topic.slug);
                    }
                  }}
                  onLayout={() => {
                    const node = topicViewsRef.current.get(topic.slug);
                    const levelLabel = `LEVEL ${(level.id ?? "").toUpperCase() || level.title}`;
                    const bgColor = topicPanelColor(topic.slug, level.id);
                    if (node) measureTopicY(topic.slug, topic.label, levelLabel, bgColor, !topic.unlocked, node);
                  }}
                  style={styles.journeyPathTopicBlock}
                >
                  {/* Duolingo-style topic panel — rounded card with
                      eyebrow (level) + topic title on the left, and a
                      notepad icon on the right matching the
                      Duolingo reference. The card sits within the
                      ScrollView's horizontal padding so it visually
                      "floats" rather than being a full-width section
                      divider. */}
                  <Pressable
                    onPress={() => {
                      // Topics are always tappable — see comment in
                      // the other Pressable above. Locked story nodes
                      // still surface the placement-test offer.
                      // Empty topic from the Studio scaffold — the user
                      // already sees the "Aún no hay historias" placeholder
                      // below the header, so don't pop a preview sheet that
                      // would just be blank.
                      if (topic.stories.length === 0) return;
                      setTopicPreviewOpen({
                        levelId: (level.id ?? "").toUpperCase() || level.title,
                        topicLabel: topic.label,
                        topicSlug: topic.slug,
                        bgColor: topicPanelColor(topic.slug, level.id),
                        stories: topic.stories.map((s) => ({
                          id: s.id,
                          title: s.title,
                          coverUrl: s.coverUrl ?? null,
                        })),
                        vocabWords: [],
                        isVocabLoading: false,
                      });
                    }}
                    style={[
                      styles.journeyTopicPanel,
                      styles.journeyTopicPanelBevel,
                      { backgroundColor: topicPanelColor(topic.slug, level.id) },
                      // Idem: sólo aplicar cuando el sticky es JS-driven.
                      !useNativeJourneySticky && stickyTopic?.slug === topic.slug
                        ? { opacity: 0 }
                        : null,
                    ]}
                  >
                    <View style={styles.journeyTopicPanelTextBlock}>
                      <Text style={styles.journeyTopicPanelEyebrow}>
                        LEVEL {(level.id ?? "").toUpperCase() || level.title}
                      </Text>
                      <Text style={styles.journeyTopicPanelTitle} numberOfLines={2}>
                        {topic.label}
                      </Text>
                    </View>
                    <View style={styles.journeyTopicPanelIconWrap}>
                      <Feather name="list" size={18} color="#ffffff" />
                    </View>
                  </Pressable>

                  {topic.stories.length === 0 ? (
                    // Placeholder for topics planned in Studio that don't
                    // have any published stories yet. The user said
                    // "visibles pero vacíos" — keep the topic in the path
                    // so the curriculum scaffold is visible, but make it
                    // clear nothing's there yet rather than rendering an
                    // empty gap that looks like a layout glitch.
                    <View style={styles.journeyTopicEmptyState}>
                      <Feather name="clock" size={16} color="rgba(255,255,255,0.55)" />
                      <Text style={styles.journeyTopicEmptyText}>
                        Aún no hay historias
                      </Text>
                    </View>
                  ) : null}

                  {topic.stories.map((story, storyIdx) => {
                    const offlineCopy = offlineStoriesById.get(story.id)
                      ?? offlineSnapshot?.stories.find((s) => s.storySlug === story.storySlug);
                    const isOfflineReady = Boolean(offlineCopy);
                    const isDownloading = offlineStoryIdInFlight === story.id;
                    // Duration shown on the pill: computed from the local
                    // text when the story has been downloaded. Journey
                    // summary stories don't carry `text`, so online-only
                    // stories simply omit the duration line.
                    const durationMin = offlineCopy?.text
                      ? estimateReadMinutes(offlineCopy.text)
                      : null;
                    const alignRight = storyIdx % 2 === 1;
                    // Reason a locked story is locked, computed when the
                    // user actually taps it. Cheaper to compute on demand
                    // than once per render — most stories will never be
                    // tapped while locked.
                    const showLockedHint = () => {
                      // 1. Level-locked first: any story in a locked
                      //    level can be skipped to via the level test,
                      //    regardless of its topic / position. This
                      //    used to come AFTER the previous-topic
                      //    check, so most locked-level taps fell into
                      //    the "Pass the X checkpoint first" toast
                      //    instead of opening the modal.
                      if (!level.unlocked) {
                        const lang = activeJourney?.language ?? activeJourneyLanguage ?? null;
                        if (lang) {
                          setLevelTestOfferOpen({
                            targetLevel: (level.id ?? "").toUpperCase() || level.title,
                            targetLanguage: lang,
                          });
                          return;
                        }
                        setLockedStoryHint(`Complete the previous level to unlock ${level.title}.`);
                        return;
                      }
                      // 2. Within an unlocked level, check sequence
                      //    inside the topic.
                      const previousInTopic = storyIdx > 0 ? topic.stories[storyIdx - 1] : null;
                      if (previousInTopic && !previousInTopic.completed) {
                        setLockedStoryHint(`Finish "${previousInTopic.title}" to unlock this one.`);
                        return;
                      }
                      const levelTopicIdx = level.topics.findIndex((t) => t.slug === topic.slug);
                      const previousTopic = levelTopicIdx > 0 ? level.topics[levelTopicIdx - 1] : null;
                      if (previousTopic && !previousTopic.checkpointPassed) {
                        setLockedStoryHint(`Pass the ${previousTopic.label} checkpoint first.`);
                        return;
                      }
                      setLockedStoryHint("Complete the previous step first.");
                    };
                    const isNextAction = globalJourneyNextStoryId === story.id;
                    const nodeVariant: "completed" | "next" | "locked" | "step" = story.completed
                      ? "completed"
                      : isNextAction
                        ? "next"
                        : !story.unlocked
                          ? "locked"
                          : "step";
                    // Story name as the pill label. Earlier this
                    // showed generic "STORY 1" / "START NOW" copy
                    // which was the same on every node and didn't
                    // tell the user what the story was about. Falls
                    // back to "Story N" if the title is missing.
                    const pillLabel = story.title?.trim() || `Story ${storyIdx + 1}`;

                    return (
                      <View
                        key={story.id}
                        // Auto-scroll-to-next-node was removed: it
                        // landed on the next pill but left the page
                        // visibly off-the-top, which read as a bug
                        // ("doesn't start from the top"). The user's
                        // current position is now always row 0.
                        style={[
                          styles.journeyPathNodeRow,
                          alignRight ? styles.journeyPathNodeRowRight : styles.journeyPathNodeRowLeft,
                        ]}
                      >
                        {/* Horizontal pill: circle icon on the left, label
                            + duration stack on the right. Alternates
                            side via the row alignment above so the path
                            zigzags down the screen. The "next" variant
                            gets its accent + a single soft glow built
                            into its style — no extra ring overlay. */}
                        {nodeVariant === "next" ? (
                          <View style={styles.journeyNextPillWrap}>
                            <Animated.View
                              pointerEvents="none"
                              style={[styles.journeyNextHalo, { opacity: journeyNextPulse }]}
                            />
                          <Pressable
                              disabled={!story.unlocked}
                              onPress={() => openJourneyStory(story)}
                              accessibilityRole="button"
                              accessibilityLabel={`qa-journey-story-${story.id}`}
                              testID={`qa-journey-story-${story.id}`}
                              style={[styles.journeyNodePill, styles.journeyNodePillNext]}
                            >
                              <View style={[styles.journeyNodePillIcon, styles.journeyNodePillIconNext]}>
                                {story.coverUrl ? (
                                  <ProgressiveImage
                                    uri={getCoverUrl(story.coverUrl, 128)}
                                    style={styles.journeyNodePillCoverThumb}
                                    resizeMode="cover"
                                  />
                                ) : (
                                  <Feather name="play" size={20} color={tokenBg[1]} />
                                )}
                              </View>
                              <View style={styles.journeyNodePillTextStack}>
                                <Text
                                  style={[styles.journeyNodePillLabel, styles.journeyNodePillLabelNext]}
                                  numberOfLines={2}
                                >
                                  {pillLabel}
                                </Text>
                              </View>
                            </Pressable>
                          </View>
                        ) : (
                          <Pressable
                            onPress={() => {
                              if (!story.unlocked) {
                                showLockedHint();
                                return;
                              }
                              openJourneyStory(story);
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={`qa-journey-story-${story.id}`}
                            testID={`qa-journey-story-${story.id}`}
                            style={[
                              styles.journeyNodePill,
                              nodeVariant === "completed" ? styles.journeyNodePillCompleted : null,
                              nodeVariant === "locked" ? styles.journeyNodePillLocked : null,
                              nodeVariant === "step" ? styles.journeyNodePillStep : null,
                            ]}
                          >
                            <View
                              style={[
                                styles.journeyNodePillIcon,
                                nodeVariant === "completed" ? styles.journeyNodePillIconCompleted : null,
                                nodeVariant === "locked" ? styles.journeyNodePillIconLocked : null,
                                nodeVariant === "step" ? styles.journeyNodePillIconStep : null,
                              ]}
                            >
                              {/* Cover thumbnail (dimmed) for every
                                  non-next state, so the path reads
                                  visually like a stack of stories
                                  rather than abstract numbers. The
                                  next pill uses a fully opaque
                                  thumbnail; this one is at low alpha
                                  so it clearly reads as "not the
                                  one to tap right now". A small
                                  status badge (check / lock / step
                                  number) sits as a sibling so the
                                  thumb's overflow:hidden doesn't
                                  clip it. */}
                              {story.coverUrl ? (
                                <>
                                  <View style={styles.journeyNodePillThumbWrap}>
                                    <ProgressiveImage
                                      uri={getCoverUrl(story.coverUrl, 128)}
                                      style={[
                                        styles.journeyNodePillCoverThumb,
                                        nodeVariant === "completed"
                                          ? styles.journeyNodePillCoverThumbCompleted
                                          : styles.journeyNodePillCoverThumbDim,
                                      ]}
                                      resizeMode="cover"
                                    />
                                  </View>
                                  <View
                                    style={[
                                      styles.journeyNodePillThumbBadge,
                                      nodeVariant === "completed"
                                        ? styles.journeyNodePillThumbBadgeCompleted
                                        : nodeVariant === "locked"
                                          ? styles.journeyNodePillThumbBadgeLocked
                                          : styles.journeyNodePillThumbBadgeStep,
                                    ]}
                                  >
                                    {nodeVariant === "completed" ? (
                                      <Feather name="check" size={11} color={tokenBg[1]} />
                                    ) : nodeVariant === "locked" ? (
                                      <Feather name="lock" size={10} color="#cdd9ec" />
                                    ) : (
                                      <Text style={styles.journeyNodePillThumbBadgeNumber}>
                                        {storyIdx + 1}
                                      </Text>
                                    )}
                                  </View>
                                </>
                              ) : nodeVariant === "completed" ? (
                                <Feather name="check" size={18} color={tokenBg[1]} />
                              ) : nodeVariant === "locked" ? (
                                <Feather name="lock" size={15} color="#7a8aa5" />
                              ) : (
                                <Text style={styles.journeyNodePillStepNumber}>{storyIdx + 1}</Text>
                              )}
                            </View>
                            <View style={styles.journeyNodePillTextStack}>
                              <Text style={styles.journeyNodePillLabel} numberOfLines={2}>
                                {pillLabel}
                              </Text>
                            </View>
                          </Pressable>
                        )}
                        {/* Per-node download badge removed — the
                            offline action is available inside the
                            reader (bookmark / cloud icons in the
                            top bar) so the path can stay a clean,
                            uncluttered Duolingo-style scroll. */}
                      </View>
                    );
                  })}

                  {/* Checkpoint chip removed in build 67 per product
                      direction — checkpoints are no longer surfaced
                      between topics. The underlying state
                      (topic.checkpointPassed, openJourneyPractice
                      with kind: "checkpoint") is left intact in case
                      we reintroduce them with a different UI later. */}
                </View>
              );
            })}
          </View>
        ))}

      </View>
      ) : null}
    </>
  );

  const progressView = (() => {
    const streak = remoteProgress?.gamification?.dailyStreak ?? maxFavoriteStreak ?? 0;
    const todayXp = remoteProgress?.gamification?.todayXp ?? 0;
    const totalXp = remoteProgress?.gamification?.totalXp ?? 0;
    const level = remoteProgress?.gamification?.currentLevel ?? 1;
    const levelStartXp = remoteProgress?.gamification?.levelStartXp ?? 0;
    const nextLevelXp = remoteProgress?.gamification?.nextLevelXp ?? 600;
    const xpInLevel = Math.max(0, totalXp - levelStartXp);
    const xpForLevel = Math.max(1, nextLevelXp - levelStartXp);

    const accuracy = Math.round(remoteProgress?.practiceAccuracy ?? 0);
    const sessions = remoteProgress?.practiceSessionsCompleted ?? 0;
    const wordsLearned = remoteProgress?.wordsLearned ?? favoriteWords.length;
    const minutesListened = remoteProgress?.minutesListened ?? 0;
    const storiesFinished = remoteProgress?.storiesFinished ?? continueReading.length;

    const wkStories = remoteProgress?.weeklyStoriesFinished ?? weeklyStoriesFinished;
    const wkStoriesGoal = remoteProgress?.weeklyGoalStories ?? weeklyGoalStories;
    const wkMinutes = remoteProgress?.weeklyMinutesListened ?? 0;
    const wkMinutesGoal = remoteProgress?.weeklyGoalMinutes ?? 60;
    const wkPractice = remoteProgress?.weeklyPracticeSessions ?? 0;
    const wkPracticeGoal = remoteProgress?.weeklyGoalPracticeSessions ?? 5;

    const nowDate = new Date();
    const tmpDate = new Date(Date.UTC(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate()));
    const dayNum = tmpDate.getUTCDay() || 7;
    tmpDate.setUTCDate(tmpDate.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(tmpDate.getUTCFullYear(), 0, 1));
    const weekNum = Math.ceil(((tmpDate.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    const weekLabel = `Week ${weekNum} · ${tmpDate.getUTCFullYear()}`;

    const twinkles = [
      { left: 22, top: 38, size: 5, color: "#f5d77a" },
      { left: 196, top: 50, size: 4, color: "#f5a261" },
      { left: 178, top: 28, size: 5, color: "#f5d77a" },
      { left: 14, top: 132, size: 5, color: "#5dd9e8" },
      { left: 204, top: 124, size: 4, color: "#5dd9e8" },
      { left: 30, top: 196, size: 4, color: "#f5d77a" },
    ];

    const bars = [
      { key: "stories", label: "Stories", value: wkStories, total: wkStoriesGoal, unit: "", color: "#a8e845" },
      { key: "minutes", label: "Minutes", value: wkMinutes, total: wkMinutesGoal, unit: " min", color: "#5dd9e8" },
      { key: "practice", label: "Practice", value: wkPractice, total: wkPracticeGoal, unit: "", color: "#a892ff" },
    ];

    return (
      <>
        <View style={styles.progressHeaderRow}>
          <Text style={styles.progressTopEyebrow}>PROGRESS</Text>
          <Text style={styles.progressTopWeek}>{weekLabel}</Text>
        </View>

        <View style={styles.progressStreakHero}>
          {twinkles.map((t, i) => (
            <View
              key={i}
              style={{
                position: "absolute",
                left: t.left,
                top: t.top,
                width: t.size,
                height: t.size,
                borderRadius: t.size / 2,
                backgroundColor: t.color,
                opacity: 0.85,
              }}
            />
          ))}
          <View style={styles.progressStreakRing} />
          <View style={styles.progressStreakCenter}>
            <Text style={styles.progressStreakFlame}>🔥</Text>
            <Text style={styles.progressStreakValue}>{streak}</Text>
            <Text style={styles.progressStreakLabel}>DAY STREAK</Text>
          </View>
        </View>

        <View style={styles.progressLevelPill}>
          <Feather name="zap" size={13} color="#a8e845" />
          <Text style={styles.progressLevelPillText}>
            LEVEL {level} · {xpInLevel}/{xpForLevel} XP
          </Text>
        </View>

        <View style={styles.progressStatsGridV4}>
          <View style={styles.progressStatV4}>
            <View style={styles.progressStatV4Header}>
              <Feather name="zap" size={11} color="#a8e845" />
              <Text style={[styles.progressStatV4Eyebrow, { color: "#a8e845" }]}>TOTAL XP</Text>
            </View>
            <Text style={styles.progressStatV4Value}>{totalXp.toLocaleString()}</Text>
            <Text style={styles.progressStatV4Sub}>+{todayXp} today</Text>
          </View>

          <View style={styles.progressStatV4}>
            <View style={styles.progressStatV4Header}>
              <Feather name="target" size={11} color="#5dd9e8" />
              <Text style={[styles.progressStatV4Eyebrow, { color: "#5dd9e8" }]}>ACCURACY</Text>
            </View>
            <Text style={styles.progressStatV4Value}>{accuracy}%</Text>
            <Text style={styles.progressStatV4Sub}>
              {sessions} {sessions === 1 ? "session" : "sessions"}
            </Text>
          </View>

          <View style={styles.progressStatV4}>
            <View style={styles.progressStatV4Header}>
              <Feather name="bookmark" size={11} color="#a892ff" />
              <Text style={[styles.progressStatV4Eyebrow, { color: "#a892ff" }]}>WORDS</Text>
            </View>
            <Text style={styles.progressStatV4Value}>{wordsLearned}</Text>
            <Text style={styles.progressStatV4Sub}>learned all-time</Text>
          </View>

          <View style={styles.progressStatV4}>
            <View style={styles.progressStatV4Header}>
              <Feather name="headphones" size={11} color="#f5d77a" />
              <Text style={[styles.progressStatV4Eyebrow, { color: "#f5d77a" }]}>MINUTES</Text>
            </View>
            <Text style={styles.progressStatV4Value}>{minutesListened}</Text>
            <Text style={styles.progressStatV4Sub}>
              {storiesFinished} {storiesFinished === 1 ? "story" : "stories"}
            </Text>
          </View>
        </View>

        <View style={styles.progressWeekCard}>
          <View style={styles.progressWeekHeader}>
            <Text style={styles.progressWeekEyebrow}>THIS WEEK</Text>
            <Text style={styles.progressWeekResets}>Resets Sun</Text>
          </View>
          <View style={styles.progressWeekList}>
            {bars.map((bar) => {
              const pct = Math.min(100, (bar.value / Math.max(1, bar.total)) * 100);
              return (
                <View key={bar.key} style={styles.progressWeekRow}>
                  <View style={styles.progressWeekRowHeader}>
                    <View style={styles.progressWeekRowLabelGroup}>
                      <Feather name="plus" size={12} color={bar.color} />
                      <Text style={styles.progressWeekRowLabel}>{bar.label}</Text>
                    </View>
                    <Text style={styles.progressWeekRowValue}>
                      <Text style={[styles.progressWeekRowValueStrong, { color: bar.color }]}>
                        {bar.value}
                      </Text>
                      <Text style={styles.progressWeekRowValueTotal}> / {bar.total}{bar.unit}</Text>
                    </Text>
                  </View>
                  <View style={styles.progressWeekRowTrack}>
                    <View
                      style={[
                        styles.progressWeekRowFill,
                        { width: `${pct}%`, backgroundColor: bar.color },
                      ]}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {remoteProgressLoading ? <Text style={styles.helperText}>Refreshing…</Text> : null}
      </>
    );
  })();

  // Tracks disponibles en Studio para el language elegido en el onboarding.
  // Se usan como opciones del step "What's your focus?" (cada Studio Journey
  // record es un focus). Si todavía no se cargó el journey para ese language
  // (race entre el select y el fetch), caemos a las 4 opciones hardcoded.
  const onboardingFocusTracks = remoteJourney?.tracks ?? [];

  // PLACEMENT/FOCUS RESET para los usuarios de prueba — corre una vez por
  // cold start (gated por un ref). El placement seteado en publicMetadata
  // marcaba historias de niveles inferiores como `skipped: true` y empujaba
  // la "next" hacia abajo, así que limpiamos placement + focus y forzamos
  // un refetch del journey con el cache invalidado.
  const TEST_USER_EMAILS = useMemo(
    () => new Set(["delcarpio321@gmail.com", "alejandro@muvn.de"]),
    []
  );
  const placementClearedRef = useRef(false);
  useEffect(() => {
    if (placementClearedRef.current) return;
    if (!sessionToken) return;
    if (!sessionEmail || !TEST_USER_EMAILS.has(sessionEmail.toLowerCase())) return;
    placementClearedRef.current = true;
    (async () => {
      try {
        await apiFetch({
          baseUrl: mobileConfig.apiBaseUrl,
          path: "/api/mobile/preferences",
          token: sessionToken,
          method: "PATCH",
          body: { journeyPlacementLevel: null, journeyFocus: null },
        });
        // Invalida TODO el cache de journeys: el payload cambió porque el
        // backend ahora ya no marca skipped sobre los niveles inferiores.
        // Sin esto el `cached` previo seguiría sobreviviendo entre cold
        // starts (saveJourneyCacheToDisk persiste el cache).
        journeyCacheByLanguageRef.current.clear();
        if (activeJourneyLanguage) {
          await loadJourneyForLanguage(activeJourneyLanguage);
        }
      } catch {
        // best-effort
      }
    })();
  }, [sessionToken, sessionEmail, activeJourneyLanguage, loadJourneyForLanguage, TEST_USER_EMAILS]);

  // Asegurar que el journey del language seleccionado se cargue durante el
  // onboarding aunque el usuario haya entrado con `targetLanguages` ya set
  // (re-onboarding) y no haya pasado por el `select` del primer step. Sin
  // esto, el step "What's your focus?" cae al hardcoded fallback porque
  // `remoteJourney` quedó vacío.
  const onboardingTargetLang = preferences.targetLanguages[0];
  const onboardingFocusFetchRef = useRef<string | null>(null);
  useEffect(() => {
    if (!shouldShowOnboardingSurvey) return;
    if (!sessionToken) return;
    if (!onboardingTargetLang) return;
    if (onboardingFocusFetchRef.current === onboardingTargetLang) return;
    onboardingFocusFetchRef.current = onboardingTargetLang;
    setActiveJourneyLanguage(onboardingTargetLang);
    void loadJourneyForLanguage(onboardingTargetLang);
  }, [shouldShowOnboardingSurvey, sessionToken, onboardingTargetLang, loadJourneyForLanguage]);

  const onboardingSurveySteps = [
    {
      title: "What are you learning?",
      body: "We will use this to tailor stories, books, Journey and Create.",
      options: ["Spanish", "French", "German", "Italian", "Portuguese", "Japanese"],
      selected: preferences.targetLanguages[0] ?? "",
      select: (value: string) => {
        setPreferences((current) => ({
          ...current,
          targetLanguages: [value],
          preferredVariant: null,
          preferredRegion: null,
        }));
        // Pre-load del journey del nuevo language para que cuando el
        // usuario llegue al step focus tengamos los tracks de Studio.
        setActiveJourneyLanguage(value);
        void loadJourneyForLanguage(value);
      },
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
      title: "What's your focus?",
      body: "Pick the Journey you want to start. Each Journey is a curated track of stories.",
      // Always render Studio Journey tracks. NO hardcoded fallback
      // anymore — if there's no Journey for this language we want the
      // empty state, not the misleading "Travel & Local Life" copy.
      options: onboardingFocusTracks.map((t) => t.id),
      selected: preferences.preferredVariant ?? "",
      select: (value: string) =>
        setPreferences((current) => ({ ...current, preferredVariant: value })),
      format: (value: string) =>
        onboardingFocusTracks.find((t) => t.id === value)?.label ?? value,
      empty: "Loading journeys for this language…",
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

  // Stable progress handler for the current reader selection. Without this
  // memo the reader received a fresh arrow every Shell render, which
  // invalidated its props during scroll and kept the reader rendering when
  // the Shell re-rendered (cascading scroll lag).
  const handleReaderTrackProgress = useCallback(
    (details?: { progressRatio?: number; currentBlockIndex?: number; totalBlocks?: number }) => {
      if (!selection) return;
      recordProgress(selection.book, selection.story, details);
    },
    [recordProgress, selection]
  );

  if (selection) {
    // Buscar primero por slug (estable entre journey API y standalone API)
    // y caer al lookup por id como fallback. Sin el slug-first, las
    // stories descargadas desde el journey nunca matcheaban con el
    // selection.story.id porque el endpoint standalone usa otro id.
    const offlineStory =
      (selection.story.slug
        ? offlineStoriesBySlug.get(selection.story.slug)
        : undefined) ?? offlineStoriesById.get(selection.story.id);
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
          resolvedCoverUrl={offlineStory?.localCoverUri ?? selection.resolvedCoverUrl ?? null}
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
          onTrackProgress={handleReaderTrackProgress}
          isAvailableOffline={Boolean(offlineStory)}
          isDownloadingOffline={offlineStoryIdInFlight === selection.story.id}
          onDownloadOffline={() => void downloadStoryOffline(selection.book, selection.story)}
          onRemoveOffline={() => void removeStoryFromOffline(selection.story)}
          onOpenPractice={() => void openStoryPractice(selection)}
          isFavoriteWord={isFavoriteWord}
          onToggleFavoriteWord={(item, contextSentence) => void toggleFavoriteWord(item, contextSentence)}
          onTrackReaderEvent={trackReaderEvent}
        />
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
          formatLanguageAndRegion(selectedBook.language, selectedBook.region ?? ""),
          formatLevel(selectedBook.level),
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
          coverUrl: getCoverUrl(story.cover ?? story.coverUrl ?? selectedBook.cover),
          qaLabel: index === 0 ? "qa-book-story-row-0" : `qa-book-story-row-${story.id}`,
          onPress: () => openSelection(resolved),
        }))}
        suggestedStories={selectedBookSuggestedStories.map((selection) => ({
          key: `suggested-story-${selection.story.id}`,
          title: selection.story.title,
          subtitle: selection.book.title,
          coverUrl: getCoverUrl(selection.story.cover ?? selection.story.coverUrl ?? selection.book.cover),
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

  const practiceSessionRendered = renderPracticeSessionView();
  if (practiceSessionRendered) {
    return practiceSessionRendered;
  }

  /**
   * Persist the onboarding payload from the new OnboardingFlow.
   * Maps the flow's level enum to the existing journeyPlacementLevel
   * + preferredLevel fields so downstream views (journey track
   * generation, etc.) keep working unchanged.
   */
  async function commitOnboarding(payload: OnboardingPayload) {
    // Fire the journey load IMMEDIATELY (before any await) so the
    // journey screen has its loading state set the moment the gate
    // flips. Without this, the user briefly saw "Journey is not
    // available" between when shouldShowOnboardingSurvey becomes
    // false and when loadJourneyForLanguage starts marking the
    // shell as loading.
    const primaryLanguageEarly = payload.selections[0]?.language ?? null;
    if (primaryLanguageEarly) {
      setActiveJourneyLanguage(primaryLanguageEarly);
      void loadJourneyForLanguage(primaryLanguageEarly);
    }

    const journeyFocus: "Work & Career" | "General" | "Travel & Local Life" | "Culture & Belonging" =
      payload.whys.includes("Travel")
        ? "Travel & Local Life"
        : payload.whys.includes("Work") || payload.whys.includes("School")
          ? "Work & Career"
          : payload.whys.includes("Culture") || payload.whys.includes("Family")
            ? "Culture & Belonging"
            : "General";
    // If the user took the level test, its CEFR result wins over the
    // self-reported level — the test is a more accurate placement
    // signal. Otherwise fall back to the coarse self-pick mapping.
    const placement = payload.testedLevel
      ? payload.testedLevel
      : payload.level === "Brand new"
        ? "A0"
        : payload.level === "A few words"
          ? "A1"
          : "B1";
    const preferredLevel = payload.testedLevel
      ? payload.testedLevel === "B2" || payload.testedLevel === "C1"
        ? "Advanced"
        : payload.testedLevel === "B1"
          ? "Intermediate"
          : "Beginner"
      : payload.level === "Brand new" || payload.level === "A few words"
        ? "Beginner"
        : "Intermediate";

    await saveOnboardingPreferences({
      targetLanguages: payload.languages,
      // The picker now lets the user choose US vs UK English. When the
      // primary language has a regional flag we persist that choice as
      // `preferredVariant` so the journey, reader, and language chip
      // all respect it from the very first session. Other languages
      // fall through and stay null until set explicitly in settings.
      preferredVariant: payload.primaryVariant,
      interests: payload.whys,
      preferredLevel,
      journeyFocus,
      dailyMinutes: payload.dailyMinutes,
      remindersEnabled: payload.remindersEnabled,
      reminderHour: payload.reminderHour,
      journeyPlacementLevel: placement,
      onboardingSurveyCompletedAt: new Date().toISOString(),
    });

    // Override journeys client-side from `selections` — one journey
    // per (language, variant, focus) tuple. This preserves the user's
    // multi-variant picks (e.g. Spanish ES + Spanish LATAM) which the
    // server doesn't yet model: server sees only the deduped
    // `targetLanguages` + `preferredVariant`. Without this override
    // `synthesizeJourneysFromLegacy` would produce one journey per
    // unique language and the secondary variants would be lost.
    if (payload.selections.length > 0) {
      const createdAt = new Date().toISOString();
      // Dedupe before committing — `payload.selections` mirrors
      // every chip the user tapped in step 1; if the picker ever
      // returns the same (language, variant) twice (or the user
      // taps a chip rapidly enough to register twice), `journeyId`
      // collapses both to the same id and we'd otherwise commit
      // two entries with identical ids.
      const journeys: Journey[] = dedupeJourneysById(
        payload.selections.map((sel) => ({
          id: journeyId(sel.language, sel.variant, journeyFocus),
          language: sel.language,
          variant: sel.variant,
          focus: journeyFocus,
          level: preferredLevel,
          createdAt,
        }))
      );
      setPreferences((current) => ({
        ...current,
        journeys,
        activeJourneyId: journeys[0]?.id ?? null,
      }));
      setSavedPreferences((current) => ({
        ...current,
        journeys,
        activeJourneyId: journeys[0]?.id ?? null,
      }));
      // Set the active journey language so the journey screen lands
      // on the right path right away.
      const primaryLanguage = payload.selections[0]?.language ?? null;
      if (primaryLanguage) {
        setActiveJourneyLanguage(primaryLanguage);
        void loadJourneyForLanguage(primaryLanguage);
      }
    }
  }

  // Render the dedicated full-screen onboarding when the user hasn't
  // completed the survey yet — or when an override (polyglot test or
  // a tap on the empty flag chip) asked for it. Replaces the old
  // Modal-based survey.
  const showOnboarding = shouldShowOnboardingSurvey || forceOnboardingProper;
  if (showOnboarding) {
    return (
      <OnboardingFlow
        userName={sessionName ?? null}
        // Always persist now: the previous test-mode "throw away
        // selections" path is gone — Test mode in the polyglot menu
        // does a full reset instead and runs onboarding normally.
        testMode={false}
        comingSoonLanguages={comingSoonLanguages}
        onComplete={async (payload) => {
          // Set activeScreen BEFORE the await: when the gate flips
          // (onboardingSurveyCompletedAt set inside commitOnboarding)
          // and the shell re-renders without the onboarding overlay,
          // activeScreen is already "journey" — so the user lands
          // directly there without a one-frame Home flash.
          setActiveScreen("home");
          setOnboardingOverride(null);
          await commitOnboarding(payload);
        }}
        onCancel={
          forceOnboardingProper ? () => setOnboardingOverride(null) : undefined
        }
      />
    );
  }

  // IA swap: tab "Home" muestra Journey path (lo más actionable a diario)
  // y tab "Library" (era "Journey" en bottom nav) muestra el contenido
  // de browsing/recomendaciones que antes vivía en Home.
  let content: React.ReactNode = journeyView;
  if (activeScreen === "explore") content = exploreView;
  if (activeScreen === "practice") content = practiceView;
  if (activeScreen === "favorites") content = favoritesView;
  if (activeScreen === "journey") content = homeView;
  if (activeScreen === "library") content = libraryView;
  if (activeScreen === "settings") content = settingsView;
  if (activeScreen === "create") content = createView;
  // Cuando usamos sticky nativo iOS, los hijos del ScrollView deben
  // ser un array PLANO (no un fragment con conditional-null siblings),
  // si no `stickyHeaderIndices` no resuelve correctamente las
  // posiciones — fue exactamente lo que rompió el intento anterior.
  // `Children.toArray` aplana el fragment y filtra los nulls,
  // dejando el array que journeyStickyIndices espera.
  if (useNativeJourneySticky) {
    content = Children.toArray(journeyView.props.children);
  }

  return (
    <View style={styles.shell}>
      {/* Subtle "you're offline" banner. Only appears once we've actually
          tried to hydrate and every request failed — so it does not flash
          during the initial in-flight window. Tappable to retry. */}
      {isOffline && (isSignedIn || Boolean(sessionUserId)) ? (
        <Pressable
          accessibilityLabel="Sin conexión. Toca para reintentar."
          onPress={() => {
            // Bump the refresh counter to re-trigger the hydrate effect.
            // If we're still offline the banner will reappear; if network
            // came back the fresh data lands and isOffline flips to false.
            setRemoteRefreshCounter((prev) => prev + 1);
          }}
          style={styles.offlineBanner}
        >
          <View style={styles.offlineBannerDot} />
          <Text style={styles.offlineBannerText} numberOfLines={1}>
            Sin conexión — biblioteca descargada
          </Text>
          <Feather name="refresh-cw" size={13} color="#f5e0b5" />
        </Pressable>
      ) : null}
      {/* Journey path top bar lifted out of the ScrollView so it
          stays pinned to the top of the screen while the path content
          scrolls underneath. Only rendered for the journey screen in
          path mode — detail mode (`journeyDetailTopicId` set) keeps
          its hero inside the scroll content. Hidden when a story is
          opening (`openingStoryId`) or already open (`selection`)
          so the journey UI doesn't linger over the reader for a
          frame. */}
      {activeScreen === "home" &&
      !journeyDetailTopicId &&
      !openingStoryId &&
      !selection ? (
        <View
          onLayout={(e) => {
            // Latch: only the first non-zero measurement counts.
            // Later layout events (re-renders, etc.) are ignored
            // so they can't loop with sticky setState.
            if (topBarMeasuredRef.current) return;
            const h = e.nativeEvent.layout.height;
            if (h > 0) {
              topBarMeasuredRef.current = true;
              setJourneyTopBarHeight(h);
            }
          }}
        >
          {journeyPathTopBar}
        </View>
      ) : null}
      <ScrollView
        ref={shellScrollRef}
        style={styles.scrollView}
        // En path mode el primer panel arranca pegado al top bar
        // (paddingTop:0). Así el panel ya está en su posición sticky
        // desde el render inicial: al hacer scroll no "sube" — sólo
        // las stories de abajo pasan por debajo. Los demás screens
        // (explore, practice, etc.) mantienen el `paddingTop:28`
        // original del container.
        contentContainerStyle={[
          styles.container,
          useNativeJourneySticky ? { paddingTop: 0 } : null,
        ]}
        scrollEnabled
        showsVerticalScrollIndicator={false}
        decelerationRate="normal"
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="never"
        // Sticky nativo iOS sólo en path mode. Los hijos del
        // ScrollView se generan con `Children.toArray(...)` justo
        // arriba del return, así que los índices apuntan exactamente
        // a los topic panels del flatMap (sin off-by-one por nulls
        // del fragmento). Cuando no estamos en path mode, undefined
        // → comportamiento ScrollView normal sin sticky nativo.
        stickyHeaderIndices={
          useNativeJourneySticky && journeyStickyIndices.length > 0
            ? journeyStickyIndices
            : undefined
        }
        onScroll={(event) => {
          const y = event.nativeEvent.contentOffset.y;
          if (activeScreen === "favorites") setShellScrollY(y);
          if (activeScreen === "home" && !journeyDetailTopicId) {
            handleJourneyScroll(event);
          }
        }}
        onScrollBeginDrag={() => {
          // Start of a new scroll session: the user just put their
          // finger on the path. Reset the visited-slug set so haptics
          // can fire again for topics they cross during this session.
          // (See `visitedSlugsInSessionRef` declaration for why we use
          // a session-scoped set instead of a time-based dedup.)
          if (activeScreen === "home" && !journeyDetailTopicId) {
            visitedSlugsInSessionRef.current.clear();
            // Seed with the current sticky slug so a tiny initial drag
            // that doesn't actually leave the current topic doesn't
            // re-fire haptic when foundCurrent flickers.
            const seed = stickyTopicSlugRef.current ?? STICKY_NULL_SENTINEL;
            visitedSlugsInSessionRef.current.add(seed);
          }
          // User took over: cancel any pending scroll restoration so we
          // don't yank them back while they're scrolling.
          pendingJourneyRestoreYRef.current = null;
        }}
        onContentSizeChange={(_w, h) => {
          // Re-attempt scroll restoration when content grows past the
          // pending target. Required because the ScrollView clamps
          // scrollTo to its current maxOffset; if the journey path is
          // still measuring (image covers loading, etc.) the first
          // restore from the tab-return effect lands short. As h
          // grows past targetY we apply scrollTo again and clear.
          if (activeScreen !== "home" || journeyDetailTopicId) return;
          const targetY = pendingJourneyRestoreYRef.current;
          if (targetY == null) return;
          if (h < targetY) return;
          shellScrollRef.current?.scrollTo({ y: targetY, animated: false });
          recomputeStickyTopicRef.current?.(targetY, true);
          pendingJourneyRestoreYRef.current = null;
        }}
        onMomentumScrollEnd={() => {
          // Momentum decay finished. The session ends here — clear so
          // the next gesture starts fresh.
          if (activeScreen === "home" && !journeyDetailTopicId) {
            visitedSlugsInSessionRef.current.clear();
          }
        }}
        onScrollEndDrag={(event) => {
          // If the user releases without enough velocity to start
          // momentum, `onMomentumScrollEnd` never fires. We clear the
          // set here too, but only when the scroll has effectively
          // come to rest (no velocity). RN exposes velocity on the
          // event for this exact purpose.
          if (activeScreen !== "home" || journeyDetailTopicId) return;
          const velocity = event.nativeEvent.velocity?.y ?? 0;
          if (Math.abs(velocity) < 0.1) {
            visitedSlugsInSessionRef.current.clear();
          }
        }}
        scrollEventThrottle={16}
      >
        {content}
      </ScrollView>
      {/* JS-driven floating sticky panel — overlays the ScrollView
          (NOT in flow) so appearing / disappearing never reflows the
          scroll content. Top edge sits flush with the journey top
          bar's bottom (height measured via onLayout above). The
          in-flow topic panel for the same slug renders with
          opacity:0 so the user only sees one panel at a time.
          Rendered unconditionally on the journey path screen and
          driven via opacity so we never pay a mount frame on the
          first cross-over — that mount frame was the residual
          flicker the user reported on the first panel scroll. */}
      {activeScreen === "home" &&
      !journeyDetailTopicId &&
      !openingStoryId &&
      !selection &&
      !useNativeJourneySticky ? (
        <View
          pointerEvents="none"
          style={[
            styles.journeyStickyFloatingPanel,
            styles.journeyTopicPanelBevel,
            { top: journeyTopBarHeight },
            stickyTopic ? { backgroundColor: stickyTopic.bgColor } : null,
            !stickyTopic ? styles.journeyTopicPanelHidden : null,
          ]}
        >
          <View style={styles.journeyTopicPanelTextBlock}>
            <Text style={styles.journeyTopicPanelEyebrow}>
              {stickyTopic?.levelLabel ?? ""}
            </Text>
            <Text style={styles.journeyTopicPanelTitle} numberOfLines={2}>
              {stickyTopic?.label ?? ""}
            </Text>
          </View>
          <View style={styles.journeyTopicPanelIconWrap}>
            <Feather name="list" size={18} color="#ffffff" />
          </View>
        </View>
      ) : null}
      {/* Floating "scroll to top" — only on Favorites where the
          saved-words list can grow long. Shows up after the user has
          scrolled at least one viewport-ish (400 px) so it doesn't
          flash on short lists. Tap returns the shell scroll to 0.
          Reuses the journey FAB styles so the two surfaces feel like
          the same control. */}
      {activeScreen === "favorites" && shellScrollY > 400 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver al inicio"
          onPress={() => {
            shellScrollRef.current?.scrollTo({ y: 0, animated: true });
          }}
          style={({ pressed }) => [
            styles.journeyScrollTopButton,
            pressed ? styles.journeyScrollTopButtonPressed : null,
          ]}
        >
          <Feather name="chevron-up" size={22} color="#0c1626" />
        </Pressable>
      ) : null}

      {/* Floating sticky topic panel — pinned just below the lifted
          top bar while the user scrolls through the path. The active
          topic is updated from the ScrollView's onScroll handler
          based on each topic block's measured Y. The in-flow panel
          (rendered inside the path) keeps existing — this floating
          one covers it as the user scrolls past, producing the
          Duolingo-style "section header that swaps as you cross
          boundaries" effect without flattening the path. */}
      {/* (Floating JS-driven sticky panel removed — native
          stickyHeaderIndices on the ScrollView now pins the in-flow
          topic panel directly, producing the proper Duolingo
          eclipse swap without the flicker the floating overlay
          had.) */}

      {/* Floating "back to top" arrow on the journey screen.
          Visible after the user has scrolled past ~280pt so it
          doesn't crowd the top of the path. Tapping smoothly
          scrolls back to y=0. Sits above the bottom tab nav and
          uses safe-area-aware bottom inset. */}
      {activeScreen === "home" &&
      !journeyDetailTopicId &&
      !openingStoryId &&
      !selection &&
      showJourneyScrollTop ? (
        <Pressable
          onPress={() => {
            shellScrollRef.current?.scrollTo({ y: 0, animated: true });
          }}
          accessibilityRole="button"
          accessibilityLabel="Scroll to top of journey"
          style={({ pressed }) => [
            styles.journeyScrollTopButton,
            pressed ? styles.journeyScrollTopButtonPressed : null,
          ]}
        >
          <Feather name="chevron-up" size={22} color="#0c1626" />
        </Pressable>
      ) : null}

      {/* Gamification daily-quest toast removed: it surfaced across
          unrelated screens (Journey, Library, …) when the gamification
          payload happened to refresh, well after the user had earned
          the quest, and the "Daily quest complete · Claimed" copy read
          like a prompt instead of a confirmation. The underlying
          GamificationSummary still drives the Home stats pill and the
          journey header chips. */}

      {openingStoryId ? <ReaderSkeleton /> : null}

      <LanguageSwitchSheet
        open={languageSwitchOpen}
        onClose={() => setLanguageSwitchOpen(false)}
        journeys={journeySwitchEntries}
        onSelect={handleJourneySwitch}
        onAddJourney={() => {
          // Close the sheet and open the full-screen "Your journeys"
          // panel where the user can browse all journeys + start a
          // new one (no longer routed to /settings).
          setLanguageSwitchOpen(false);
          setJourneysPanelOpen(true);
        }}
      />

      <JourneysPanel
        open={journeysPanelOpen}
        onClose={() => setJourneysPanelOpen(false)}
        journeys={preferences.journeys}
        activeJourneyId={preferences.activeJourneyId}
        statsByLanguage={MOCK_LANG_STATS}
        comingSoonLanguages={comingSoonLanguages}
        onSelect={async (id) => {
          await handleJourneySwitch(id);
          setJourneysPanelOpen(false);
        }}
        onCreate={async (input) => {
          await handleJourneyCreate(input);
          setJourneysPanelOpen(false);
        }}
        onDelete={async (id) => {
          // Don't auto-close on delete: the user typically wants to
          // see the remaining journeys + maybe delete more or pick
          // a new active one. They can dismiss with the close button.
          await handleJourneyDelete(id);
        }}
        getTracksForLanguage={getTracksForLanguage}
        getTracksForLanguageSync={getTracksForLanguageSync}
      />

      <LegalSheet
        open={legalSheetOpen}
        onClose={() => setLegalSheetOpen(false)}
        onSelect={(link) => {
          setLegalSheetOpen(false);
          void openWebPath(link.path);
        }}
      />

      {/* Progress sheet — opens when the user taps the streak / level
          / XP badges in the journey top bar. Same content as the
          Progress tab, but presented as a slide-up sheet with a
          dismissable backdrop instead of a tab navigation. */}
      <Modal
        visible={progressSheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setProgressSheetOpen(false)}
      >
        <Pressable
          onPress={() => setProgressSheetOpen(false)}
          style={styles.progressSheetBackdrop}
        />
        <Animated.View
          style={[
            styles.progressSheetContainer,
            { transform: [{ translateY: progressSheetDragY }] },
          ]}
        >
          <View
            {...progressSheetPanResponder.panHandlers}
            style={styles.progressSheetHandleRow}
          >
            <View style={styles.progressSheetHandle} />
          </View>
          <ScrollView
            style={styles.progressSheetScroll}
            contentContainerStyle={styles.progressSheetContent}
            showsVerticalScrollIndicator={false}
            bounces={true}
            scrollEventThrottle={16}
            onScrollEndDrag={(e) => {
              // Pull-down-to-dismiss: when the ScrollView is at the top
              // and the user keeps dragging down, contentOffset.y goes
              // negative (because bounces=true). Past a threshold, treat
              // it as "close the sheet". We intentionally do NOT use the
              // velocity here — a fast scroll-up has a positive velocity
              // and would otherwise close the sheet by mistake.
              const y = e.nativeEvent.contentOffset.y;
              if (y < -70) {
                setProgressSheetOpen(false);
              }
            }}
          >
            {progressView}
          </ScrollView>
        </Animated.View>
      </Modal>

      {/* Topic preview — opens when the user taps a topic panel on
          the journey path. Shows the stories that will appear inside
          plus a vocabulary teaser, helping the user understand
          what's coming before they start. */}
      <TopicPreviewSheet
        open={Boolean(topicPreviewOpen)}
        onClose={() => setTopicPreviewOpen(null)}
        levelId={topicPreviewOpen?.levelId ?? ""}
        topicLabel={topicPreviewOpen?.topicLabel ?? ""}
        bgColor={topicPreviewOpen?.bgColor ?? "#1f7ee0"}
        stories={topicPreviewOpen?.stories ?? []}
        vocabWords={topicPreviewOpen?.vocabWords ?? []}
        isVocabLoading={topicPreviewOpen?.isVocabLoading ?? false}
      />

      {/* Extended splash — keeps the brand logo visible until the
          first hydrate completes, so the user sees logo → loaded
          content instead of logo → skeleton → content. The skeleton
          inside the shell is still rendered when needed (e.g. very
          slow hydrates where the splash already faded), but in the
          common case it's never visible. */}
      <ExtendedSplash visible={!didFirstHydrate} />

      {/* Level test offer modal — opens when the user taps a story
          gated by level. Offers the level test as a way to skip
          ahead instead of showing a dead-end toast. */}
      <Modal
        visible={Boolean(levelTestOfferOpen)}
        animationType="fade"
        transparent
        onRequestClose={() => setLevelTestOfferOpen(null)}
      >
        <View style={styles.levelTestOfferBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setLevelTestOfferOpen(null)}
          />
          <View style={styles.levelTestOfferCard}>
            <View style={styles.levelTestOfferIcon}>
              <Feather name="lock" size={20} color={tokenColor.gold} />
            </View>
            <Text style={styles.levelTestOfferTitle}>
              This story is at level {levelTestOfferOpen?.targetLevel}
            </Text>
            <Text style={styles.levelTestOfferBody}>
              {levelTestOfferOpen && hasLevelTest(levelTestOfferOpen.targetLanguage)
                ? "Take a 1-minute level test to unlock it without finishing the earlier levels."
                : "Complete the previous level to unlock this one."}
            </Text>
            <View style={styles.levelTestOfferActions}>
              {levelTestOfferOpen && hasLevelTest(levelTestOfferOpen.targetLanguage) ? (
                <Pressable
                  onPress={() => {
                    if (!levelTestOfferOpen) return;
                    const lang = levelTestOfferOpen.targetLanguage;
                    setLevelTestOfferOpen(null);
                    setLevelTestActive({ language: lang, source: "locked-story" });
                  }}
                  style={[styles.levelTestOfferButton, styles.levelTestOfferButtonPrimary]}
                >
                  <Feather name="zap" size={14} color={tokenBg[1]} />
                  <Text style={styles.levelTestOfferButtonPrimaryText}>
                    Take level test
                  </Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => setLevelTestOfferOpen(null)}
                style={[styles.levelTestOfferButton, styles.levelTestOfferButtonSecondary]}
              >
                <Text style={styles.levelTestOfferButtonSecondaryText}>
                  {levelTestOfferOpen && hasLevelTest(levelTestOfferOpen.targetLanguage)
                    ? "Not now"
                    : "OK"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Level test runner — fires when launched from a locked story.
          Onboarding has its own runner mounted inside OnboardingFlow,
          so this one is only for post-onboarding usage. */}
      {levelTestActive ? (
        <LevelTestRunner
          open={Boolean(levelTestActive)}
          language={levelTestActive.language}
          variant={preferences.preferredVariant}
          source={levelTestActive.source}
          onComplete={async (result) => {
            setLevelTestActive(null);
            // Map CEFR level to legacy preferredLevel for backend
            // compatibility, AND store the placement directly so
            // the journey can unlock content up to that level.
            const newPreferredLevel =
              result.level === "B2" || result.level === "C1"
                ? "Advanced"
                : result.level === "B1"
                  ? "Intermediate"
                  : "Beginner";
            setPreferences((current) => ({
              ...current,
              preferredLevel: newPreferredLevel,
              journeyPlacementLevel: result.level,
            }));
            if (sessionToken) {
              try {
                await apiFetch({
                  baseUrl: mobileConfig.apiBaseUrl,
                  path: "/api/mobile/preferences",
                  token: sessionToken,
                  method: "POST",
                  body: {
                    preferredLevel: newPreferredLevel,
                    journeyPlacementLevel: result.level,
                  },
                });
              } catch (err) {
                console.warn("[level-test] failed to persist", err);
              }
            }
          }}
          onCancel={() => setLevelTestActive(null)}
        />
      ) : null}

      {lockedStoryHint ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.lockedHintToast,
            {
              opacity: lockedHintAnim,
              transform: [
                {
                  translateY: lockedHintAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-20, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.lockedHintIcon}>
            <Feather name="lock" size={14} color="#0c1626" />
          </View>
          <Text style={styles.lockedHintText} numberOfLines={2}>
            {lockedStoryHint}
          </Text>
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
                  {/* Journey link removed in build 68 — it's already
                      in the bottom tab nav so the side menu entry was
                      a duplicate. The "journey" icon in MenuIcon is
                      still defined in case Journey re-enters the
                      menu under a different label later. */}

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

                  {/* Polyglot-only — internal QA tool. Wipes the
                      account's preferences (target languages,
                      journeys, focus, level, goals, reminders, the
                      onboarding-completed flag) on both client and
                      server, which makes the shell fall straight
                      into the onboarding gate again. The onboarding
                      runs in normal (persistent) mode so any new
                      selections REPLACE the old setup — letting you
                      test the new-user experience end-to-end on a
                      live account. Gated to `polyglot` because that
                      tier is for internal use only; this entry is
                      never visible to real users. */}
                  {effectivePlan === "polyglot" ? (
                    <MenuLink
                      label="Test mode"
                      icon="settings"
                      onPress={() => {
                        setMenuOpen(false);
                        void handleTestModeReset();
                      }}
                    />
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

              {/* Legal links collapsed into a single MenuLink in
                  build 68 — tapping it opens a bottom sheet with the
                  5 individual links (Impressum, Privacy, Cookies,
                  Terms, Data deletion). The inline list was eating
                  ~5 rows in the side menu; the sheet keeps them
                  one-tap-away while reclaiming that vertical space. */}
              <MenuLink
                label="Legal"
                icon="legal"
                onPress={() => {
                  setMenuOpen(false);
                  setLegalSheetOpen(true);
                }}
              />

              <Pressable onPress={() => void openFeedback()} style={styles.feedbackButton}>
                <Feather name="message-square" size={18} color="#dbe9ff" />
                <Text style={styles.feedbackButtonText}>Feedback</Text>
              </Pressable>
            </ScrollView>

            <View style={styles.menuFooter}>
              <Image
                source={require("../../assets/splash-logo-white.png")}
                style={styles.menuFooterLogo}
                resizeMode="contain"
                accessibilityLabel="Digital Polyglot"
              />
            </View>
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
  if (tab === "journey") return <Feather name="book" size={18} color={color} />;
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
  offlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255, 176, 59, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(255, 176, 59, 0.32)",
  },
  offlineBannerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ffb03b",
  },
  offlineBannerText: {
    flex: 1,
    color: "#f5e0b5",
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  container: {
    gap: 18,
    paddingHorizontal: 24,
    paddingTop: 28,
    // Just enough clearance to clear the floating bottom tab bar
    // (~58 pt). Earlier 80 pt left a noticeable empty stretch under
    // the last carousel on Home; we trade slack for a tighter end.
    paddingBottom: 56,
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
  journeyTopStrip: {
    flexDirection: "row",
    alignItems: "center",
    // Wider gap so the chip ("Travelers · B1") doesn't visually butt
    // up against the gamification stats row's lightning bolt — the
    // previous 10pt gap let them touch on long focus names.
    gap: 14,
    paddingTop: 10,
    paddingBottom: 6,
  },
  // Journey top bar lifted OUT of the ScrollView so it stays pinned
  // to the top of the screen. No background — the elements (flag
  // chip, stats, menu) "float" over the page background, matching
  // Duolingo where the top row sits transparently over the dark
  // canvas instead of inside a separate-colored bar.
  journeyTopStripFixed: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 8,
    backgroundColor: "transparent",
  },
  // Floating sticky topic panel — sits just below the lifted top
  // bar via `top: <approx top bar height>`. Renders on top of the
  // ScrollView as a sibling overlay; the in-flow topic panels keep
  // existing inside the scroll content and get covered by this
  // floating one as the user scrolls past.
  // Floating "back to top" arrow on the journey screen. Sits in
  // the bottom-right above the tab bar; the lime accent matches
  // the active-action color used elsewhere (next-pill halo, level-
  // up badges) so it reads as "tap me" rather than navigation
  // chrome.
  journeyScrollTopButton: {
    position: "absolute",
    right: 18,
    // ~80pt for the floating tab bar height + 20pt breathing space.
    bottom: 100,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#fcd34d",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 60,
    // Shadow externa para separar el botón del fondo y darle peso de
    // "botón flotante" sin bevels raros ni borders gruesos.
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  journeyScrollTopButtonPressed: {
    // Darker amber for the pressed state, matching the new yellow
    // base (#fcd34d). Earlier this was a darker LIME (#a3d647) —
    // a leftover from when the base was lime green; the user saw
    // the green flash on press because the pressed shade hadn't
    // been swapped along with the base color.
    backgroundColor: "#eab308",
  },
  journeyStickyTopicWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    // Top bar height is roughly 60pt + we add 18pt of breathing
    // space so the floating topic panel doesn't sit flush against
    // the gamification stats / hamburger row.
    top: 78,
    zIndex: 50,
    // Same horizontal padding as the ScrollView's container so the
    // floating panel matches the in-flow panel's width. Without this
    // the floating one was visibly wider than the in-flow one and
    // looked like it was "expanding sideways" during the swap.
    paddingHorizontal: 24,
  },
  journeyStickyTopicPanel: {
    // Floating sticky version of the topic panel — same dimensions
    // as the in-flow card, plus a stronger shadow so it visually
    // separates from the path content scrolling underneath.
    marginBottom: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  journeyLanguageChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#2d4562",
    backgroundColor: "#132238",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  journeyLanguageChipText: {
    color: "#f5f7fb",
    fontSize: 14,
    fontWeight: "800",
  },
  journeyStripStats: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
  },
  journeyStripStatsText: {
    color: "#aebcd3",
    fontSize: 12,
    fontWeight: "700",
  },
  journeyStripStatsPercent: {
    color: "#8ef0c6",
    fontWeight: "800",
  },
  journeyStripDueBadge: {
    color: "#f8c15c",
    fontSize: 11,
    fontWeight: "800",
    backgroundColor: "rgba(248, 193, 92, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(248, 193, 92, 0.38)",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: "hidden",
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
    // Sits directly on the app background — no framing card.
    gap: 12,
  },
  journeyMapList: {
    gap: 6,
    marginTop: 2,
  },
  journeyMapSequence: {
    gap: 4,
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
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 19,
    // Constrain the title to the node's art width so long titles wrap inside
    // the column instead of stretching past the cover; combined with the
    // numberOfLines={2} prop above, truly long titles get "…"-truncated.
    maxWidth: 160,
  },
  journeyMapMeta: {
    color: "#8fa4c0",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 16,
  },
  journeyMapConnectorRow: {
    // Tighter curve again — brings consecutive nodes ~24 pt closer so the
    // path fits more stops per viewport without feeling cramped.
    height: 64,
    width: "100%",
    justifyContent: "flex-start",
    marginTop: -50,
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
    height: 80,
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
  // ─── New Duolingo-style journey node (2026-04) ──────────────
  // Replaces the cover + full-title layout. The node is now a round
  // circle whose visual state encodes progress; only the "next up"
  // story shows its title (via a bubble floating above the circle).
  journeyTopicStatsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
    marginBottom: 4,
  },
  journeyTopicStatPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  journeyTopicStatText: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  journeyStartBubble: {
    position: "absolute",
    top: -46,
    alignItems: "center",
    zIndex: 2,
  },
  journeyStartBubbleInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "#f5f7fb",
    // Soft shadow so the bubble "floats" above the map on iOS and
    // gets a lift even on Android where iOS shadow props are a no-op.
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 5,
  },
  journeyStartBubbleEyebrow: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.4,
    color: tokenColor.cyan,
  },
  journeyStartBubbleTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: "#0c1626",
    maxWidth: 180,
  },
  journeyStartBubbleArrow: {
    // Downward triangle, carved from an empty view via rotated square
    // with two transparent sides — keeps us from pulling in an SVG
    // dependency for one arrow.
    marginTop: -1,
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 7,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#f5f7fb",
  },
  journeyNode: {
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  journeyNodeNext: {
    transform: [{ scale: 1.04 }],
  },
  journeyNodeCompleted: {},
  journeyNodeLocked: {
    opacity: 0.6,
  },
  journeyNodeStep: {
    opacity: 0.78,
  },
  journeyNodeCircleNext: {
    width: 78,
    height: 78,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokenColor.cyan,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.85)",
  },
  journeyNodeCircleCompleted: {
    width: 66,
    height: 66,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokenColor.xp,
    borderWidth: 2,
    borderColor: "rgba(252,211,77,0.45)",
  },
  journeyNodeCircleLocked: {
    width: 62,
    height: 62,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokenBg[2],
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.08)",
  },
  journeyNodeCircleStep: {
    width: 62,
    height: 62,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokenBg[2],
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.12)",
  },
  journeyNodeStepNumber: {
    color: "#dbe9ff",
    fontSize: 18,
    fontWeight: "900",
  },
  journeyNodeCaption: {
    marginTop: 2,
    color: "rgba(255,255,255,0.5)",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  journeyNodeCaptionNext: {
    color: tokenColor.cyan,
    fontSize: 11,
  },
  // ─── Full-path Duolingo-style scroll (level+topic headers inline) ──
  journeyPathLevelBlock: {
    marginTop: 18,
  },
  journeyPathLevelHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingTop: 6,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
    marginBottom: 10,
  },
  journeyPathLevelHeaderLocked: {
    // Opacity bumped from 0.55 → 0.85: at the lower value the locked
    // level title (A2 / B1 / …) was hard to spot against the dark
    // canvas — users were scrolling past it and reporting "only A1
    // shows up" because the rest blended in. 0.85 keeps it visibly
    // dimmer than the active level header without becoming a ghost.
    opacity: 0.85,
  },
  journeyPathLevelBadge: {
    color: "#f5f7fb",
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  journeyPathLevelSubtitle: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  journeyPathTopicBlock: {
    marginTop: 0,
    marginBottom: 8,
    // No vertical gap — the topic panel sits flush with the stories
    // below it so the sticky panel + path read as a single unit.
    gap: 0,
  },
  // Duolingo-style "you are here" panel. Solid cyan-blue card with
  // a small eyebrow (LEVEL ·) and the topic title. Sits as a
  // floating rounded card with horizontal margins (NOT edge-to-
  // edge) — Duolingo's reference uses this card-on-canvas look so
  // the panel reads as content, not as a section divider.
  journeyTopicPanel: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: "#1f7ee0",
    borderRadius: 16,
    gap: 10,
    marginBottom: 14,
    // Soft drop shadow so the card lifts off the canvas like the
    // Duolingo reference. Subtle on iOS where shadow rendering can
    // get aggressive.
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
  journeyStickyFloatingPanel: {
    // Pinned card that mirrors the in-flow topic panel and stays
    // visible while the stories below it scroll. Absolutely
    // positioned so showing / hiding it doesn't reflow the
    // ScrollView (in-flow caused the visible flicker the user
    // reported). `top` is supplied at render time from the measured
    // journey-top-bar height. The horizontal positioning mirrors
    // the path's content padding (24) so the sticky and in-flow
    // panels stay pixel-aligned during the swap. Shadow values
    // mirror the in-flow card exactly so the eye can't tell which
    // of the two is on top during the cross-over moment — earlier a
    // heavier shadow on the floating panel made the swap visible.
    position: "absolute",
    left: 24,
    right: 24,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 16,
    gap: 10,
    zIndex: 50,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
  journeyTopicPanelTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  journeyTopicPanelEyebrow: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 10.5,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  journeyTopicPanelEyebrowLocked: {
    color: "rgba(255,255,255,0.45)",
  },
  journeyTopicPanelIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  journeyTopicPanelLocked: {
    // Was #1f2a40, only ~4% lighter than the canvas (#051834), so
    // locked topic panels were almost invisible — users couldn't tell
    // there was content for A2 / B1 / etc. and reported "only A1
    // shows up". This shade is clearly distinguishable from the
    // canvas while still reading as muted vs the active cyan panel.
    backgroundColor: "#3b4a66",
  },
  journeyTopicPanelHidden: {
    // `display: none` (rather than opacity: 0) so the in-flow card
    // takes up zero pixels and there's no chance of seeing a one-
    // frame ghost behind the floating panel during the swap.
    opacity: 0,
  },
  journeyTopicPanelTitle: {
    color: "#ffffff",
    fontSize: 19,
    fontWeight: "900",
    letterSpacing: -0.3,
    lineHeight: 23,
    marginTop: 1,
  },
  journeyTopicPanelTitleLocked: {
    color: "rgba(255,255,255,0.5)",
  },
  // Empty-topic placeholder shown when a Studio topic has no published
  // stories yet. Sits below the topic header card with a subtle dashed
  // border so it reads as "intentionally placeholder", not "broken UI".
  journeyTopicEmptyState: {
    marginTop: 14,
    marginBottom: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  journeyTopicEmptyText: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 13,
    fontWeight: "700",
  },
  // Block injected after the last topic of an unlocked level. Surfaces
  // (a) the 75%-of-topics rule and (b) the level-test express lane so the
  // user understands what unlocks the next CEFR level instead of being
  // surprised when it pops open silently.
  journeyLevelGateBlock: {
    marginTop: 4,
    marginBottom: 22,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.04)",
    gap: 10,
  },
  journeyLevelGateProgressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  journeyLevelGateProgressText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
  journeyLevelGateHint: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
  },
  journeyLevelGateCta: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(252, 211, 77, 0.35)",
    backgroundColor: "rgba(252, 211, 77, 0.10)",
  },
  journeyLevelGateCtaText: {
    color: tokenColor.gold,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  journeyPathNodeWrap: {
    marginBottom: 18,
  },
  journeyPathCheckpointChip: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  journeyPathCheckpointChipLocked: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderColor: "rgba(255,255,255,0.1)",
  },
  journeyPathCheckpointChipReady: {
    backgroundColor: "rgba(252, 211, 77, 0.08)",
    borderColor: "rgba(252, 211, 77, 0.32)",
  },
  journeyPathCheckpointChipPassed: {
    backgroundColor: "rgba(252, 211, 77, 0.06)",
    borderColor: "rgba(252, 211, 77, 0.28)",
  },
  journeyPathCheckpointText: {
    fontSize: 10.5,
    fontWeight: "900",
    letterSpacing: 1.4,
    color: "#6f88a8",
  },
  // ─── Compact Duolingo-style header (flag-only chip + stats) ───────
  // The chip went text-less in build 67 — only flag + chevron — so it
  // stays compact and doesn't need a maxWidth/flexShrink dance to
  // share the row with the stats cluster. Level + topic live in the
  // sticky panel below the strip now.
  journeyHeaderFlagBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  journeyHeaderFlagBadgePressed: {
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  journeyHeaderFlagEmoji: {
    fontSize: 28,
    lineHeight: 32,
  },
  journeyHeaderLevelBadge: {
    color: "#f5f7fb",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: -0.2,
    // Allow the focus + level text to truncate with ellipsis instead
    // of forcing the chip wider than the strip can hold.
    flexShrink: 1,
    minWidth: 0,
  },
  // Two-letter language code rendered next to the flag in the
  // journey header chip ("ES", "DE", "FR", etc.). Slightly tighter
  // letterSpacing + uppercase weight gives it the compact Duolingo
  // feel without competing with the flag.
  journeyHeaderLanguageCode: {
    color: "#f5f7fb",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  // ─── Level test offer modal (locked-story tap) ─────────────────
  // Absolute fill instead of `flex: 1` so it always takes the whole
  // Modal viewport. The user reported the alert appearing "arriba"
  // (at the top) — that's a sign the parent Modal didn't pass a
  // flex height through, so the View collapsed against the top.
  levelTestOfferBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(5, 24, 52, 0.7)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  levelTestOfferCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#0c1626",
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    gap: 12,
    alignItems: "center",
  },
  levelTestOfferIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(252, 211, 77, 0.14)",
    marginBottom: 4,
  },
  levelTestOfferTitle: {
    color: "#ffffff",
    fontSize: 19,
    fontWeight: "900",
    letterSpacing: -0.4,
    textAlign: "center",
  },
  levelTestOfferBody: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13.5,
    lineHeight: 19,
    textAlign: "center",
    paddingHorizontal: 8,
  },
  levelTestOfferActions: {
    width: "100%",
    gap: 8,
    marginTop: 6,
  },
  levelTestOfferButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  levelTestOfferButtonPrimary: {
    backgroundColor: tokenColor.xp,
  },
  levelTestOfferButtonPrimaryText: {
    color: tokenBg[1],
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  levelTestOfferButtonSecondary: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  levelTestOfferButtonSecondaryText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
    fontWeight: "800",
  },
  journeyHeaderStatsRow: {
    // Residual space to the right of the chip. flex:1 + flex-end
    // alignment keeps the streak/level/XP cluster pinned to the
    // right edge while the chip on the left holds its capped width.
    flex: 1,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 12,
    paddingLeft: 4,
  },
  journeyHeaderStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  journeyHeaderStatText: {
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  // ─── Horizontal pill nodes ─────────────────────────────────────────
  // Pill keeps its full size — title space, cover thumb, badge — so
  // long titles don't ellipsize unnecessarily. The compactness for
  // long topics (7+ stories) comes from tighter vertical spacing
  // between rows + a soft horizontal wave (see `journeyPathNodeRow`
  // and the per-story marginLeft computed at render time) rather
  // than from shrinking the pill itself.
  journeyPathNodeRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
    // Per-story horizontal offset (paddingLeft) is set inline at
    // render time via the wave formula in `renderJourneyStoryNode`.
    // The hard left/right variants below are kept as empty styles so
    // legacy/dead branches that still reference them keep compiling;
    // they no longer influence layout.
  },
  journeyPathNodeRowLeft: {},
  journeyPathNodeRowRight: {},
  journeyNodePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 1,
    minWidth: 220,
    maxWidth: 290,
  },
  journeyNodePillNext: {
    // Same dimensions and same neutral border as the other variants —
    // we deliberately keep the cyan accent OUT of the border. The user
    // wanted "no borde, simplemente" (no rim, just the glow), so the
    // visual cue lives entirely in the breathing fill on top.
    backgroundColor: "rgba(125, 211, 252, 0.16)",
  },
  // Soft cyan FILL overlay rendered INSIDE the next pill, pulsing in
  // opacity. Replaces the earlier thin ring — the user reported the
  // ring alone read as "only the contour", which was too discreet.
  // A breathing fill makes the whole button glow gently while still
  // staying the exact same size/shape as the neutral pills. Native
  // driver opacity keeps it cheap.
  journeyNodePillNextGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 18,
    backgroundColor: tokenColor.cyan,
  },
  // Experiment overlays — A: glow violeta para diferenciarlo del cyan
  // del "next"; B: banda diagonal tipo shimmer que se mueve; C: borde
  // que respira sin halo de fondo.
  experimentGlow: {
    position: "absolute",
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 20,
    backgroundColor: "#a892ff",
  },
  experimentShimmerWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 18,
    overflow: "hidden",
  },
  experimentShimmerBand: {
    position: "absolute",
    top: -40,
    left: 0,
    width: 90,
    height: 200,
    backgroundColor: "rgba(255,255,255,0.09)",
  },
  experimentBreathBorder: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "#5dd9e8",
  },
  // Sutil 3D para los paneles de tema: highlight blanco arriba + sombra
  // negra abajo. Da profundidad sin shadow externa (que se sentía pesada).
  journeyTopicPanelBevel: {
    borderTopWidth: 2,
    borderTopColor: "rgba(255,255,255,0.32)",
    borderBottomWidth: 3,
    borderBottomColor: "rgba(0,0,0,0.32)",
  },
  // Wrap that hosts the breathing halo + the actual pill. Keeps the
  // halo behind the pill via z-stacking (halo is absolute, pill is the
  // sibling that sits on top by document order).
  journeyNextPillWrap: {
    position: "relative",
  },
  journeyNextHalo: {
    position: "absolute",
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    borderRadius: 28,
    backgroundColor: tokenColor.cyan,
    // Soft outward shadow on the halo itself so it bleeds into the
    // dark page bg. Combined with the looped opacity it reads as a
    // gentle pulse instead of a hard ring.
    shadowColor: tokenColor.cyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 18,
    elevation: 5,
  },
  // Progress sheet (bottom popup that replaces the old "tap stats →
  // jump to Progress tab" navigation).
  progressSheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(5, 24, 52, 0.55)",
  },
  progressSheetContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "92%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: tokenBg[1],
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingBottom: 22,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -16 },
    shadowOpacity: 0.55,
    shadowRadius: 24,
    elevation: 14,
  },
  progressSheetHandleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 10,
    paddingBottom: 6,
    paddingHorizontal: 16,
  },
  progressSheetHandle: {
    width: 44,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "rgba(255,255,255,0.28)",
  },
  progressSheetClose: {
    position: "absolute",
    right: 14,
    top: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  progressSheetScroll: {
    flex: 1,
  },
  progressSheetContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    paddingTop: 8,
    gap: 14,
  },
  // Toast for the "tap on a locked story" hint. Pinned near the top
  // (below the strip) so it doesn't fight with the bottom tab bar.
  lockedHintToast: {
    position: "absolute",
    top: 90,
    left: 24,
    right: 24,
    zIndex: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: "#f5f7fb",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 8,
  },
  lockedHintIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokenColor.gold,
  },
  lockedHintText: {
    flex: 1,
    color: "#0c1626",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 17,
  },
  journeyNodePillCompleted: {
    // Soft green wash + emerald edge — "you mastered this".
    // Subido de 0.1 → 0.18 para que la pill no se sienta muerta;
    // el "next" sigue dominando por su fondo sólido del topic.
    backgroundColor: "rgba(110, 231, 183, 0.18)",
    borderColor: "rgba(110, 231, 183, 0.55)",
  },
  journeyNodePillAudioFinished: {
    // Cool muted cyan — "you've been here, exercises pending".
    // Subido de 0.08 → 0.16 por la misma razón.
    backgroundColor: "rgba(125, 211, 252, 0.16)",
    borderColor: "rgba(125, 211, 252, 0.42)",
  },
  journeyNodePillLocked: {
    // Locked SÍ debe verse atenuado (es la única razón válida para
    // dim según el usuario). Mantenemos opacity 0.9 + bg bajo.
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.18)",
    opacity: 0.9,
  },
  journeyNodePillStep: {
    // Subido de 0.04 → 0.08 para que las stories no-tocadas se
    // vean presentes (no muertas) sin competir con el "next".
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.18)",
  },
  journeyNodePillIcon: {
    width: 48,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  journeyNodePillIconNext: {
    backgroundColor: tokenBg[2],
    borderWidth: 0,
    overflow: "hidden",
  },
  journeyNodePillCoverThumb: {
    width: 48,
    height: 40,
    borderRadius: 10,
  },
  journeyNodePillCoverThumbDim: {
    // Covers ya no se atenúan — el user pidió que las imágenes se
    // vean siempre nítidas. El estado se comunica por el badge,
    // no por dim.
    opacity: 1,
  },
  journeyNodePillCoverThumbCompleted: {
    opacity: 1,
  },
  journeyNodePillThumbWrap: {
    width: 48,
    height: 40,
    borderRadius: 10,
    overflow: "hidden",
    position: "relative",
  },
  journeyNodePillThumbBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: tokenBg[1],
  },
  journeyNodePillThumbBadgeCompleted: {
    // Bright emerald with a subtle inner highlight — meant to feel
    // celebratory, not muted. The dark check inside reads
    // immediately against the green.
    backgroundColor: "#34d399",
  },
  journeyNodePillThumbBadgeAudioFinished: {
    // Outline cyan — same check shape as the green mastery badge
    // but hollow, so the metaphor reads as "started, not finished".
    // The check inside is also cyan (matching the border) and
    // contrasts against the dark canvas behind the transparent
    // fill.
    backgroundColor: "transparent",
    borderColor: "#7dd3fc",
    borderWidth: 1.5,
  },
  journeyNodePillThumbBadgeLocked: {
    backgroundColor: tokenBg[3],
  },
  journeyNodePillThumbBadgeStep: {
    backgroundColor: tokenBg[3],
  },
  journeyNodePillThumbBadgeNumber: {
    color: "#dbe9ff",
    fontSize: 10,
    fontWeight: "900",
  },
  journeyNodePillIconCompleted: {
    backgroundColor: "#34d399",
  },
  journeyNodePillIconAudioFinished: {
    // Hollow cyan circle for cover-less stories: matches the
    // outline-check badge style of stories with covers.
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: "#7dd3fc",
  },
  journeyNodePillIconLocked: {
    backgroundColor: tokenBg[2],
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  journeyNodePillIconStep: {
    backgroundColor: tokenBg[2],
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  journeyNodePillStepNumber: {
    color: "#dbe9ff",
    fontSize: 15,
    fontWeight: "900",
  },
  journeyNodePillTextStack: {
    flex: 1,
    minWidth: 0,
  },
  journeyNodePillLabel: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  journeyNodePillLabelNext: {
    color: "#0c1626",
    // Restore the cyan brand for the START NOW label so the white pill
    // doesn't read as just a generic action; the colored text + the
    // looped cyan halo behind the card both signal "this is the one".
  },
  journeyNodePillSub: {
    color: "#cdd9ec",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 1,
  },
  journeyNodePillSubNext: {
    color: "rgba(12, 22, 38, 0.72)",
  },
  journeyPathDownloadBadge: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
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
    borderColor: "rgba(252,211,77,0.22)",
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
    // No framing card — the topic header + story list sit on the app bg.
    gap: 8,
  },
  journeyTopicDetailHeader: {
    gap: 2,
  },
  journeyTopicDetailTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 24,
  },
  journeyTopicDetailStatus: {
    color: "#aebcd3",
    fontSize: 12,
    fontWeight: "600",
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
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignSelf: "center",
  },
  journeyStoryDownloadBadge: {
    // The node pressable is 172 pt wide and its 84x84 cover art is centered
    // inside with a 20 pt badge + 6 pt gap above it. That puts the top of
    // the art at y ≈ 26 from the top of the wrap, and its right edge 44 pt
    // from whichever side the node is aligned to. We overlay a 30x30
    // circular download badge on the top-right of the cover.
    position: "absolute",
    top: 22,
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(5, 14, 26, 0.82)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  journeyStoryDownloadBadgeLeft: {
    // Left-aligned node: node spans [0, 172]; art right-edge at x = 128.
    // Badge left = 128 - 30 = 98.
    left: 98,
  },
  journeyStoryDownloadBadgeRight: {
    // Right-aligned node: art right-edge is 44 pt from the wrap's right edge.
    right: 44,
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
    // Horizontal ScrollView defaults to alignItems:"stretch", which makes
    // shorter cards (e.g. BookWebCard ≈170 pt) grow to match the tallest
    // item (e.g. BookHomeCard ≈320 pt) and leaves empty space below their
    // content. Keep each card at its own intrinsic height.
    alignItems: "flex-start",
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
    // Pure white per the user's request — the previous "#fff6d7"
    // gave the word a yellow tint that didn't match the rest of the
    // typography on the favorites card.
    color: "#ffffff",
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
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#5a2a2a",
    backgroundColor: "#3a1d1d",
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  favoriteRemovePressed: {
    backgroundColor: "#532727",
    borderColor: "#7a3535",
  },
  favoriteRemoveText: {
    color: "#f5b5b5",
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
  favoritesHero: {
    gap: 8,
    paddingTop: 8,
    paddingBottom: 2,
  },
  favoritesHeroTextBlock: {
    flex: 1,
    gap: 2,
  },
  favoritesHeroTitle: {
    color: "#f5f7fb",
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 26,
  },
  favoritesHeroStats: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
  },
  favoritesCompactBar: {
    gap: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#27405f",
    backgroundColor: "#14243b",
    paddingHorizontal: 10,
    paddingVertical: 8,
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
  favoritesPracticeCta: {
    marginTop: 16,
    // Clearance extra para el bottom tab bar — el `paddingBottom: 56`
    // del container global no alcanza para que el CTA primario quede
    // 100% visible sobre la tab bar flotante de iOS. Este margin
    // empuja el botón hacia arriba lo suficiente para que el tap
    // target completo quede expuesto.
    marginBottom: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: tokenColor.xp,
  },
  favoritesPracticeCtaText: {
    color: tokenBg[1],
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  favoritesEmptyFilter: {
    marginTop: 16,
    paddingVertical: 24,
    alignItems: "center",
  },
  favoritesEmptyFilterText: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
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
    paddingTop: 4,
    paddingBottom: 4,
    gap: 8,
  },
  practiceErrorCard: {
    marginBottom: 8,
  },
  practiceRow: {
    flex: 1,
    flexDirection: "row",
    gap: 8,
  },
  practiceModeCard: {
    flex: 1,
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
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 22,
  },
  practiceModeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    // Wrap translúcido blanco: el icono blanco encima rinde con
    // contraste alto sobre cualquier color de fondo del card. Mismo
    // patrón que los topic panels del journey.
    backgroundColor: "rgba(255,255,255,0.18)",
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
    fontSize: 14,
    lineHeight: 20,
  },
  practiceModeBody: {
    flex: 1,
    justifyContent: "center",
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
    color: "#0c1626",
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
    // Background and border removed — the practice session now lives on the
    // same dark surface as Journey / Topic views. The only color accent is
    // the per-mode tint applied to the eyebrow pill and the progress bar,
    // which keeps the "which mode am I in" signal without the heavy panel.
    paddingHorizontal: 4,
    paddingTop: 4,
    gap: 12,
  },
  practiceSessionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  practiceSessionPauseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(6,16,28,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  practiceTimerBarTrack: {
    height: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
    marginTop: 2,
    marginBottom: 4,
  },
  practiceTimerBarFill: {
    height: "100%",
    borderRadius: 999,
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
    // Content starts at the top (flex-start) and grows downward via
    // bigger fonts + taller option rows, so the visible area gets
    // filled organically without centering. Earlier the card was
    // centered, but that produced an empty stripe ABOVE the card
    // instead of below — same problem in a different position. The
    // fix now is to make the content elements (sentence + options)
    // larger so they naturally fill the space, while still
    // scrolling normally on smaller phones where they overflow.
    // PaddingBottom 40: en iPhones más chicos (SE, mini) las 4
    // opciones + el footer hint quedaban tapados por la última
    // opción cortada. 40px da espacio de respiración para que
    // siempre se vea la opción completa + el botón de check.
    flexGrow: 1,
    paddingBottom: 40,
  },
  practiceQuestionCard: {
    // Intrinsic height (no flex) so the card hugs its content. The
    // earlier flex+space-between attempt didn't work because the
    // wrapping Animated.View has no flex height. Instead we now
    // make the inner content (sentence + option rows) larger so it
    // organically fills the available area, leaving less empty
    // space below it. Padding + gap bumped to match the bigger
    // typography and option rows.
    borderRadius: 28,
    backgroundColor: "rgba(7,18,31,0.36)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 18,
    gap: 14,
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
    // Bumped from 12 → 19 so the sentence reads as the focal point
    // of the exercise instead of a small caption above the options.
    // This (combined with taller option rows below) is what fills
    // the previously empty area at the bottom of the card on tall
    // devices, instead of centering a small block.
    color: "#f5f7fb",
    fontSize: 19,
    fontWeight: "700",
    lineHeight: 26,
    marginVertical: 6,
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
    // Wider gap between option rows so each tap target reads as a
    // distinct button, not a stack of cells. Combined with the
    // taller paddingVertical below this brings the 4 options into
    // the comfortable Duolingo zone of one-thumb-per-option.
    gap: 10,
  },
  practiceOption: {
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingHorizontal: 16,
    // 10 → 18: taller rows for bigger tap targets and better filling
    // of the available vertical space without resorting to centering.
    paddingVertical: 18,
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
    // 13 → 16: bigger option labels match the larger sentence above.
    color: "#f5f7fb",
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 20,
  },
  // ── Meaning-mode overrides ────────────────────────────────────────
  // The "make options + sentence bigger" pass was meant for context /
  // listening / match where the card was leaving an empty band at the
  // bottom of tall devices. Meaning was already balanced with the
  // smaller original sizes; applying the bigger pass to it as well
  // pushed its content past the screen and forced a scroll. These
  // overrides revert the spacing back to the pre-bump values, but
  // only for meaning. Keep this list in sync with the styles above.
  practiceExerciseScrollContentMeaning: {
    paddingBottom: 72,
  },
  practiceQuestionCardMeaning: {
    padding: 12,
    gap: 10,
  },
  practiceSentenceMeaning: {
    color: "rgba(226,232,244,0.8)",
    fontSize: 12,
    fontWeight: "400",
    lineHeight: 17,
    marginVertical: 0,
  },
  practiceOptionsMeaning: {
    gap: 6,
  },
  practiceOptionMeaning: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    paddingVertical: 10,
  },
  practiceOptionTextMeaning: {
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
  practiceMatchChipWrong: {
    // Same red palette as the multiple-choice "wrong" option, so the
    // visual feedback is consistent across all four practice modes.
    borderColor: "#fb7185",
    backgroundColor: "rgba(251,113,133,0.22)",
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
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 12,
  },
  practiceLaunchLoaderCard: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 12,
  },
  practicePerfectRing: {
    width: 92,
    height: 92,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(252, 211, 77, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(252, 211, 77, 0.42)",
  },
  practicePerfectRingInner: {
    width: 64,
    height: 64,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokenColor.gold,
  },
  practicePerfectTitle: {
    color: tokenColor.gold,
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: -0.5,
    textAlign: "center",
  },
  practiceResultScore: {
    color: "#ffffff",
    fontSize: 54,
    fontWeight: "900",
    lineHeight: 58,
    textAlign: "center",
  },
  practiceResultText: {
    color: "rgba(226,232,244,0.82)",
    fontSize: 16,
    lineHeight: 23,
    textAlign: "center",
  },
  practiceResultStatusText: {
    color: "#b8c9df",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  practiceResultActions: {
    width: "100%",
    flexDirection: "column",
    alignItems: "center",
    gap: 10,
    marginTop: 6,
  },
  practiceResultActionButton: {
    minWidth: 220,
    alignSelf: "center",
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
  progressHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 2,
    paddingBottom: 4,
  },
  progressTopEyebrow: {
    color: "#9cb0c9",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2,
  },
  progressTopWeek: {
    color: "#9cb0c9",
    fontSize: 12,
    fontWeight: "700",
  },
  progressStreakHero: {
    width: 220,
    height: 220,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginVertical: 6,
    position: "relative",
  },
  progressStreakRing: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 5,
    borderColor: "#a8e845",
    backgroundColor: "rgba(11, 22, 40, 0.55)",
    shadowColor: "#a8e845",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 18,
  },
  progressStreakCenter: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  progressStreakFlame: {
    fontSize: 26,
    marginBottom: 0,
  },
  progressStreakValue: {
    color: "#ffffff",
    fontSize: 64,
    fontWeight: "900",
    lineHeight: 68,
    marginTop: -2,
    letterSpacing: -1.5,
  },
  progressStreakLabel: {
    color: "#f5a261",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 2.4,
    marginTop: 2,
  },
  progressLevelPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    alignSelf: "center",
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "rgba(168, 232, 69, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(168, 232, 69, 0.45)",
    marginTop: 4,
    marginBottom: 4,
  },
  progressLevelPillText: {
    color: "#a8e845",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  progressStatsGridV4: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  progressStatV4: {
    width: "48%",
    flexGrow: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    backgroundColor: "#101a2e",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 4,
  },
  progressStatV4Header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  progressStatV4Eyebrow: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  progressStatV4Value: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "900",
    lineHeight: 32,
    letterSpacing: -0.6,
  },
  progressStatV4Sub: {
    color: "#7d92ad",
    fontSize: 12,
    fontWeight: "600",
  },
  progressWeekCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    backgroundColor: "#101a2e",
    padding: 16,
    gap: 14,
  },
  progressWeekHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  progressWeekEyebrow: {
    color: "#5dd9e8",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.6,
  },
  progressWeekResets: {
    color: "#7d92ad",
    fontSize: 12,
    fontWeight: "600",
  },
  progressWeekList: {
    gap: 12,
  },
  progressWeekRow: {
    gap: 7,
  },
  progressWeekRowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  progressWeekRowLabelGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  progressWeekRowLabel: {
    color: "#dbe9ff",
    fontSize: 15,
    fontWeight: "700",
  },
  progressWeekRowValue: {
    fontSize: 14,
  },
  progressWeekRowValueStrong: {
    fontSize: 15,
    fontWeight: "900",
  },
  progressWeekRowValueTotal: {
    color: "#7d92ad",
    fontSize: 13,
    fontWeight: "600",
  },
  progressWeekRowTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },
  progressWeekRowFill: {
    height: "100%",
    borderRadius: 999,
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
    flex: 1,
    flexDirection: "column",
  },
  menuFooter: {
    paddingTop: 18,
    alignItems: "center",
  },
  menuFooterLogo: {
    width: 160,
    height: 80,
    opacity: 0.85,
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
