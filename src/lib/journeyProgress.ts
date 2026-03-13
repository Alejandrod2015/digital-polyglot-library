import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { getJourneyTopicCheckpointKey } from "@/app/journey/journeyData";

const COMPLETE_RATIO = 0.95;

function toNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function isCompletedFromAudio(progressSec?: number, audioDurationSec?: number): boolean {
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

export async function getCompletedJourneyStoryKeys(): Promise<Set<string>> {
  const { userId } = await auth();
  if (!userId) return new Set<string>();

  const metrics = await prisma.userMetric.findMany({
    where: {
      userId,
      bookSlug: { not: null },
      eventType: { in: ["audio_complete", "continue_listening"] },
      NOT: { bookSlug: "polyglot" },
    },
    select: {
      bookSlug: true,
      storySlug: true,
      eventType: true,
      value: true,
      metadata: true,
    },
    take: 5000,
    orderBy: { createdAt: "desc" },
  });

  const completed = new Set<string>();

  for (const row of metrics) {
    if (!row.bookSlug) continue;
    const key = `${row.bookSlug}:${row.storySlug}`;
    if (completed.has(key)) continue;

    if (row.eventType === "audio_complete") {
      completed.add(key);
      continue;
    }

    const metadata =
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : null;

    if (
      metadata &&
      isCompletedFromAudio(toNumber(metadata.progressSec), toNumber(metadata.audioDurationSec))
    ) {
      completed.add(key);
    }
  }

  return completed;
}

export async function getPassedJourneyCheckpointKeys(): Promise<Set<string>> {
  const { userId } = await auth();
  if (!userId) return new Set<string>();

  const rows = await prisma.userMetric.findMany({
    where: {
      userId,
      eventType: { in: ["journey_topic_checkpoint_complete", "path_topic_checkpoint_complete", "atlas_topic_checkpoint_complete"] },
    },
    select: {
      metadata: true,
    },
    take: 1000,
    orderBy: { createdAt: "desc" },
  });

  const passed = new Set<string>();

  for (const row of rows) {
    const metadata =
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : null;
    if (!metadata) continue;

    const levelId = typeof metadata.levelId === "string" ? metadata.levelId : "";
    const topicSlug = typeof metadata.topicSlug === "string" ? metadata.topicSlug : "";
    const variantId =
      typeof metadata.variantId === "string" && metadata.variantId.trim() !== ""
        ? metadata.variantId
        : undefined;

    if (!levelId || !topicSlug) continue;
    passed.add(getJourneyTopicCheckpointKey(variantId, levelId, topicSlug));
  }

  return passed;
}
