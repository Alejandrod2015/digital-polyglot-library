export const runtime = "nodejs";

import { getAuth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getInternalUserIds, isMetricsAccessAllowed } from "@/lib/metricsAccess";
import { resolveUserEmails } from "@/lib/metricsUserEmails";
import { books } from "@/data/books";
import { getStandaloneStoriesByIds, getStandaloneStoriesBySlugs } from "@/lib/standaloneStories";

const METRICS_DASHBOARD_CACHE_TTL_MS = 60 * 1000;
const RECENT_TRIAL_STARTS_LIMIT = 20;
const RECENT_REMINDER_TAPS_LIMIT = 20;
const RECENT_REMINDER_OPENS_LIMIT = 20;

const metricsDashboardCache = new Map<
  string,
  { createdAt: number; payload: DashboardResponse }
>();

type EventRow = {
  userId: string;
  bookSlug: string | null;
  storySlug: string;
  eventType: string;
  createdAt: Date;
};

type ProgressRow = {
  userId: string;
  storySlug: string;
  value: number | null;
  metadata?: unknown;
};

type SavedStoryRow = {
  storyId: string;
  _count: { _all: number };
};

type SavedBookRow = {
  bookId: string;
  _count: { _all: number };
};

type TrialStartRow = {
  userId: string;
  eventType: string;
  createdAt: Date;
};

type ReminderTapRow = {
  userId: string;
  eventType: string;
  createdAt: Date;
  metadata?: unknown;
};

