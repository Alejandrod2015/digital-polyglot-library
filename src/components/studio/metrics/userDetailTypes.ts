/**
 * Contrato de `/api/metrics/user/[userId]`. Espejo del payload que arma el
 * route handler; si cambias uno, cambia el otro.
 */

export type UserDetailStory = {
  slug: string;
  title: string;
  /** false = no existe en catálogo, el título es el slug humanizado. */
  titleResolved: boolean;
  language: string | null;
  bookSlug: string | null;
  minutes: number;
  seconds: number;
  durationSec: number | null;
  progressPct: number | null;
  plays: number;
  completions: number;
  opens: number;
  lastAt: string | null;
};

export type UserDetail = {
  user: {
    userId: string;
    name: string | null;
    email: string | null;
    imageUrl: string | null;
    createdAt: string | null;
    lastSignInAt: string | null;
    targetLanguages: string[];
    nativeLanguage: string | null;
    level: string | null;
    dailyMinutesGoal: number | null;
    remindersEnabled: boolean | null;
    platform: "ios" | "web" | null;
    signupPlatform: string | null;
    pushTokens: number;
    clerkFound: boolean;
  };
  plan: {
    plan: string;
    status: string;
    source: string;
    productId: string | null;
    willRenew: boolean;
    startedAt: string;
    renewedAt: string | null;
    trialEndsAt: string | null;
    expiresAt: string | null;
  } | null;
  beta: {
    status: string;
    appliedAt: string;
    invitedAt: string | null;
    targetLanguage: string;
    currentLevel: string;
    weeklyHours: string | null;
    referralSource: string | null;
    feedbackCount: number;
    recentFeedback: Array<{
      kind: string;
      rating: number | null;
      status: string;
      message: string;
      at: string;
    }>;
  } | null;
  emailPrefs: {
    progress: boolean;
    reminders: boolean;
    unsubscribedAll: boolean;
  } | null;
  activity: {
    totalEvents: number;
    truncated: boolean;
    firstEventAt: string | null;
    lastEventAt: string | null;
    activeDays: number;
    currentStreakDays: number;
    longestStreakDays: number;
    sessions: number;
    totalActiveMinutes: number;
    avgSessionMinutes: number;
    longestSessionMinutes: number;
    byPlatform: { ios: number; web: number; unknown: number };
    daily: Array<{ date: string; events: number; minutes: number }>;
    recentSessions: Array<{
      startedAt: string;
      endedAt: string;
      minutes: number;
      events: number;
      stories: string[];
    }>;
  };
  listening: {
    totalMinutes: number;
    plays: number;
    completions: number;
    completionRate: number;
    storiesOpened: number;
    uniqueStories: number;
    uniqueBooks: number;
    seeks: number;
    speedChanges: number;
    lastSpeed: number | null;
    stories: UserDetailStory[];
    inProgress: Array<{
      slug: string;
      title: string;
      titleResolved: boolean;
      language: string | null;
      progressSec: number;
      durationSec: number | null;
      pct: number | null;
      lastPlayedAt: string;
    }>;
  };
  practice: {
    started: number;
    completed: number;
    completionRate: number;
    avgAccuracy: number | null;
    totalItems: number;
    lastAt: string | null;
    recommendedModeOpened: number;
    byMode: Array<{ mode: string; sessions: number; avgAccuracy: number | null }>;
    recent: Array<{
      at: string;
      mode: string | null;
      storySlug: string | null;
      storyTitle: string | null;
      accuracy: number | null;
      items: number | null;
    }>;
  };
  vocab: {
    clicks: number;
    uniqueWords: number;
    savedWords: number;
    collections: number;
    topWords: Array<{ word: string; count: number }>;
    recentSaved: Array<{
      word: string;
      translation: string;
      wordType: string | null;
      language: string | null;
      storyTitle: string | null;
      streak: number;
      createdAt: string;
    }>;
  };
  journeys: {
    variantSelected: number;
    topicOpened: number;
    storiesRead: number;
    checkpoints: number;
    checkpointRecovery: number;
    variants: Array<{
      variantId: string;
      name: string;
      language: string | null;
      variant: string | null;
      status: string | null;
      events: number;
      lastAt: string | null;
    }>;
    topics: Array<{ topicId: string; label: string; opens: number }>;
  };
  notifications: {
    scheduled: number;
    tapped: number;
    destinationOpened: number;
    pushOpened: number;
    tapRate: number;
    byTarget: Array<{ kind: string; count: number }>;
  };
  monetization: {
    plansViewed: number;
    lastPlansViewedAt: string | null;
    upgradeCtaClicks: number;
    ctaSources: Array<{ source: string; count: number }>;
    trialStarted: number;
    trialStartedWithPm: number;
    trialConverted: number;
    trialCanceled: number;
    paid: boolean;
  };
  onboarding: {
    started: boolean;
    stepsCompleted: number[];
    finished: boolean;
    finishedAt: string | null;
    abandoned: boolean;
    levelTestStarted: boolean;
    levelTestCompleted: boolean;
  };
  library: {
    savedStories: number;
    savedBooks: number;
    favorites: number;
    collections: number;
    ownStories: number;
  };
  timeline: Array<{
    at: string;
    eventType: string;
    storySlug: string | null;
    storyTitle: string | null;
    platform: string | null;
    detail: string | null;
  }>;
};
