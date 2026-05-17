/**
 * Shared payload shape consumed by the studio metrics views.
 * Mirrors the response of /api/metrics/dashboard so view components
 * can stay strongly typed without importing server-only modules.
 */

export type DashboardKpis = {
  dau: number;
  wau: number;
  activeUsersInRange: number;
  plays: number;
  completions: number;
  completionRate: number;
  uniqueStories: number;
  uniqueBooks: number;
  avgMinutesPerActiveUser: number;
  totalListenedMinutes: number;
  savedStories: number;
  savedBooks: number;
};

export type DashboardData = {
  range: { from: string; to: string; days: number };
  prevRange?: { from: string; to: string; days: number };
  kpis: DashboardKpis;
  prevKpis?: DashboardKpis;
  daily: Array<{
    date: string;
    plays: number;
    completions: number;
    completionRate: number;
  }>;
  topStories: Array<{
    storySlug: string;
    plays: number;
    completions: number;
    completionRate: number;
  }>;
  topBooks: Array<{
    bookSlug: string;
    plays: number;
    completions: number;
    completionRate: number;
  }>;
  topStoriesByMinutes: Array<{
    storySlug: string;
    listenedMinutes: number;
    listeners: number;
    language: string | null;
  }>;
  topSavedStories: Array<{ storySlug: string; saves: number }>;
  topSavedBooks: Array<{ bookSlug: string; saves: number }>;
  signups: { total: number; last7d: number; last30d: number };
  recentSignups: Array<{
    userId: string;
    email: string | null;
    createdAt: string;
  }>;
  trialFunnel: {
    started: number;
    startedWithPm: number;
    day1Active: number;
    converted: number;
    canceled: number;
    conversionRate: number;
    day1ActivationRate: number;
    cancelRate: number;
  };
  recentTrialStarts: Array<{
    userId: string;
    email: string | null;
    eventType: string;
    createdAt: string;
  }>;
  recentReminderTaps: Array<{
    userId: string;
    email: string | null;
    eventType: string;
    destination: string | null;
    source: string | null;
    createdAt: string;
  }>;
  recentReminderOpens: Array<{
    userId: string;
    email: string | null;
    eventType: string;
    destination: string | null;
    createdAt: string;
  }>;
  checkoutFunnel: {
    plansViewed: number;
    checkoutStarted: number;
    checkoutRedirected: number;
    checkoutFailed: number;
    checkoutStartRate: number;
    checkoutRedirectRate: number;
  };
  upgradeCtaSources: Array<{ source: string; clicks: number }>;
  journeyFunnel: {
    variantSelected: number;
    levelSelected: number;
    topicOpened: number;
    nextActionClicked: number;
    reviewCtaClicked: number;
    checkpointRecoveryClicked: number;
    recommendedModeOpened: number;
    topicOpenRateFromVariant: number;
    nextActionRateFromTopicOpen: number;
    reviewRateFromTopicOpen: number;
  };
  reminderFunnel: {
    scheduled: number;
    tapped: number;
    destinationOpened: number;
    tapRateFromScheduled: number;
    openRateFromTap: number;
    destinationBreakdown: Array<{ destination: string; opens: number }>;
  };
  audience: {
    onboardingFunnel: {
      started: number;
      step1Completed: number;
      step2Completed: number;
      step3Completed: number;
      finished: number;
      abandoned: number;
      levelTestStarted: number;
      levelTestCompleted: number;
      step1Rate: number;
      step2Rate: number;
      step3Rate: number;
      finishRate: number;
      levelTestCompleteRate: number;
    };
    weeklyActivity: {
      activeUsersLast7Days: number;
      usersOver5Min: number;
      usersOver10Min: number;
      usersOver30Min: number;
      usersOver60Min: number;
      activationRate10MinPct: number;
      medianMinutes: number;
      avgMinutesLast7Days: number;
      distribution: Array<{ bucket: string; users: number }>;
    };
  };
};

export type PipelineData = {
  agentRuns: {
    total: number;
    byKind: { planner: number; content: number; qa: number };
    byStatus: { completed: number; failed: number; running: number };
    last7Days: Array<{ date: string; completed: number; failed: number }>;
  };
  drafts: {
    total: number;
    byStatus: {
      draft: number;
      generated: number;
      qa_pass: number;
      qa_fail: number;
      needs_review: number;
      approved: number;
      published: number;
    };
    avgQaScore: number | null;
    qaPassRate: number;
    last7Days: Array<{ date: string; created: number; published: number }>;
  };
  briefs: { total: number; pending: number; completed: number };
  pipeline: { avgTimeToPublish: number | null; contentPerDay: number };
};

export type MetricsSection =
  | "overview"
  | "acquisition"
  | "engagement"
  | "learning"
  | "content"
  | "funnels"
  | "audience"
  | "experiments"
  | "alerts"
  | "exports";