type DashboardResponse = {
  range: {
    from: string;
    to: string;
    days: number;
  };
  prevRange?: {
    from: string;
    to: string;
    days: number;
  };
  prevKpis?: {
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
  kpis: {
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
    /** Canonical language code (es / it / de / fr / pt / en) resolved from
     * the story's metadata. `null` when the slug doesn't match any known
     * source. Replaces the previous slug-regex heuristic on the client
     * that produced false positives (e.g. "dia-de-muertos" → "de"). */
    language: string | null;
  }>;
  topSavedStories: Array<{
    storySlug: string;
    saves: number;
  }>;
  topSavedBooks: Array<{
    bookSlug: string;
    saves: number;
  }>;
  signups: {
    total: number;
    last7d: number;
    last30d: number;
  };
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
  upgradeCtaSources: Array<{
    source: string;
    clicks: number;
  }>;
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
    destinationBreakdown: Array<{
      destination: string;
      opens: number;
    }>;
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

type DashboardSection =
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

function parseSection(raw: string | null): DashboardSection {
  switch (raw) {
    case "acquisition":
    case "engagement":
    case "learning":
    case "content":
    case "funnels":
    case "audience":
    case "experiments":
    case "alerts":
    case "exports":
      return raw;
    case "overview":
    default:
      return "overview";
  }
}

function createEmptyDashboardResponse(from: Date, to: Date, days: number): DashboardResponse {
  return {
    range: {
      from: from.toISOString(),
      to: to.toISOString(),
      days,
    },
    kpis: {
      dau: 0,
      wau: 0,
      activeUsersInRange: 0,
      plays: 0,
      completions: 0,
      completionRate: 0,
      uniqueStories: 0,
      uniqueBooks: 0,
      avgMinutesPerActiveUser: 0,
      totalListenedMinutes: 0,
      savedStories: 0,
      savedBooks: 0,
    },
    daily: [],
    topStories: [],
    topBooks: [],
    topStoriesByMinutes: [],
    topSavedStories: [],
    topSavedBooks: [],
    signups: { total: 0, last7d: 0, last30d: 0 },
    recentSignups: [],
    trialFunnel: {
      started: 0,
      startedWithPm: 0,
      day1Active: 0,
      converted: 0,
      canceled: 0,
      conversionRate: 0,
      day1ActivationRate: 0,
      cancelRate: 0,
    },
    recentTrialStarts: [],
    recentReminderTaps: [],
    recentReminderOpens: [],
    checkoutFunnel: {
      plansViewed: 0,
      checkoutStarted: 0,
      checkoutRedirected: 0,
      checkoutFailed: 0,
      checkoutStartRate: 0,
      checkoutRedirectRate: 0,
    },
    upgradeCtaSources: [],
    journeyFunnel: {
      variantSelected: 0,
      levelSelected: 0,
      topicOpened: 0,
      nextActionClicked: 0,
      reviewCtaClicked: 0,
      checkpointRecoveryClicked: 0,
      recommendedModeOpened: 0,
      topicOpenRateFromVariant: 0,
      nextActionRateFromTopicOpen: 0,
      reviewRateFromTopicOpen: 0,
    },
    reminderFunnel: {
      scheduled: 0,
      tapped: 0,
      destinationOpened: 0,
      tapRateFromScheduled: 0,
      openRateFromTap: 0,
      destinationBreakdown: [],
    },
    audience: {
      onboardingFunnel: {
        started: 0,
        step1Completed: 0,
        step2Completed: 0,
        step3Completed: 0,
        finished: 0,
        abandoned: 0,
        levelTestStarted: 0,
        levelTestCompleted: 0,
        step1Rate: 0,
        step2Rate: 0,
        step3Rate: 0,
        finishRate: 0,
        levelTestCompleteRate: 0,
      },
      weeklyActivity: {
        activeUsersLast7Days: 0,
        usersOver5Min: 0,
        usersOver10Min: 0,
        usersOver30Min: 0,
        usersOver60Min: 0,
        activationRate10MinPct: 0,
        medianMinutes: 0,
        avgMinutesLast7Days: 0,
        distribution: [],
      },
    },
  };
}

function parseDays(raw: string | null): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 30;
  return Math.min(180, Math.max(1, Math.floor(parsed)));
}

function parseDate(raw: string | null): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getSavedStoryFilter(storySlug: string | null, storyIdsForFilter: string[]) {
  if (!storySlug) return {};
  if (storyIdsForFilter.length === 0) {
    return { storyId: "__no_matching_story__" };
  }
  return { storyId: { in: storyIdsForFilter } };
}

function toNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getProgressValue(row: ProgressRow): number {
  const direct = toNumber(row.value);
  if (direct !== null) return direct;

  if (!row.metadata || typeof row.metadata !== "object") return 0;
  const metadata = row.metadata as Record<string, unknown>;
  return toNumber(metadata.progressSec) ?? 0;
}

async function resolveStoryIdsForSlug(slug: string): Promise<string[]> {
  const localIds = Object.values(books)
    .flatMap((book) => book.stories)
    .filter((story) => story.slug === slug)
    .map((story) => story.id);

  const [polyglotStories, standaloneStories] = await Promise.all([
    prisma.userStory.findMany({
      where: { slug },
      select: { id: true },
      take: 20,
    }),
    getStandaloneStoriesBySlugs([slug]),
  ]);

  return Array.from(
    new Set([
      ...localIds,
      ...polyglotStories.map((story) => story.id),
      ...standaloneStories.map((story) => story.id),
    ])
  );
}

/**
 * For every story slug, returns its canonical language code (es / it / de /
 * fr / pt / en). Looks in the local catalog first (Book.language inherits
 * to its stories), then UserStory.language, then StandaloneStory.language.
 * Slugs that can't be resolved get `null` (no language chip rendered).
 */
async function resolveStoryLanguageMap(
  storySlugs: string[]
): Promise<Map<string, string>> {
  if (storySlugs.length === 0) return new Map();

  const slugSet = new Set(storySlugs);
  const out = new Map<string, string>();

  // 1) Local catalog. Each Book has a language; every story inside
  // inherits that language for display purposes.
  for (const book of Object.values(books)) {
    const lang = (book as { language?: string }).language;
    if (!lang) continue;
    for (const story of book.stories) {
      if (slugSet.has(story.slug)) {
        out.set(story.slug, normalizeLanguageCode(lang));
      }
    }
  }

  // 2) UserStory + StandaloneStory for whatever still isn't resolved.
  const unresolved = storySlugs.filter((s) => !out.has(s));
  if (unresolved.length === 0) return out;

  const [userStories, standaloneStories] = await Promise.all([
    prisma.userStory.findMany({
      where: { slug: { in: unresolved } },
      select: { slug: true, language: true },
    }),
    getStandaloneStoriesBySlugs(unresolved),
  ]);

  for (const s of userStories) {
    if (s.language) out.set(s.slug, normalizeLanguageCode(s.language));
  }
  for (const s of standaloneStories) {
    const lang = (s as { language?: string | null }).language;
    if (lang && !out.has(s.slug)) out.set(s.slug, normalizeLanguageCode(lang));
  }
  return out;
}

/**
 * Map raw `LibraryBook.bookId` -> human title. Three strategies in order:
 *   1) Exact match against CatalogBook.id (post-cutover schema where
 *      stored bookIds match catalog ids).
 *   2) Fuzzy match against CatalogBook.slug for legacy DP-* SKUs
 *      (Stripe-style product codes that contain the catalog slug
 *      uppercased + a trailing variant suffix).
 *   3) LibraryBook.title (often equals the SKU, but harmless fallback).
 *   4) Humanise the SKU directly (strip DP-, drop trailing --XXX suffix
 *      blocks, lowercase, replace dashes with spaces, title-case) so the
 *      dashboard at least reads as English rather than as a raw code.
 */
async function resolveBookTitleMap(
  bookIds: string[]
): Promise<Map<string, string>> {
  if (bookIds.length === 0) return new Map();
  const [exactCatalog, libraryRows, allCatalog] = await Promise.all([
    prisma.catalogBook.findMany({
      where: { id: { in: bookIds } },
      select: { id: true, title: true },
    }),
    prisma.libraryBook.findMany({
      where: { bookId: { in: bookIds } },
      select: { bookId: true, title: true },
      distinct: ["bookId"],
    }),
    prisma.catalogBook.findMany({
      select: { slug: true, title: true },
    }),
  ]);
  const exactById = new Map(exactCatalog.map((r) => [r.id, r.title]));
  const libraryTitle = new Map(libraryRows.map((r) => [r.bookId, r.title]));
  const out = new Map<string, string>();

  for (const id of bookIds) {
    const exact = exactById.get(id);
    if (exact) {
      out.set(id, exact);
      continue;
    }
    const fuzzy = matchCatalogByLegacySku(id, allCatalog);
    if (fuzzy) {
      out.set(id, fuzzy);
      continue;
    }
    const fromLibrary = libraryTitle.get(id);
    if (fromLibrary && fromLibrary !== id) {
      out.set(id, fromLibrary);
      continue;
    }
    out.set(id, humaniseSku(id));
  }
  return out;
}

/** Strip Shopify-style "DP-" prefix + trailing variant codes, then look up
 *  a CatalogBook whose slug contains ALL of the cleaned SKU's tokens
 *  (in any order, but every token must appear). This avoids the trap where
 *  "short-stories-in" wrongly matches `short-stories-in-argentinian-...`
 *  for a Puerto Rican SKU. */
function matchCatalogByLegacySku(
  bookId: string,
  catalog: Array<{ slug: string; title: string }>
): string | null {
  // Stripe-style codes follow `DP-<NAME>--<VARIANT>`. Split on `--` and
  // keep only the name half; strip trailing dashes; normalise to lower.
  const lower = bookId.toLowerCase().replace(/^dp-/, "");
  const beforeVariant = lower.split("--")[0];
  const cleaned = beforeVariant.replace(/-+$/, "");
  if (!cleaned) return null;
  // Solo match estricto: el catalog slug debe empezar literalmente con el
  // SKU limpio. Probamos también dropping trailing tokens (1 a la vez)
  // para tolerar truncations, PERO solo si la cola del SKU NO contenía
  // tokens "distintivos" como gentilicios; esos sí deberían disqualify.
  // Definimos distintivos por longitud: cualquier token >= 6 chars
  // (puerto, rican, colombian, argentinian, etc.) es load-bearing.
  const tokens = cleaned.split("-").filter(Boolean);
  for (let take = tokens.length; take >= 3; take -= 1) {
    const droppedTail = tokens.slice(take);
    const hasDistinctiveDropped = droppedTail.some((t) => t.length >= 6);
    if (hasDistinctiveDropped) break;
    const prefix = tokens.slice(0, take).join("-");
    const match = catalog.find((c) =>
      c.slug.toLowerCase().startsWith(prefix)
    );
    if (match) return match.title;
  }
  return null;
}

function humaniseSku(value: string): string {
  return value
    .replace(/^DP-/i, "")
    .replace(/-+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Normalises whatever language string the catalog stores ("spanish",
 * "italiano", "Deutsch", "de-DE"…) into the 2-letter code the client
 * components expect for the LangTag chip.
 */
function normalizeLanguageCode(value: string): string {
  const v = value.trim().toLowerCase();
  if (v.startsWith("es") || v === "spanish" || v === "castellano") return "es";
  if (v.startsWith("it") || v === "italian" || v === "italiano") return "it";
  if (v.startsWith("de") || v === "german" || v === "deutsch") return "de";
  if (v.startsWith("fr") || v === "french" || v.startsWith("français")) return "fr";
  if (v.startsWith("pt") || v === "portuguese" || v === "português") return "pt";
  if (v.startsWith("en") || v === "english") return "en";
  return v.slice(0, 2);
}

async function resolveStorySlugMap(storyIds: string[]): Promise<Map<string, string>> {
  const localEntries = Object.values(books)
    .flatMap((book) => book.stories)
    .filter((story) => storyIds.includes(story.id))
    .map((story) => [story.id, story.slug] as const);

  const localIdSet = new Set(localEntries.map(([storyId]) => storyId));
  const unresolvedIds = storyIds.filter((id) => !localIdSet.has(id));
  const [polyglotStories, standaloneStories] = await Promise.all([
    unresolvedIds.length
      ? prisma.userStory.findMany({
          where: { id: { in: unresolvedIds } },
          select: { id: true, slug: true },
        })
      : Promise.resolve([]),
    getStandaloneStoriesByIds(unresolvedIds),
  ]);

  return new Map([
    ...localEntries,
    ...polyglotStories.map((story) => [story.id, story.slug] as const),
    ...standaloneStories.map((story) => [story.id, story.slug] as const),
  ]);
}

export async function GET(req: NextRequest): Promise<Response> {
  const { userId } = getAuth(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await isMetricsAccessAllowed(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const search = req.nextUrl.searchParams;
  const section = parseSection(search.get("section"));
  const days = parseDays(search.get("days"));
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const from = parseDate(search.get("from")) ?? defaultFrom;
  const to = parseDate(search.get("to")) ?? now;
  const storySlug = search.get("storySlug")?.trim() || null;
  const bookSlug = search.get("bookSlug")?.trim() || null;
  const storyIdsForFilter = storySlug ? await resolveStoryIdsForSlug(storySlug) : [];
  const savedStoryFilter = getSavedStoryFilter(storySlug, storyIdsForFilter);
  // Exclude internal traffic (the user + studio team) from every count
  // so the dashboard reflects external users only. Studio members are
  // looked up via Clerk by their team email and cached for 5 minutes.
  const internalIds = await getInternalUserIds();
  const excludeInternal =
    internalIds.length > 0 ? { userId: { notIn: internalIds } } : {};
  const cacheKey = JSON.stringify({
    userId,
    section,
    days,
    from: from.toISOString(),
    to: to.toISOString(),
    storySlug,
    bookSlug,
    storyIdsForFilter,
  });
  const cached = metricsDashboardCache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < METRICS_DASHBOARD_CACHE_TTL_MS) {
    return NextResponse.json(cached.payload);
  }

  const needsOverviewData = section === "overview";
  const needsEngagementData = section === "engagement";
  const needsAcquisitionData = section === "acquisition";
  const needsFunnelsData = section === "funnels";
  const needsAudienceData = section === "audience";
  const needsEventData = needsOverviewData || needsEngagementData;
  const needsProgressData = needsOverviewData;
  const needsActiveUsersData = needsOverviewData;
  const needsSavedCountsData = needsOverviewData || needsEngagementData;
  const needsCheckoutData = needsAcquisitionData || needsFunnelsData;
  const needsJourneyFunnelData = needsFunnelsData;
  const needsReminderFunnelData = needsFunnelsData;
  const needsTrialData = needsFunnelsData;
  const needsSignupData = needsOverviewData || needsAcquisitionData;

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Audience uses a fixed 7-day window for the "active users / 10 min per
  // week" computation, independent of the dashboard `days` filter. The
  // onboarding funnel still respects the user's date range so editorial
  // can see how recent cohorts compare against earlier ones.
  const last7DaysStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Period-over-period window: same length as current range, shifted
  // back by `days`. So if current is [from..to] (30 days), prev is
  // [from - 30d .. from]. The endpoint computes a coarse comparable
  // KPI set so the Resumen view can render deltas on every hero card.
  const periodMs = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime());
  const prevFrom = new Date(from.getTime() - periodMs);
  const needsPrevData = needsOverviewData;

  const [
    events,
    dauRows,
    wauRows,
    progressRows,
    activeUsersRows,
    savedStoryRows,
    savedBookRows,
    savedStoriesTotal,
    savedBooksTotal,
    trialFunnelRows,
    recentTrialStartRows,
    recentReminderTapRows,
    recentReminderOpenRows,
    checkoutFunnelRows,
    upgradeCtaRows,
    journeyFunnelRows,
    reminderFunnelRows,
    reminderDestinationRows,
    signupTotalCount,
    signupLast7dCount,
    signupLast30dCount,
    recentSignupRows,
    onboardingFunnelRows,
    weeklyProgressRows,
    prevEvents,
    prevProgressRows,
    prevActiveUsersRows,
    prevSavedStoriesTotal,
    prevSavedBooksTotal,
  ] =
    await Promise.all([
    needsEventData ? prisma.userMetric.findMany({
      where: {
        ...excludeInternal,
        createdAt: { gte: from, lte: to },
        eventType: { in: ["audio_play", "audio_complete"] },
        ...(storySlug ? { storySlug } : {}),
        ...(bookSlug ? { bookSlug } : {}),
      },
      select: {
        userId: true,
        bookSlug: true,
        storySlug: true,
        eventType: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
      take: 20000,
    }) : Promise.resolve([]),
    needsOverviewData ? prisma.userMetric.findMany({
      where: {
        ...excludeInternal,
        createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000), lte: now },
        ...(storySlug ? { storySlug } : {}),
        ...(bookSlug ? { bookSlug } : {}),
      },
      distinct: ["userId"],
      select: { userId: true },
    }) : Promise.resolve([]),
    needsOverviewData ? prisma.userMetric.findMany({
      where: {
        ...excludeInternal,
        createdAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), lte: now },
        ...(storySlug ? { storySlug } : {}),
        ...(bookSlug ? { bookSlug } : {}),
      },
      distinct: ["userId"],
      select: { userId: true },
    }) : Promise.resolve([]),
    needsProgressData ? prisma.userMetric.findMany({
      where: {
        ...excludeInternal,
        createdAt: { gte: from, lte: to },
        eventType: { in: ["audio_pause", "audio_complete", "continue_listening"] },
        ...(storySlug ? { storySlug } : {}),
        ...(bookSlug ? { bookSlug } : {}),
      },
      select: {
        userId: true,
        storySlug: true,
        value: true,
        metadata: true,
      },
      orderBy: { createdAt: "asc" },
      take: 50000,
    }) : Promise.resolve([]),
    needsActiveUsersData ? prisma.userMetric.findMany({
      where: {
        ...excludeInternal,
        createdAt: { gte: from, lte: to },
        ...(storySlug ? { storySlug } : {}),
        ...(bookSlug ? { bookSlug } : {}),
      },
      distinct: ["userId"],
      select: { userId: true },
    }) : Promise.resolve([]),
    needsSavedCountsData ? prisma.libraryStory.groupBy({
      by: ["storyId"],
      where: {
        ...excludeInternal,
        createdAt: { gte: from, lte: to },
        ...savedStoryFilter,
        ...(bookSlug ? { bookId: bookSlug } : {}),
      },
      _count: { _all: true },
      orderBy: { _count: { storyId: "desc" } },
      take: 20,
    }) : Promise.resolve([]),
    needsSavedCountsData ? prisma.libraryBook.groupBy({
      by: ["bookId"],
      where: {
        ...excludeInternal,
        createdAt: { gte: from, lte: to },
        ...(bookSlug ? { bookId: bookSlug } : {}),
      },
      _count: { _all: true },
      orderBy: { _count: { bookId: "desc" } },
      take: 20,
    }) : Promise.resolve([]),
    needsOverviewData ? prisma.libraryStory.count({
      where: {
        ...excludeInternal,
        createdAt: { gte: from, lte: to },
        ...savedStoryFilter,
        ...(bookSlug ? { bookId: bookSlug } : {}),
      },
    }) : Promise.resolve(0),
    needsOverviewData ? prisma.libraryBook.count({
      where: {
        ...excludeInternal,
        createdAt: { gte: from, lte: to },
        ...(bookSlug ? { bookId: bookSlug } : {}),
      },
    }) : Promise.resolve(0),
    needsTrialData ? prisma.userMetric.groupBy({
      by: ["eventType"],
      where: {
        ...excludeInternal,
        createdAt: { gte: from, lte: to },
        storySlug: "__plans__",
        bookSlug: "billing",
        eventType: {
          in: [
            "trial_started",
            "trial_started_with_pm",
            "trial_day_1_active",
            "trial_converted",
            "trial_canceled",
          ],
        },
      },
      _count: { _all: true },
    }) : Promise.resolve([]),
    needsTrialData ? prisma.userMetric.findMany({
      where: {
        ...excludeInternal,
        createdAt: { gte: from, lte: to },
        storySlug: "__plans__",
        bookSlug: "billing",
        eventType: { in: ["trial_started", "trial_started_with_pm"] },
      },
      select: {
        userId: true,
        eventType: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: RECENT_TRIAL_STARTS_LIMIT,
    }) : Promise.resolve([]),
    needsReminderFunnelData ? prisma.userMetric.findMany({
      where: {
        ...excludeInternal,
        createdAt: { gte: from, lte: to },
        storySlug: "daily-loop",
        bookSlug: "mobile",
        eventType: "reminder_tapped",
      },
      select: {
        userId: true,
        eventType: true,
        createdAt: true,
        metadata: true,
      },
      orderBy: { createdAt: "desc" },
      take: RECENT_REMINDER_TAPS_LIMIT,
    }) : Promise.resolve([]),
    needsReminderFunnelData ? prisma.userMetric.findMany({
      where: {
        ...excludeInternal,
        createdAt: { gte: from, lte: to },
        storySlug: "daily-loop",
        bookSlug: "mobile",
        eventType: "reminder_destination_opened",
      },
      select: {
        userId: true,
        eventType: true,
        createdAt: true,
        metadata: true,
      },
      orderBy: { createdAt: "desc" },
      take: RECENT_REMINDER_OPENS_LIMIT,
    }) : Promise.resolve([]),
    needsCheckoutData ? prisma.userMetric.groupBy({
      by: ["eventType"],
      where: {
        ...excludeInternal,
        createdAt: { gte: from, lte: to },
        storySlug: "__plans__",
        bookSlug: "billing",
        eventType: {
          in: ["plans_viewed", "checkout_started", "checkout_redirected", "checkout_failed"],
        },
      },
      _count: { _all: true },
    }) : Promise.resolve([]),
    needsFunnelsData ? prisma.userMetric.groupBy({
      by: ["storySlug"],
      where: {
        ...excludeInternal,
        createdAt: { gte: from, lte: to },
        eventType: "upgrade_cta_clicked",
        storySlug: { startsWith: "__upgrade_" },
      },
      _count: { _all: true },
    }) : Promise.resolve([]),
    needsJourneyFunnelData ? prisma.userMetric.groupBy({
      by: ["eventType"],
      where: {
        ...excludeInternal,
        createdAt: { gte: from, lte: to },
        bookSlug: "journey",
        eventType: {
          in: [
            "journey_variant_selected",
            "journey_level_selected",
            "journey_topic_opened",
            "journey_next_action_clicked",
            "journey_review_cta_clicked",
            "checkpoint_recovery_clicked",
            "practice_recommended_mode_opened",
          ],
        },
      },
      _count: { _all: true },
    }) : Promise.resolve([]),
    needsReminderFunnelData ? prisma.userMetric.groupBy({
      by: ["eventType"],
      where: {
        ...excludeInternal,
        createdAt: { gte: from, lte: to },
        storySlug: "daily-loop",
        bookSlug: "mobile",
        eventType: {
          in: ["reminder_scheduled", "reminder_tapped", "reminder_destination_opened"],
        },
      },
      _count: { _all: true },
    }) : Promise.resolve([]),
    needsReminderFunnelData ? prisma.userMetric.findMany({
      where: {
        ...excludeInternal,
        createdAt: { gte: from, lte: to },
        storySlug: "daily-loop",
        bookSlug: "mobile",
        eventType: "reminder_destination_opened",
      },
      select: {
        metadata: true,
      },
      take: 5000,
    }) : Promise.resolve([]),
    // Signup totals + rolling windows + recent signups list.
    needsSignupData
      ? prisma.userMetric.count({
          where: { ...excludeInternal, eventType: "signup_completed" },
        })
      : Promise.resolve(0),
    needsSignupData
      ? prisma.userMetric.count({
          where: {
            ...excludeInternal,
            eventType: "signup_completed",
            createdAt: { gte: sevenDaysAgo },
          },
        })
      : Promise.resolve(0),
    needsSignupData
      ? prisma.userMetric.count({
          where: {
            ...excludeInternal,
            eventType: "signup_completed",
            createdAt: { gte: thirtyDaysAgo },
          },
        })
      : Promise.resolve(0),
    needsSignupData
      ? prisma.userMetric.findMany({
          where: { ...excludeInternal, eventType: "signup_completed" },
          select: { userId: true, createdAt: true, metadata: true },
          orderBy: { createdAt: "desc" },
          take: 25,
        })
      : Promise.resolve([]),
    // Onboarding funnel raw rows. Volume is low (one row per user per
    // event), so we fetch and bucket in memory to get the per-step
    // breakdown from metadata.step that a single groupBy can't express.
    needsAudienceData ? prisma.userMetric.findMany({
      where: {
        ...excludeInternal,
        createdAt: { gte: from, lte: to },
        storySlug: "onboarding",
        eventType: {
          in: [
            "onboarding_started",
            "onboarding_step_completed",
            "onboarding_finished",
            "onboarding_abandoned",
            "onboarding_level_test_started",
            "onboarding_level_test_completed",
          ],
        },
      },
      select: {
        eventType: true,
        metadata: true,
      },
      take: 10000,
    }) : Promise.resolve([]),
    // Weekly activity: progress rows over the last 7 days. We compute
    // listened seconds per user (max per user+story to avoid double-counting
    // pause/continue) and bucket users by minutes/week.
    needsAudienceData ? prisma.userMetric.findMany({
      where: {
        ...excludeInternal,
        createdAt: { gte: last7DaysStart, lte: now },
        eventType: { in: ["audio_pause", "audio_complete", "continue_listening"] },
      },
      select: {
        userId: true,
        storySlug: true,
        value: true,
        metadata: true,
      },
      take: 50000,
    }) : Promise.resolve([]),
    // ── Period-over-period: same shape as `events` but for the
    // previous window. Used to derive `prevKpis` for deltas.
    needsPrevData ? prisma.userMetric.findMany({
      where: {
        ...excludeInternal,
        createdAt: { gte: prevFrom, lt: prevTo },
        eventType: { in: ["audio_play", "audio_complete"] },
        ...(storySlug ? { storySlug } : {}),
        ...(bookSlug ? { bookSlug } : {}),
      },
      select: {
        userId: true,
        bookSlug: true,
        storySlug: true,
        eventType: true,
        createdAt: true,
      },
      take: 20000,
    }) : Promise.resolve([]),
    needsPrevData ? prisma.userMetric.findMany({
      where: {
        ...excludeInternal,
        createdAt: { gte: prevFrom, lt: prevTo },
        eventType: { in: ["audio_pause", "audio_complete", "continue_listening"] },
        ...(storySlug ? { storySlug } : {}),
        ...(bookSlug ? { bookSlug } : {}),
      },
      select: {
        userId: true,
        storySlug: true,
        value: true,
        metadata: true,
      },
      take: 50000,
    }) : Promise.resolve([]),
    needsPrevData ? prisma.userMetric.findMany({
      where: {
        ...excludeInternal,
        createdAt: { gte: prevFrom, lt: prevTo },
        ...(storySlug ? { storySlug } : {}),
        ...(bookSlug ? { bookSlug } : {}),
      },
      distinct: ["userId"],
      select: { userId: true },
    }) : Promise.resolve([]),
    needsPrevData ? prisma.libraryStory.count({
      where: {
        ...excludeInternal,
        createdAt: { gte: prevFrom, lt: prevTo },
        ...savedStoryFilter,
        ...(bookSlug ? { bookId: bookSlug } : {}),
      },
    }) : Promise.resolve(0),
    needsPrevData ? prisma.libraryBook.count({
      where: {
        ...excludeInternal,
        createdAt: { gte: prevFrom, lt: prevTo },
        ...(bookSlug ? { bookId: bookSlug } : {}),
      },
    }) : Promise.resolve(0),
    ]);

  const plays = events.filter((e) => e.eventType === "audio_play").length;
  const completions = events.filter((e) => e.eventType === "audio_complete").length;
  const completionRate = plays > 0 ? Math.round((completions / plays) * 100) : 0;

  const byDay = new Map<string, { plays: number; completions: number }>();
  const byStory = new Map<string, { plays: number; completions: number }>();
  const byBook = new Map<string, { plays: number; completions: number }>();
  const byUserStoryMaxSeconds = new Map<string, number>();
  const byStorySeconds = new Map<string, number>();
  const byStoryListeners = new Map<string, Set<string>>();

  for (const row of events as EventRow[]) {
    const dayKey = toDayKey(row.createdAt);
    const day = byDay.get(dayKey) ?? { plays: 0, completions: 0 };
    const story = byStory.get(row.storySlug) ?? { plays: 0, completions: 0 };

    if (row.eventType === "audio_play") {
      day.plays += 1;
      story.plays += 1;
      if (row.bookSlug) {
        const book = byBook.get(row.bookSlug) ?? { plays: 0, completions: 0 };
        book.plays += 1;
        byBook.set(row.bookSlug, book);
      }
    } else if (row.eventType === "audio_complete") {
      day.completions += 1;
      story.completions += 1;
      if (row.bookSlug) {
        const book = byBook.get(row.bookSlug) ?? { plays: 0, completions: 0 };
        book.completions += 1;
        byBook.set(row.bookSlug, book);
      }
    }

    byDay.set(dayKey, day);
    byStory.set(row.storySlug, story);
  }

  // Aggregate listened seconds by taking max progress per user+story in range
  // to avoid over-counting repeated pause/continue events.
  for (const row of progressRows as ProgressRow[]) {
    const value = getProgressValue(row);
    if (!Number.isFinite(value) || value <= 0) continue;
    const key = `${row.userId}::${row.storySlug}`;
    const prev = byUserStoryMaxSeconds.get(key) ?? 0;
    if (value > prev) {
      byUserStoryMaxSeconds.set(key, value);
    }
  }

  for (const [key, seconds] of byUserStoryMaxSeconds.entries()) {
    const [uid, slug] = key.split("::");
    byStorySeconds.set(slug, (byStorySeconds.get(slug) ?? 0) + seconds);
    const listeners = byStoryListeners.get(slug) ?? new Set<string>();
    listeners.add(uid);
    byStoryListeners.set(slug, listeners);
  }

  const totalListenedSeconds = Array.from(byUserStoryMaxSeconds.values()).reduce(
    (sum, seconds) => sum + seconds,
    0
  );
  const totalListenedMinutes = Math.round((totalListenedSeconds / 60) * 10) / 10;
  const activeUsersInRange = activeUsersRows.length;
  const avgMinutesPerActiveUser =
    activeUsersInRange > 0
      ? Math.round(((totalListenedSeconds / activeUsersInRange) / 60) * 10) / 10
      : 0;

  const daily = Array.from(byDay.entries())
    .map(([date, v]) => ({
      date,
      plays: v.plays,
      completions: v.completions,
      completionRate: v.plays > 0 ? Math.round((v.completions / v.plays) * 100) : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const topStories = Array.from(byStory.entries())
    .map(([slug, v]) => ({
      storySlug: slug,
      plays: v.plays,
      completions: v.completions,
      completionRate: v.plays > 0 ? Math.round((v.completions / v.plays) * 100) : 0,
    }))
    .sort((a, b) => b.plays - a.plays)
    .slice(0, 10);

  const topBooks = Array.from(byBook.entries())
    .map(([slug, v]) => ({
      bookSlug: slug,
      plays: v.plays,
      completions: v.completions,
      completionRate: v.plays > 0 ? Math.round((v.completions / v.plays) * 100) : 0,
    }))
    .sort((a, b) => b.plays - a.plays)
    .slice(0, 10);

  const topStoriesByMinutesPre = Array.from(byStorySeconds.entries())
    .map(([storySlugValue, listenedSeconds]) => ({
      storySlug: storySlugValue,
      listenedMinutes: Math.round((listenedSeconds / 60) * 10) / 10,
      listeners: byStoryListeners.get(storySlugValue)?.size ?? 0,
    }))
    .sort((a, b) => b.listenedMinutes - a.listenedMinutes)
    .slice(0, 10);
  const storyLanguageMap =
    topStoriesByMinutesPre.length > 0
      ? await resolveStoryLanguageMap(topStoriesByMinutesPre.map((s) => s.storySlug))
      : new Map<string, string>();
  const topStoriesByMinutes = topStoriesByMinutesPre.map((s) => ({
    ...s,
    language: storyLanguageMap.get(s.storySlug) ?? null,
  }));

  const savedStorySlugMap = needsSavedCountsData
    ? await resolveStorySlugMap((savedStoryRows as SavedStoryRow[]).map((row) => row.storyId))
    : new Map<string, string>();
  const topSavedStories = (savedStoryRows as SavedStoryRow[])
    .map((row) => ({
      storySlug: savedStorySlugMap.get(row.storyId) ?? row.storyId,
      saves: row._count._all,
    }))
    .slice(0, 10);

  // Resolve raw bookIds (Stripe-style product codes) to display titles
  // pulled from LibraryBook.title so the dashboard shows "Colombian
  // Spanish Stories for Beginners" instead of "DP-COLOMBIAN-...".
  const bookTitleMap = needsSavedCountsData
    ? await resolveBookTitleMap((savedBookRows as SavedBookRow[]).map((row) => row.bookId))
    : new Map<string, string>();
  const topSavedBooks = (savedBookRows as SavedBookRow[])
    .map((row) => ({
      bookSlug: bookTitleMap.get(row.bookId) ?? row.bookId,
      saves: row._count._all,
    }))
    .slice(0, 10);

  const savedStories = savedStoriesTotal;
  const savedBooks = savedBooksTotal;

  const trialCounts = {
    started: 0,
    startedWithPm: 0,
    day1Active: 0,
    converted: 0,
    canceled: 0,
  };
  for (const row of trialFunnelRows as Array<{ eventType: string; _count: { _all: number } }>) {
    if (row.eventType === "trial_started") trialCounts.started = row._count._all;
    if (row.eventType === "trial_started_with_pm") trialCounts.startedWithPm = row._count._all;
    if (row.eventType === "trial_day_1_active") trialCounts.day1Active = row._count._all;
    if (row.eventType === "trial_converted") trialCounts.converted = row._count._all;
    if (row.eventType === "trial_canceled") trialCounts.canceled = row._count._all;
  }
  const conversionRate =
    trialCounts.started > 0 ? Math.round((trialCounts.converted / trialCounts.started) * 100) : 0;
  const day1ActivationRate =
    trialCounts.started > 0 ? Math.round((trialCounts.day1Active / trialCounts.started) * 100) : 0;
  const cancelRate =
    trialCounts.started > 0 ? Math.round((trialCounts.canceled / trialCounts.started) * 100) : 0;
  const trialStartUserEmails = needsTrialData
    ? await resolveUserEmails((recentTrialStartRows as TrialStartRow[]).map((row) => row.userId))
    : new Map<string, string | null>();
  const recentTrialStarts = (recentTrialStartRows as TrialStartRow[]).map((row) => ({
    userId: row.userId,
    email: trialStartUserEmails.get(row.userId) ?? null,
    eventType: row.eventType,
    createdAt: row.createdAt.toISOString(),
  }));

  type SignupRow = {
    userId: string;
    createdAt: Date;
    metadata: unknown;
  };
  const signupRows = recentSignupRows as SignupRow[];
  const signupEmails = needsSignupData
    ? await resolveUserEmails(signupRows.map((row) => row.userId))
    : new Map<string, string | null>();
  const recentSignups = signupRows.map((row) => {
    const meta =
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : null;
    const metaEmail = typeof meta?.email === "string" ? meta.email : null;
    return {
      userId: row.userId,
      email: signupEmails.get(row.userId) ?? metaEmail,
      createdAt: row.createdAt.toISOString(),
    };
  });
  const reminderTapUserEmails = needsReminderFunnelData
    ? await resolveUserEmails((recentReminderTapRows as ReminderTapRow[]).map((row) => row.userId))
    : new Map<string, string | null>();
  const recentReminderTaps = (recentReminderTapRows as ReminderTapRow[]).map((row) => {
    const metadata =
      row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : null;
    return {
      userId: row.userId,
      email: reminderTapUserEmails.get(row.userId) ?? null,
      eventType: row.eventType,
      destination: typeof metadata?.targetKind === "string" ? metadata.targetKind : null,
      source: typeof metadata?.source === "string" ? metadata.source : null,
      createdAt: row.createdAt.toISOString(),
    };
  });
  const reminderOpenUserEmails = needsReminderFunnelData
    ? await resolveUserEmails((recentReminderOpenRows as ReminderTapRow[]).map((row) => row.userId))
    : new Map<string, string | null>();
  const recentReminderOpens = (recentReminderOpenRows as ReminderTapRow[]).map((row) => {
    const metadata =
      row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : null;
    return {
      userId: row.userId,
      email: reminderOpenUserEmails.get(row.userId) ?? null,
      eventType: row.eventType,
      destination: typeof metadata?.targetKind === "string" ? metadata.targetKind : null,
      createdAt: row.createdAt.toISOString(),
    };
  });

  const checkoutCounts = {
    plansViewed: 0,
    checkoutStarted: 0,
    checkoutRedirected: 0,
    checkoutFailed: 0,
  };
  for (const row of checkoutFunnelRows as Array<{ eventType: string; _count: { _all: number } }>) {
    if (row.eventType === "plans_viewed") checkoutCounts.plansViewed = row._count._all;
    if (row.eventType === "checkout_started") checkoutCounts.checkoutStarted = row._count._all;
    if (row.eventType === "checkout_redirected") checkoutCounts.checkoutRedirected = row._count._all;
    if (row.eventType === "checkout_failed") checkoutCounts.checkoutFailed = row._count._all;
  }
  const checkoutStartRate =
    checkoutCounts.plansViewed > 0
      ? Math.round((checkoutCounts.checkoutStarted / checkoutCounts.plansViewed) * 100)
      : 0;
  const checkoutRedirectRate =
    checkoutCounts.checkoutStarted > 0
      ? Math.round((checkoutCounts.checkoutRedirected / checkoutCounts.checkoutStarted) * 100)
      : 0;

  const upgradeCtaSources = (
    upgradeCtaRows as Array<{ storySlug: string; _count: { _all: number } }>
  )
    .map((row) => ({
      source: row.storySlug.replace("__upgrade_", "").replace(/__$/, ""),
      clicks: row._count._all,
    }))
    .sort((a, b) => b.clicks - a.clicks);

  const journeyCounts = {
    variantSelected: 0,
    levelSelected: 0,
    topicOpened: 0,
    nextActionClicked: 0,
    reviewCtaClicked: 0,
    checkpointRecoveryClicked: 0,
    recommendedModeOpened: 0,
  };
  for (const row of journeyFunnelRows as Array<{ eventType: string; _count: { _all: number } }>) {
    if (row.eventType === "journey_variant_selected") journeyCounts.variantSelected = row._count._all;
    if (row.eventType === "journey_level_selected") journeyCounts.levelSelected = row._count._all;
    if (row.eventType === "journey_topic_opened") journeyCounts.topicOpened = row._count._all;
    if (row.eventType === "journey_next_action_clicked") journeyCounts.nextActionClicked = row._count._all;
    if (row.eventType === "journey_review_cta_clicked") journeyCounts.reviewCtaClicked = row._count._all;
    if (row.eventType === "checkpoint_recovery_clicked") journeyCounts.checkpointRecoveryClicked = row._count._all;
    if (row.eventType === "practice_recommended_mode_opened") {
      journeyCounts.recommendedModeOpened = row._count._all;
    }
  }

  const reminderCounts = {
    scheduled: 0,
    tapped: 0,
    destinationOpened: 0,
  };
  for (const row of reminderFunnelRows as Array<{ eventType: string; _count: { _all: number } }>) {
    if (row.eventType === "reminder_scheduled") reminderCounts.scheduled = row._count._all;
    if (row.eventType === "reminder_tapped") reminderCounts.tapped = row._count._all;
    if (row.eventType === "reminder_destination_opened") reminderCounts.destinationOpened = row._count._all;
  }
  const reminderDestinationMap = new Map<string, number>();
  for (const row of reminderDestinationRows as Array<{ metadata: unknown }>) {
    if (!row.metadata || typeof row.metadata !== "object") continue;
    const metadata = row.metadata as Record<string, unknown>;
    const destination =
      typeof metadata.targetKind === "string" && metadata.targetKind.trim().length > 0
        ? metadata.targetKind.trim()
        : "unknown";
    reminderDestinationMap.set(destination, (reminderDestinationMap.get(destination) ?? 0) + 1);
  }
  const reminderDestinationBreakdown = Array.from(reminderDestinationMap.entries())
    .map(([destination, opens]) => ({ destination, opens }))
    .sort((a, b) => b.opens - a.opens || a.destination.localeCompare(b.destination));

  // ── Audience: onboarding funnel ──
  // We count each event type, then derive per-step completions by reading
  // metadata.step on `onboarding_step_completed` rows. Step 4 is implicit
  // in `onboarding_finished`, so we never look for step=4 here.
  const onboardingCounts = {
    started: 0,
    step1Completed: 0,
    step2Completed: 0,
    step3Completed: 0,
    finished: 0,
    abandoned: 0,
    levelTestStarted: 0,
    levelTestCompleted: 0,
  };
  for (const row of onboardingFunnelRows as Array<{
    eventType: string;
    metadata: unknown;
  }>) {
    switch (row.eventType) {
      case "onboarding_started":
        onboardingCounts.started += 1;
        break;
      case "onboarding_finished":
        onboardingCounts.finished += 1;
        break;
      case "onboarding_abandoned":
        onboardingCounts.abandoned += 1;
        break;
      case "onboarding_level_test_started":
        onboardingCounts.levelTestStarted += 1;
        break;
      case "onboarding_level_test_completed":
        onboardingCounts.levelTestCompleted += 1;
        break;
      case "onboarding_step_completed": {
        const meta =
          row.metadata && typeof row.metadata === "object"
            ? (row.metadata as Record<string, unknown>)
            : null;
        const step = typeof meta?.step === "number" ? meta.step : null;
        if (step === 1) onboardingCounts.step1Completed += 1;
        else if (step === 2) onboardingCounts.step2Completed += 1;
        else if (step === 3) onboardingCounts.step3Completed += 1;
        break;
      }
      default:
        break;
    }
  }
  const pct = (num: number, den: number) =>
    den > 0 ? Math.round((num / den) * 100) : 0;

  // ── Audience: weekly activity distribution ──
  // Sum max-listened-seconds per user across all stories in the last
  // 7 days, then bucket users by minutes/week. This is the "activation
  // rate" view that aggregate avgMinutesPerActiveUser can't surface.
  const byUserStoryMaxSecondsWeekly = new Map<string, number>();
  for (const row of weeklyProgressRows as ProgressRow[]) {
    const value = getProgressValue(row);
    if (!Number.isFinite(value) || value <= 0) continue;
    const key = `${row.userId}::${row.storySlug}`;
    const prev = byUserStoryMaxSecondsWeekly.get(key) ?? 0;
    if (value > prev) byUserStoryMaxSecondsWeekly.set(key, value);
  }
  const byUserSecondsWeekly = new Map<string, number>();
  for (const [key, seconds] of byUserStoryMaxSecondsWeekly.entries()) {
    const [uid] = key.split("::");
    byUserSecondsWeekly.set(uid, (byUserSecondsWeekly.get(uid) ?? 0) + seconds);
  }
  const weeklyMinutesPerUser = Array.from(byUserSecondsWeekly.values())
    .map((s) => s / 60)
    .sort((a, b) => a - b);
  const activeUsersLast7Days = weeklyMinutesPerUser.length;
  const usersOver5Min = weeklyMinutesPerUser.filter((m) => m >= 5).length;
  const usersOver10Min = weeklyMinutesPerUser.filter((m) => m >= 10).length;
  const usersOver30Min = weeklyMinutesPerUser.filter((m) => m >= 30).length;
  const usersOver60Min = weeklyMinutesPerUser.filter((m) => m >= 60).length;
  const totalWeeklyMinutes = weeklyMinutesPerUser.reduce((sum, m) => sum + m, 0);
  const avgMinutesLast7Days =
    activeUsersLast7Days > 0
      ? Math.round((totalWeeklyMinutes / activeUsersLast7Days) * 10) / 10
      : 0;
  const medianMinutes =
    activeUsersLast7Days > 0
      ? Math.round(
          weeklyMinutesPerUser[Math.floor(activeUsersLast7Days / 2)] * 10
        ) / 10
      : 0;
  // Buckets are mutually exclusive. The "5-10" bucket represents users
  // who reached at least 5 min/week but didn't hit the 10-min threshold.
  const distribution = [
    {
      bucket: "<5 min",
      users: activeUsersLast7Days - usersOver5Min,
    },
    {
      bucket: "5-10 min",
      users: usersOver5Min - usersOver10Min,
    },
    {
      bucket: "10-30 min",
      users: usersOver10Min - usersOver30Min,
    },
    {
      bucket: "30-60 min",
      users: usersOver30Min - usersOver60Min,
    },
    {
      bucket: "60+ min",
      users: usersOver60Min,
    },
  ];

  // ── Period-over-period KPIs ──
  // Build a comparable KPI set from the previous-window queries. We
  // compute the same shape as `kpis` so the client can drive deltas
  // generically. uniqueStories/uniqueBooks are derived from prev events,
  // and avg-minutes/total-minutes from prev progress rows.
  let prevKpisPayload: DashboardResponse["prevKpis"] | undefined;
  if (needsPrevData) {
    let prevPlays = 0;
    let prevCompletions = 0;
    const prevByStory = new Set<string>();
    const prevByBook = new Set<string>();
    for (const row of prevEvents as EventRow[]) {
      if (row.eventType === "audio_play") prevPlays += 1;
      else if (row.eventType === "audio_complete") prevCompletions += 1;
      prevByStory.add(row.storySlug);
      if (row.bookSlug) prevByBook.add(row.bookSlug);
    }
    const prevCompletionRate =
      prevPlays > 0 ? Math.round((prevCompletions / prevPlays) * 100) : 0;
    const prevByUserStoryMaxSeconds = new Map<string, number>();
    for (const row of prevProgressRows as ProgressRow[]) {
      const value = getProgressValue(row);
      if (!Number.isFinite(value) || value <= 0) continue;
      const key = `${row.userId}::${row.storySlug}`;
      const prev = prevByUserStoryMaxSeconds.get(key) ?? 0;
      if (value > prev) prevByUserStoryMaxSeconds.set(key, value);
    }
    const prevTotalListenedSeconds = Array.from(
      prevByUserStoryMaxSeconds.values()
    ).reduce((sum, s) => sum + s, 0);
    const prevActiveUsers = (prevActiveUsersRows as Array<{ userId: string }>).length;
    const prevTotalListenedMinutes =
      Math.round((prevTotalListenedSeconds / 60) * 10) / 10;
    const prevAvgMinutesPerActiveUser =
      prevActiveUsers > 0
        ? Math.round(((prevTotalListenedSeconds / prevActiveUsers) / 60) * 10) / 10
        : 0;
    prevKpisPayload = {
      dau: 0,
      wau: 0,
      activeUsersInRange: prevActiveUsers,
      plays: prevPlays,
      completions: prevCompletions,
      completionRate: prevCompletionRate,
      uniqueStories: prevByStory.size,
      uniqueBooks: prevByBook.size,
      avgMinutesPerActiveUser: prevAvgMinutesPerActiveUser,
      totalListenedMinutes: prevTotalListenedMinutes,
      savedStories: prevSavedStoriesTotal as number,
      savedBooks: prevSavedBooksTotal as number,
    };
  }

  const payload: DashboardResponse = {
    ...createEmptyDashboardResponse(from, to, days),
    ...(prevKpisPayload
      ? {
          prevRange: {
            from: prevFrom.toISOString(),
            to: prevTo.toISOString(),
            days,
          },
          prevKpis: prevKpisPayload,
        }
      : {}),
    kpis: {
      dau: dauRows.length,
      wau: wauRows.length,
      activeUsersInRange,
      plays,
      completions,
      completionRate,
      uniqueStories: byStory.size,
      uniqueBooks: byBook.size,
      avgMinutesPerActiveUser,
      totalListenedMinutes,
      savedStories,
      savedBooks,
    },
    daily,
    topStories,
    topBooks,
    topStoriesByMinutes,
    topSavedStories,
    topSavedBooks,
    signups: {
      total: signupTotalCount as number,
      last7d: signupLast7dCount as number,
      last30d: signupLast30dCount as number,
    },
    recentSignups,
    trialFunnel: {
      started: trialCounts.started,
      startedWithPm: trialCounts.startedWithPm,
      day1Active: trialCounts.day1Active,
      converted: trialCounts.converted,
      canceled: trialCounts.canceled,
      conversionRate,
      day1ActivationRate,
      cancelRate,
    },
    recentTrialStarts,
    recentReminderTaps,
    recentReminderOpens,
    checkoutFunnel: {
      plansViewed: checkoutCounts.plansViewed,
      checkoutStarted: checkoutCounts.checkoutStarted,
      checkoutRedirected: checkoutCounts.checkoutRedirected,
      checkoutFailed: checkoutCounts.checkoutFailed,
      checkoutStartRate,
      checkoutRedirectRate,
    },
    upgradeCtaSources,
    journeyFunnel: {
      ...journeyCounts,
      topicOpenRateFromVariant:
        journeyCounts.variantSelected > 0
          ? Math.round((journeyCounts.topicOpened / journeyCounts.variantSelected) * 100)
          : 0,
      nextActionRateFromTopicOpen:
        journeyCounts.topicOpened > 0
          ? Math.round((journeyCounts.nextActionClicked / journeyCounts.topicOpened) * 100)
          : 0,
      reviewRateFromTopicOpen:
        journeyCounts.topicOpened > 0
          ? Math.round((journeyCounts.reviewCtaClicked / journeyCounts.topicOpened) * 100)
          : 0,
    },
    reminderFunnel: {
      ...reminderCounts,
      tapRateFromScheduled:
        reminderCounts.scheduled > 0
          ? Math.round((reminderCounts.tapped / reminderCounts.scheduled) * 100)
          : 0,
      openRateFromTap:
        reminderCounts.tapped > 0
          ? Math.round((reminderCounts.destinationOpened / reminderCounts.tapped) * 100)
          : 0,
      destinationBreakdown: reminderDestinationBreakdown,
    },
    audience: {
      onboardingFunnel: {
        ...onboardingCounts,
        step1Rate: pct(onboardingCounts.step1Completed, onboardingCounts.started),
        step2Rate: pct(onboardingCounts.step2Completed, onboardingCounts.started),
        step3Rate: pct(onboardingCounts.step3Completed, onboardingCounts.started),
        finishRate: pct(onboardingCounts.finished, onboardingCounts.started),
        levelTestCompleteRate: pct(
          onboardingCounts.levelTestCompleted,
          onboardingCounts.levelTestStarted
        ),
      },
      weeklyActivity: {
        activeUsersLast7Days,
        usersOver5Min,
        usersOver10Min,
        usersOver30Min,
        usersOver60Min,
        activationRate10MinPct: pct(usersOver10Min, activeUsersLast7Days),
        medianMinutes,
        avgMinutesLast7Days,
        distribution,
      },
    },
  };

  metricsDashboardCache.set(cacheKey, {
    createdAt: Date.now(),
    payload,
  });
  return NextResponse.json(payload);
}
