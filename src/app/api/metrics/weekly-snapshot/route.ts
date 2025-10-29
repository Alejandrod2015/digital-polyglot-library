// /src/app/api/metrics/weekly-snapshot/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addDays, startOfWeek, endOfWeek } from "date-fns";

export async function POST(): Promise<Response> {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  try {
    const metrics = await prisma.$queryRawUnsafe<
      {
        plays: number;
        completions: number;
        completionRate: number;
        avgDuration: number | null;
      }[]
    >(
      `
      SELECT
        COUNT(*) FILTER (WHERE eventType = 'audio_play') AS plays,
        COUNT(*) FILTER (WHERE eventType = 'audio_complete') AS completions,
        ROUND(
          COUNT(*) FILTER (WHERE eventType = 'audio_complete')::decimal /
          NULLIF(COUNT(*) FILTER (WHERE eventType = 'audio_play'), 0),
          2
        ) AS "completionRate",
        AVG(value) FILTER (WHERE eventType = 'audio_complete') AS "avgDuration"
      FROM dp_user_metrics_v1
      WHERE "createdAt" BETWEEN $1 AND $2;
      `,
      weekStart,
      weekEnd
    );

    const m = metrics[0] ?? {
      plays: 0,
      completions: 0,
      completionRate: 0,
      avgDuration: 0,
    };

    await prisma.weeklyMetricsSnapshot.create({
      data: {
        weekStart,
        weekEnd,
        totalPlays: Number(m.plays) || 0,
        totalCompletions: Number(m.completions) || 0,
        avgCompletionRate: Number(m.completionRate) || 0,
        avgDuration: m.avgDuration ?? 0,
      },
    });

    return NextResponse.json({ ok: true, snapshot: m });
  } catch (err) {
    console.error("❌ Error en /api/metrics/weekly-snapshot:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
