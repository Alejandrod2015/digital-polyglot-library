export const runtime = "nodejs";

import { getAuth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { books } from "@/data/books";

const COMPLETE_RATIO = 0.95;
const WEEKLY_GOAL_MINUTES = 60;

type ContinueMeta = {
  progressSec?: number;
  audioDurationSec?: number;
};

type MetricRow = {
  eventType: string;
  value: number | null;
  metadata: unknown;
  bookSlug: string | null;
  storySlug: string;
  createdAt: Date;
};

type ContinueRow = {
  bookSlug: string;
  storySlug: string;
  progressSec: number | null;
  audioDurationSec: number | null;
  updatedAt: Date;
};

function toNumber(x: unknown): number | undefined {
  return typeof x === "number" && Number.isFinite(x) ? x : undefined;
}

function parseContinueMeta(metadata: unknown): ContinueMeta {
  if (!metadata || typeof metadata !== "object") return {};
  const record = metadata as Record<string, unknown>;
  return {
    progressSec: toNumber(record.progressSec),
    audioDurationSec: toNumber(record.audioDurationSec),
  };
}

function isCompleted(progressSec?: number, audioDurationSec?: number): boolean {
  if (
    typeof progressSec !== "number" ||
    !Number.isFinite(progressSec) ||
    typeof audioDurationSec !== "number" ||
    !Number.isFinite(audioDurationSec) ||
    audioDurationSec <= 0
  ) {
    return false;
  }
  return progressSec >= audioDurationSec * COMPLETE_RATIO;
}

function getStartOfWeekUtc(base = new Date()): Date {
  const d = new Date(base);
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - day);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function toUtcDayKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const d = `${date.getUTCDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getStreakFromDates(activeDayKeys: Set<string>, now = new Date()): number {
  let streak = 0;
  const cursor = new Date(now);
  cursor.setUTCHours(0, 0, 0, 0);

  while (true) {
    const key = toUtcDayKey(cursor);
    if (!activeDayKeys.has(key)) break;
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

function roundMinutes(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return Math.round(seconds / 60);
}

function isMissingTableError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const maybe = err as { code?: string; message?: string };
  return (
    maybe.code === "P2021" ||
    (typeof maybe.message === "string" &&
      (maybe.message.includes("does not exist") || maybe.message.includes("doesn't exist")))
  );
}

async function safeQuery<T>(label: string, query: Promise<T>, fallback: T): Promise<T> {
  try {
    return await query;
  } catch (err) {
    if (isMissingTableError(err)) {
      console.warn(`[progress] Missing table for ${label}. Using fallback.`);
      return fallback;
    }
    console.error(`[progress] Query failed for ${label}:`, err);
    return fallback;
  }
}

function storyKey(bookSlug: string | null | undefined, storySlug: string): string {
  const b = typeof bookSlug === "string" ? bookSlug : "";
  return `${b}:${storySlug}`;
}

function clampProgress(progressSec?: number, audioDurationSec?: number): number {
  if (typeof progressSec !== "number" || !Number.isFinite(progressSec) || progressSec <= 0) return 0;
  if (
    typeof audioDurationSec === "number" &&
    Number.isFinite(audioDurationSec) &&
    audioDurationSec > 0
  ) {
    return Math.max(0, Math.min(progressSec, audioDurationSec));
  }
  return Math.max(0, progressSec);
}

function computeFromContinueRows(rows: ContinueRow[], weekStart: Date) {
  const progressByStory = new Map<string, number>();
  const completedStories = new Set<string>();
  let weeklySeconds = 0;

  for (const row of rows) {
    const key = storyKey(row.bookSlug, row.storySlug);
    const progress = clampProgress(row.progressSec ?? undefined, row.audioDurationSec ?? undefined);
    const current = progressByStory.get(key) ?? 0;
    if (progress > current) progressByStory.set(key, progress);
    if (isCompleted(row.progressSec ?? undefined, row.audioDurationSec ?? undefined)) {
      completedStories.add(key);
    }
    if (row.updatedAt >= weekStart) {
      weeklySeconds += progress;
    }
  }

  const totalSeconds = [...progressByStory.values()].reduce((sum, v) => sum + v, 0);
  return { totalSeconds, weeklySeconds, completedStories };
}

function computeFromMetrics(rows: MetricRow[], weekStart: Date) {
  const sorted = [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const lastProgress = new Map<string, number>();
  const bestProgress = new Map<string, number>();
  const completedStories = new Set<string>();
  const activeDayKeys = new Set<string>();
  let totalSeconds = 0;
  let weeklySeconds = 0;

  for (const row of sorted) {
    activeDayKeys.add(toUtcDayKey(row.createdAt));
    const key = storyKey(row.bookSlug, row.storySlug);

    let progress = 0;
    if (row.eventType === "continue_listening") {
      const meta = parseContinueMeta(row.metadata);
      progress = clampProgress(meta.progressSec, meta.audioDurationSec);
      if (isCompleted(meta.progressSec, meta.audioDurationSec)) completedStories.add(key);
    } else if (row.eventType === "audio_complete") {
      const duration = typeof row.value === "number" && Number.isFinite(row.value) ? row.value : 0;
      progress = Math.max(0, duration);
      completedStories.add(key);
    } else {
      continue;
    }

    const prev = lastProgress.get(key) ?? 0;
    const delta = Math.max(0, progress - prev);
    if (delta > 0) {
      totalSeconds += delta;
      if (row.createdAt >= weekStart) weeklySeconds += delta;
      lastProgress.set(key, progress);
    }

    const best = bestProgress.get(key) ?? 0;
    if (progress > best) bestProgress.set(key, progress);
  }

  return { totalSeconds, weeklySeconds, completedStories, activeDayKeys };
}

export async function GET(req: NextRequest): Promise<Response> {
  const { userId } = getAuth(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const weekStart = getStartOfWeekUtc();

    const [metrics, continueRows, libraryBooks, favoritesCount] = await Promise.all([
      safeQuery(
        "userMetric",
        prisma.userMetric.findMany({
          where: {
            userId,
            eventType: { in: ["audio_complete", "continue_listening", "audio_play"] },
          },
          select: {
            eventType: true,
            value: true,
            metadata: true,
            bookSlug: true,
            storySlug: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 5000,
        }),
        [] as MetricRow[]
      ),
      safeQuery(
        "continueListeningEntry",
        prisma.continueListeningEntry.findMany({
          where: { userId },
          select: {
            bookSlug: true,
            storySlug: true,
            progressSec: true,
            audioDurationSec: true,
            updatedAt: true,
          },
        }),
        [] as ContinueRow[]
      ),
      safeQuery(
        "libraryBook",
        prisma.libraryBook.findMany({
          where: { userId },
          select: { bookId: true },
        }),
        []
      ),
      safeQuery(
        "favorite",
        prisma.favorite.count({
          where: { userId },
        }),
        0
      ),
    ]);

    const hasContinueRows = continueRows.length > 0;
    const metricsComputed = computeFromMetrics(metrics, weekStart);
    const continueComputed = computeFromContinueRows(continueRows, weekStart);

    const totalListeningSec = hasContinueRows
      ? continueComputed.totalSeconds
      : metricsComputed.totalSeconds;
    const weeklyListeningSec = hasContinueRows
      ? Math.max(0, Math.min(continueComputed.weeklySeconds, continueComputed.totalSeconds))
      : metricsComputed.weeklySeconds;
    const completedStories = hasContinueRows
      ? continueComputed.completedStories
      : metricsComputed.completedStories;
    const activeDayKeys = metricsComputed.activeDayKeys;

    const bookById = new Map(Object.values(books).map((b) => [b.id, b] as const));
    let finishedBooks = 0;
    for (const lb of libraryBooks) {
      const bookMeta = bookById.get(lb.bookId);
      if (!bookMeta) continue;
      const stories = Array.isArray(bookMeta.stories) ? bookMeta.stories : [];
      if (stories.length === 0) continue;
      const allCompleted = stories.every((story) =>
        completedStories.has(`${bookMeta.slug}:${story.slug}`)
      );
      if (allCompleted) finishedBooks += 1;
    }

    const streakDays = getStreakFromDates(activeDayKeys);

    return NextResponse.json({
      minutesListened: roundMinutes(totalListeningSec),
      storiesFinished: completedStories.size,
      booksFinished: finishedBooks,
      wordsLearned: favoritesCount,
      weeklyGoalMinutes: WEEKLY_GOAL_MINUTES,
      weeklyMinutesListened: roundMinutes(weeklyListeningSec),
      streakDays,
    });
  } catch (err) {
    console.error("Error in GET /api/progress:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
