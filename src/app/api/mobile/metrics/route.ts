export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { getMobileSessionFromRequest } from "@/lib/mobileSession";

type MetricBody = {
  storySlug: string;
  bookSlug?: string;
  eventType: string;
  value?: number;
  metadata?: Record<string, unknown>;
};

const ALLOWED_EVENT_TYPES = new Set([
  "audio_load",
  "audio_play",
  "audio_pause",
  "audio_complete",
  "speed_change",
  "seek",
  "continue_listening",
  "journey_story_read",
  "journey_variant_selected",
  "journey_level_selected",
  "journey_topic_opened",
  "journey_next_action_clicked",
  "journey_review_cta_clicked",
  "checkpoint_recovery_clicked",
  "practice_recommended_mode_opened",
  "practice_session_started",
  "practice_session_completed",
  "reminder_scheduled",
  "reminder_tapped",
  "reminder_destination_opened",
  "trial_started",
  "trial_started_with_pm",
  "trial_converted",
  "trial_canceled",
  "trial_day_1_active",
  "plans_viewed",
  "checkout_started",
  "checkout_redirected",
  "checkout_failed",
  "upgrade_cta_clicked",
]);

function isMetricBody(x: unknown): x is MetricBody {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.storySlug === "string" &&
    typeof o.eventType === "string" &&
    (typeof o.bookSlug === "string" || o.bookSlug === undefined) &&
    (typeof o.value === "number" || o.value === undefined) &&
    (typeof o.metadata === "object" || o.metadata === undefined || o.metadata === null)
  );
}

export async function POST(req: NextRequest): Promise<Response> {
  const session = getMobileSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json: unknown = await req.json();
  if (!isMetricBody(json)) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  try {
    const { storySlug, bookSlug, eventType, value, metadata } = json;
    if (!ALLOWED_EVENT_TYPES.has(eventType)) {
      return NextResponse.json({ error: "Invalid eventType" }, { status: 400 });
    }

    await prisma.userMetric.create({
      data: {
        userId: session.sub,
        storySlug,
        bookSlug: bookSlug ?? null,
        eventType,
        value,
        metadata: (metadata as Prisma.InputJsonValue | undefined) ?? undefined,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error in POST /api/mobile/metrics:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
