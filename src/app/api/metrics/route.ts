export const runtime = "nodejs";

import { getAuth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type MetricBody = {
  storySlug: string;
  bookSlug?: string;
  eventType: string;
  value?: number;
};

function isMetricBody(x: unknown): x is MetricBody {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.storySlug === "string" &&
    typeof o.eventType === "string" &&
    (typeof o.bookSlug === "string" || o.bookSlug === undefined) &&
    (typeof o.value === "number" || o.value === undefined)
  );
}

export async function POST(req: NextRequest): Promise<Response> {
  const { userId } = getAuth(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json: unknown = await req.json();
  if (!isMetricBody(json)) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    const { storySlug, bookSlug, eventType, value } = json;

    await prisma.userMetric.create({
      data: {
        userId,
        storySlug,
        bookSlug: bookSlug ?? null,
        eventType,
        value,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("❌ Error en POST /api/metrics:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
