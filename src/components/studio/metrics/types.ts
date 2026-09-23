/**
 * Shared payload shape consumed by the studio metrics views.
 * Mirrors the response of /api/metrics/dashboard so view components
 * can stay strongly typed without importing server-only modules.
 */

// Solo el tipo: `@/lib/metricsRatings` importa Prisma y no viaja al cliente.
import type { RatingsMetrics } from "@/lib/metricsRatings";

export type DashboardKpis = {
  dau: number;
  wau: number;
  /** Personas distintas en los 30 días de calendario que acaban hoy. */
  mau?: number;
  /** DAU medio de esos 30 días sobre el MAU, en %. Falta en respuestas viejas. */
  dauMauPct?: number;
  activeUsersInRange: number;
  plays: number;
  completions: number;
  completionRate: number;
  uniqueStories: number;
  uniqueBooks: number;
  /** Minutos entre quien REPRODUJO algo. Falta en respuestas viejas. */
  minutesPerListener?: number;
  /** Cuántas personas reprodujeron algo en el rango. */
  listeners?: number;
  /** Ejercicios entre quien PRACTICÓ. Falta en respuestas viejas. */
  exercisesPerPractitioner?: number;
  /** Cuántas personas terminaron alguna sesión de práctica. */
  practitioners?: number;
  totalListenedMinutes: number;
  savedStories: number;
  savedBooks: number;
  /** Parejas persona+historia con alguna señal en el rango. Falta en respuestas viejas. */
  storiesStarted?: number;
  /** De esas, las que llegaron al final. */
  storiesFinished?: number;
};

/**
 * Una fila de la tabla por persona: cada cifra con su gemela del periodo
 * anterior al lado, que es lo que deja leerla como mejora o como caída.
 */
export type MetricsPerUserRow = {
  userId: string;
  name: string | null;
  email: string | null;
  minutes: number;
  prevMinutes: number;
  activeDays: number;
  prevActiveDays: number;
  storiesFinished: number;
  prevStoriesFinished: number;
  practices: number;
  prevPractices: number;
  lastAt: string | null;
};

/** Una persona detrás de una tarjeta de KPI, para la tarjeta al pasar el cursor. */
export type MetricsKpiUser = {
  userId: string;
  name: string | null;
  email: string | null;
  /**
   * Si Clerk conoce la cuenta. Falta en respuestas cacheadas viejas, donde
   * se trata como `unavailable`: no saber no es lo mismo que estar borrada.
   */
  identityStatus?: "ok" | "deleted" | "unavailable";
  /** Eventos suyos en la ventana de la tarjeta: hoy en DAU, 7d en WAU. */
  events: number;
  /** Minutos de audio en esa ventana. Falta en respuestas cacheadas viejas. */
  minutes?: number;
  lastAt: string | null;
};

export type DashboardData = {
  range: { from: string; to: string; days: number };
  prevRange?: { from: string; to: string; days: number };
  kpis: DashboardKpis;
  prevKpis?: DashboardKpis;
  /** Falta en respuestas cacheadas de antes de que las tarjetas dijeran quién. */
  kpiUsers?: { dau: MetricsKpiUser[]; wau: MetricsKpiUser[] };
  daily: Array<{
    date: string;
    plays: number;
    completions: number;
    completionRate: number;
    /** Minutos por oyente ESE día. Falta en respuestas viejas. */
    minutesPerListener?: number;
    /** Ejercicios por practicante ESE día. Falta en respuestas viejas. */
    exercisesPerPractitioner?: number;
    /** Personas distintas activas ESE día (el DAU de ese día). */
    activeUsers?: number;
    /** Personas distintas en los 7 días que acaban ese día. */
    wau?: number;
    /** DAU de ese día sobre el MAU de los 30 que acaban ahí, en %. */
    dauMauPct?: number;
    /** Minutos de audio de ESE día. */
    listenedMinutes?: number;
  }>;
  /**
   * Usuarios, minutos y completion rate por idioma y VARIANTE del journey.
   * Falta en respuestas cacheadas de antes de que existiera.
   */
  languageSplit?: Array<{
    language: string;
    variant: string;
    users: number;
    started: number;
    finished: number;
    completionRate: number;
    minutes: number;
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
    /** Falta en respuestas cacheadas de antes de que existiera la tabla. */
    perUser?: MetricsPerUserRow[];
  };
  learning: {
    practice: {
      started: number;
      completed: number;
      completionRate: number;
      avgAccuracyPercent: number;
      practicingUsers: number;
      byMode: Array<{
        mode: string;
        started: number;
        completed: number;
        completionRate: number;
        avgAccuracyPercent: number;
      }>;
      accuracyDistribution: Array<{ bucket: string; sessions: number }>;
    };
    vocab: {
      lookups: number;
      uniqueWords: number;
      lookingUpUsers: number;
      lookupsPerReader: number;
      topWords: Array<{
        word: string;
        language: string | null;
        wordType: string | null;
        lookups: number;
        users: number;
      }>;
      bySource: Array<{ source: string; lookups: number }>;
    };
    byLanguage: Array<{
      language: string;
      lookups: number;
      practiceCompleted: number;
      avgAccuracyPercent: number;
      users: number;
    }>;
    byLevel: Array<{
      level: string;
      practiceStarted: number;
      practiceCompleted: number;
      avgAccuracyPercent: number;
      users: number;
    }>;
    levelUnattributed: {
      sessions: number;
      placeholder: number;
      unknownStory: number;
    };
  };
  /** Falta en respuestas cacheadas de antes de que existiera el panel. */
  ratings?: RatingsMetrics;
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
  /** Los totales acumulados. La API no la conoce: cae en "overview". */
  | "vanity"
  | "acquisition"
  | "engagement"
  | "learning"
  | "content"
  | "funnels"
  | "audience"
  | "alerts";
