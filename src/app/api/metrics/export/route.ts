export const runtime = "nodejs";

import { getAuth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isMetricsAccessAllowed } from "@/lib/metricsAccess";

/**
 * CSV export of the daily plays/completions series for the requested
 * range. Wired to the "Exportar" button in /studio/metrics. Minimal
 * first cut: one row per day with the same numbers that drive the
 * AreaChart. Future iterations can fan out per-section exports
 * (top stories, funnels, etc.) by branching on `section`.
 */

function parseDays(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 30;
  return Math.min(180, Math.max(1, Math.floor(n)));
}

function csvEscape(value: string | number): string {
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
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
  const days = parseDays(search.get("days"));
  const storySlug = search.get("storySlug")?.trim() || null;
  const bookSlug = search.get("bookSlug")?.trim() || null;
  const now = new Date();
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const rows = await prisma.userMetric.findMany({
    where: {
      createdAt: { gte: from, lte: now },
      eventType: { in: ["audio_play", "audio_complete"] },
      ...(storySlug ? { storySlug } : {}),
      ...(bookSlug ? { bookSlug } : {}),
    },
    select: {
      eventType: true,
      createdAt: true,
    },
    take: 50000,
  });

  const byDay = new Map<string, { plays: number; completions: number }>();
  for (const row of rows) {
    const day = row.createdAt.toISOString().slice(0, 10);
    const bucket = byDay.get(day) ?? { plays: 0, completions: 0 };
    if (row.eventType === "audio_play") bucket.plays += 1;
    else if (row.eventType === "audio_complete") bucket.completions += 1;
    byDay.set(day, bucket);
  }

  const lines = ["date,plays,completions,completion_rate"];
  const sortedDays = Array.from(byDay.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  );
  for (const [day, bucket] of sortedDays) {
    const cr =
      bucket.plays > 0
        ? Math.round((bucket.completions / bucket.plays) * 100)
        : 0;
    lines.push(
      [day, bucket.plays, bucket.completions, cr].map(csvEscape).join(",")
    );
  }

  const filename = `metrics-${days}d${storySlug ? `-${storySlug}` : ""}${
    bookSlug ? `-${bookSlug}` : ""
  }.csv`;

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
