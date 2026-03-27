export const runtime = "nodejs";

import { getAuth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isMetricsAccessAllowed } from "@/lib/metricsAccess";

const METRICS_AGGREGATE_CACHE_TTL_MS = 60 * 1000;

const metricsAggregateCache = new Map<
  string,
  { createdAt: number; payload: Array<{ storySlug: string; plays: number; completions: number; completionRate: number }> }
>();

type AggregateRow = {
  storySlug: string;
  eventType: string;
  _count: { _all: number };
};

function isMissingTableError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const maybe = err as { code?: string; message?: string };
  return maybe.code === "P2021" || maybe.code === "P2022";
}

export async function GET(req: NextRequest): Promise<Response> {
  const { userId } = getAuth(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await isMetricsAccessAllowed(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const cacheKey = `aggregate:${userId}`;
  const cached = metricsAggregateCache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < METRICS_AGGREGATE_CACHE_TTL_MS) {
    return NextResponse.json(cached.payload);
  }

  try {
    const rows = await prisma.userMetric.groupBy({
      by: ["storySlug", "eventType"],
      where: {
        eventType: { in: ["audio_play", "audio_complete"] },
      },
      _count: { _all: true },
    });

    const byStory = new Map<string, { plays: number; completions: number }>();
    for (const row of rows as AggregateRow[]) {
      const curr = byStory.get(row.storySlug) ?? { plays: 0, completions: 0 };
      if (row.eventType === "audio_play") curr.plays = row._count._all;
      if (row.eventType === "audio_complete") curr.completions = row._count._all;
      byStory.set(row.storySlug, curr);
    }

    const result = Array.from(byStory.entries())
      .map(([storySlug, counts]) => {
        const completionRate =
          counts.plays > 0 ? Math.round((counts.completions / counts.plays) * 100) : 0;
        return {
          storySlug,
          plays: counts.plays,
          completions: counts.completions,
          completionRate,
        };
      })
      .sort((a, b) => b.plays - a.plays)
      .slice(0, 100);

    metricsAggregateCache.set(cacheKey, {
      createdAt: Date.now(),
      payload: result,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (isMissingTableError(err)) {
      return NextResponse.json([]);
    }
    console.error("❌ Error en GET /api/metrics/aggregate:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
