export const runtime = "nodejs";

import { getAuth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isMetricsAccessAllowed } from "@/lib/metricsAccess";
import { books } from "@/data/books";
import { getStandaloneStoriesByIds, getStandaloneStoriesBySlugs } from "@/lib/standaloneStories";

const METRICS_DASHBOARD_CACHE_TTL_MS = 60 * 1000;

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

type DashboardResponse = {
  range: {
    from: string;
    to: string;
    days: number;
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
  }>;
  topSavedStories: Array<{
    storySlug: string;
    saves: number;
  }>;
  topSavedBooks: Array<{
    bookSlug: string;
    saves: number;
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
};

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
  if (!isMetricsAccessAllowed(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const search = req.nextUrl.searchParams;
  const days = parseDays(search.get("days"));
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const from = parseDate(search.get("from")) ?? defaultFrom;
  const to = parseDate(search.get("to")) ?? now;
  const storySlug = search.get("storySlug")?.trim() || null;
  const bookSlug = search.get("bookSlug")?.trim() || null;
  const storyIdsForFilter = storySlug ? await resolveStoryIdsForSlug(storySlug) : [];
  const savedStoryFilter = getSavedStoryFilter(storySlug, storyIdsForFilter);
  const cacheKey = JSON.stringify({
    userId,
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
    checkoutFunnelRows,
    upgradeCtaRows,
    journeyFunnelRows,
  ] =
    await Promise.all([
    prisma.userMetric.findMany({
      where: {
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
    }),
    prisma.userMetric.findMany({
      where: {
        createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000), lte: now },
        ...(storySlug ? { storySlug } : {}),
        ...(bookSlug ? { bookSlug } : {}),
      },
      distinct: ["userId"],
      select: { userId: true },
    }),
    prisma.userMetric.findMany({
      where: {
        createdAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), lte: now },
        ...(storySlug ? { storySlug } : {}),
        ...(bookSlug ? { bookSlug } : {}),
      },
      distinct: ["userId"],
      select: { userId: true },
    }),
    prisma.userMetric.findMany({
      where: {
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
    }),
    prisma.userMetric.findMany({
      where: {
        createdAt: { gte: from, lte: to },
        ...(storySlug ? { storySlug } : {}),
        ...(bookSlug ? { bookSlug } : {}),
      },
      distinct: ["userId"],
      select: { userId: true },
    }),
    prisma.libraryStory.groupBy({
      by: ["storyId"],
      where: {
        createdAt: { gte: from, lte: to },
        ...savedStoryFilter,
        ...(bookSlug ? { bookId: bookSlug } : {}),
      },
      _count: { _all: true },
      orderBy: { _count: { storyId: "desc" } },
      take: 20,
    }),
    prisma.libraryBook.groupBy({
      by: ["bookId"],
      where: {
        createdAt: { gte: from, lte: to },
        ...(bookSlug ? { bookId: bookSlug } : {}),
      },
      _count: { _all: true },
      orderBy: { _count: { bookId: "desc" } },
      take: 20,
    }),
    prisma.libraryStory.count({
      where: {
        createdAt: { gte: from, lte: to },
        ...savedStoryFilter,
        ...(bookSlug ? { bookId: bookSlug } : {}),
      },
    }),
    prisma.libraryBook.count({
      where: {
        createdAt: { gte: from, lte: to },
        ...(bookSlug ? { bookId: bookSlug } : {}),
      },
    }),
    prisma.userMetric.groupBy({
      by: ["eventType"],
      where: {
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
    }),
    prisma.userMetric.groupBy({
      by: ["eventType"],
      where: {
        createdAt: { gte: from, lte: to },
        storySlug: "__plans__",
        bookSlug: "billing",
        eventType: {
          in: ["plans_viewed", "checkout_started", "checkout_redirected", "checkout_failed"],
        },
      },
      _count: { _all: true },
    }),
    prisma.userMetric.groupBy({
      by: ["storySlug"],
      where: {
        createdAt: { gte: from, lte: to },
        eventType: "upgrade_cta_clicked",
        storySlug: { startsWith: "__upgrade_" },
      },
      _count: { _all: true },
    }),
    prisma.userMetric.groupBy({
      by: ["eventType"],
      where: {
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
    }),
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

  const topStoriesByMinutes = Array.from(byStorySeconds.entries())
    .map(([storySlugValue, listenedSeconds]) => ({
      storySlug: storySlugValue,
      listenedMinutes: Math.round((listenedSeconds / 60) * 10) / 10,
      listeners: byStoryListeners.get(storySlugValue)?.size ?? 0,
    }))
    .sort((a, b) => b.listenedMinutes - a.listenedMinutes)
    .slice(0, 10);

  const savedStorySlugMap = await resolveStorySlugMap(
    (savedStoryRows as SavedStoryRow[]).map((row) => row.storyId)
  );
  const topSavedStories = (savedStoryRows as SavedStoryRow[])
    .map((row) => ({
      storySlug: savedStorySlugMap.get(row.storyId) ?? row.storyId,
      saves: row._count._all,
    }))
    .slice(0, 10);

  const topSavedBooks = (savedBookRows as SavedBookRow[])
    .map((row) => ({
      bookSlug: row.bookId,
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

  const payload: DashboardResponse = {
    range: {
      from: from.toISOString(),
      to: to.toISOString(),
      days,
    },
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
  };

  metricsDashboardCache.set(cacheKey, {
    createdAt: Date.now(),
    payload,
  });
  return NextResponse.json(payload);
}
