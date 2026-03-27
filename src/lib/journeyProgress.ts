import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import {
  getJourneyProgressKeyFromSource,
  getJourneyTopicCheckpointKey,
  getJourneyTopicPracticeKey,
} from "@/app/journey/journeyData";

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

async function resolveJourneyUserId(userIdOverride?: string): Promise<string | null> {
  if (userIdOverride) return userIdOverride;
  const { userId } = await auth();
  return userId ?? null;
}

export async function getCompletedJourneyStoryKeys(userIdOverride?: string): Promise<Set<string>> {
  const userId = await resolveJourneyUserId(userIdOverride);
  if (!userId) return new Set<string>();

  const metrics = await prisma.userMetric.findMany({
    where: {
      userId,
      eventType: { in: ["audio_complete", "continue_listening", "journey_story_read"] },
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
    const metadata =
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : null;

    const progressKey =
      metadata && typeof metadata.progressKey === "string" && metadata.progressKey.trim()
        ? metadata.progressKey.trim()
        : row.bookSlug && row.bookSlug !== "polyglot"
          ? `${row.bookSlug}:${row.storySlug}`
          : null;

    if (!progressKey || completed.has(progressKey)) continue;

    if (row.eventType === "audio_complete") {
      completed.add(progressKey);
      continue;
    }

    if (row.eventType === "journey_story_read") {
      completed.add(progressKey);
      continue;
    }

    if (
      metadata &&
      isCompletedFromAudio(toNumber(metadata.progressSec), toNumber(metadata.audioDurationSec))
    ) {
      completed.add(progressKey);
    }
  }

  return completed;
}

export async function getPracticedJourneyTopicKeys(userIdOverride?: string): Promise<Set<string>> {
  const userId = await resolveJourneyUserId(userIdOverride);
  if (!userId) return new Set<string>();

  const rows = await prisma.userMetric.findMany({
    where: {
      userId,
      eventType: "practice_session_completed",
    },
    select: {
      metadata: true,
    },
    take: 2000,
    orderBy: { createdAt: "desc" },
  });

  const practiced = new Set<string>();

  for (const row of rows) {
    const metadata =
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : null;
    if (!metadata) continue;

    if (metadata.source !== "journey") continue;

    const levelId = typeof metadata.levelId === "string" ? metadata.levelId : "";
    const topicId = typeof metadata.topicId === "string" ? metadata.topicId : "";
    const variantId =
      typeof metadata.variantId === "string" && metadata.variantId.trim() !== ""
        ? metadata.variantId
        : undefined;

    if (!levelId || !topicId) continue;

    practiced.add(getJourneyTopicPracticeKey(variantId, levelId, topicId));
  }

  return practiced;
}

export async function getPassedJourneyCheckpointKeys(userIdOverride?: string): Promise<Set<string>> {
  const userId = await resolveJourneyUserId(userIdOverride);
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

export type JourneyDueReviewItem = {
  word: string;
  storySlug: string | null;
  sourcePath: string | null;
  nextReviewAt: string | null;
  progressKey: string | null;
};

export async function getJourneyDueReviewItems(limit = 200, userIdOverride?: string): Promise<JourneyDueReviewItem[]> {
  const userId = await resolveJourneyUserId(userIdOverride);
  if (!userId) return [];

  const rows = await prisma.favorite.findMany({
    where: {
      userId,
      nextReviewAt: { lte: new Date() },
    },
    select: {
      word: true,
      storySlug: true,
      sourcePath: true,
      nextReviewAt: true,
    },
    orderBy: { nextReviewAt: "asc" },
    take: limit,
  });

  return rows.map((row) => ({
    word: row.word,
    storySlug: row.storySlug ?? null,
    sourcePath: row.sourcePath ?? null,
    nextReviewAt: row.nextReviewAt ? row.nextReviewAt.toISOString() : null,
    progressKey: getJourneyProgressKeyFromSource(row.sourcePath, row.storySlug),
  }));
}
