export const runtime = "nodejs";

import { getAuth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type EventRow = {
  userId: string;
  bookSlug: string | null;
  storySlug: string;
  eventType: string;
  createdAt: Date;
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
    plays: number;
    completions: number;
    completionRate: number;
    uniqueStories: number;
    uniqueBooks: number;
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

export async function GET(req: NextRequest): Promise<Response> {
  const { userId } = getAuth(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const search = req.nextUrl.searchParams;
  const days = parseDays(search.get("days"));
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const from = parseDate(search.get("from")) ?? defaultFrom;
  const to = parseDate(search.get("to")) ?? now;
  const storySlug = search.get("storySlug")?.trim() || null;
  const bookSlug = search.get("bookSlug")?.trim() || null;

  const [events, dauRows, wauRows] = await Promise.all([
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
  ]);

  const plays = events.filter((e) => e.eventType === "audio_play").length;
  const completions = events.filter((e) => e.eventType === "audio_complete").length;
  const completionRate = plays > 0 ? Math.round((completions / plays) * 100) : 0;

  const byDay = new Map<string, { plays: number; completions: number }>();
  const byStory = new Map<string, { plays: number; completions: number }>();
  const byBook = new Map<string, { plays: number; completions: number }>();

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

  const payload: DashboardResponse = {
    range: {
      from: from.toISOString(),
      to: to.toISOString(),
      days,
    },
    kpis: {
      dau: dauRows.length,
      wau: wauRows.length,
      plays,
      completions,
      completionRate,
      uniqueStories: byStory.size,
      uniqueBooks: byBook.size,
    },
    daily,
    topStories,
    topBooks,
  };

  return NextResponse.json(payload);
}
