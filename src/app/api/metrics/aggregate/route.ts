export const runtime = "nodejs";

import { getAuth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma"; // ✅ necesario para Prisma.sql y Prisma.join

export async function GET(req: NextRequest): Promise<Response> {
  const { userId } = getAuth(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  const startDate = start
    ? new Date(start)
    : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Últimos 7 días por defecto
  const endDate = end ? new Date(end) : new Date();

  try {
    const metrics = await prisma.$queryRawUnsafe<
      {
        storySlug: string;
        plays: number;
        completions: number;
        completionRate: number;
        avgDuration: number | null;
      }[]
    >(
      Prisma.sql`
        SELECT
          "storySlug" AS "storySlug",
          COUNT(*) FILTER (WHERE "eventType" = 'audio_play') AS "plays",
          COUNT(*) FILTER (WHERE "eventType" = 'audio_complete') AS "completions",
          ROUND(
            COUNT(*) FILTER (WHERE "eventType" = 'audio_complete')::decimal /
            NULLIF(COUNT(*) FILTER (WHERE "eventType" = 'audio_play'), 0),
            2
          ) AS "completionRate",
          AVG("value") FILTER (WHERE "eventType" = 'audio_complete') AS "avgDuration"
        FROM "dp_user_metrics_v1"
        WHERE "createdAt" BETWEEN ${startDate.toISOString()}::timestamp 
                              AND ${endDate.toISOString()}::timestamp
        GROUP BY "storySlug"
        ORDER BY "completions" DESC
        LIMIT 50;
      `.sql // ✅ extrae la cadena SQL final
    );

    return NextResponse.json(metrics);
  } catch (err) {
    console.error("❌ Error en /api/metrics/aggregate:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
