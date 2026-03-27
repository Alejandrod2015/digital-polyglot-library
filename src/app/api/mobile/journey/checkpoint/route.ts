export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readJourneyCheckpointToken } from "@/lib/journeyCheckpointToken";
import { getMobileSessionFromRequest } from "@/lib/mobileSession";

const PASS_THRESHOLD = 0.8;

type CheckpointBody = {
  token?: string;
  responses?: Record<string, string>;
};

export async function POST(req: NextRequest): Promise<Response> {
  const session = getMobileSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CheckpointBody;
  try {
    body = (await req.json()) as CheckpointBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  const responses =
    body.responses && typeof body.responses === "object" ? body.responses : {};

  const payload = token ? readJourneyCheckpointToken(token) : null;
  if (!payload) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { variantId, levelId, topicSlug, answers, total } = payload;
  const score = Object.entries(answers).reduce((sum, [questionId, answer]) => {
    return sum + (responses[questionId] === answer ? 1 : 0);
  }, 0);
  const passed = total > 0 && score / total >= PASS_THRESHOLD;

  if (!passed) {
    return NextResponse.json({ error: "Checkpoint not passed", score, total }, { status: 400 });
  }

  await prisma.userMetric.create({
    data: {
      userId: session.sub,
      bookSlug: "journey",
      storySlug: `${levelId}:${topicSlug}`,
      eventType: "journey_topic_checkpoint_complete",
      value: score,
      metadata: {
        variantId: variantId ?? null,
        levelId,
        topicSlug,
        score,
        total,
      },
    },
  });

  return NextResponse.json({ success: true, score, total });
}
