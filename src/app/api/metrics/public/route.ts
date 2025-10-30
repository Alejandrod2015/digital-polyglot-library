export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(): Promise<Response> {
  try {
    const metrics = await prisma.$queryRaw<
      {
        storySlug: string;
        plays: number;
        completions: number;
        completionRate: number;
        avgDuration: number | null;
      }[]
    >`
      SELECT
        "storySlug",
        COUNT(*) FILTER (WHERE "eventType" = 'audio_play') AS "plays",
        COUNT(*) FILTER (WHERE "eventType" = 'audio_complete') AS "completions",
        ROUND(
          (COUNT(*) FILTER (WHERE "eventType" = 'audio_complete')::decimal /
          NULLIF(COUNT(*) FILTER (WHERE "eventType" = 'audio_play'), 0)),
          2
        ) AS "completionRate",
        AVG("value") FILTER (WHERE "eventType" = 'audio_complete') AS "avgDuration"
      FROM "dp_user_metrics_v1"
      GROUP BY "storySlug"
      ORDER BY "completions" DESC
      LIMIT 50;
    `;

    return NextResponse.json(metrics);
  } catch (err) {
    console.error("❌ Error en /api/metrics/public:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
