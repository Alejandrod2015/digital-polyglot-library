export const runtime = "nodejs";

import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStudioMember } from "@/lib/studio-access";

const CACHE_TTL_MS = 60 * 1000; // 1 minute
const pipelineMetricsCache = new Map<string, { createdAt: number; payload: PipelineResponse }>();

type PipelineResponse = {
  agentRuns: {
    total: number;
    byKind: { planner: number; content: number; qa: number };
    byStatus: { completed: number; failed: number; running: number };
    last7Days: Array<{ date: string; completed: number; failed: number }>;
  };
  drafts: {
    total: number;
    byStatus: {
      draft: number;
      generated: number;
      qa_pass: number;
      qa_fail: number;
      needs_review: number;
      approved: number;
      published: number;
    };
    avgQaScore: number | null;
    qaPassRate: number;
    last7Days: Array<{ date: string; created: number; published: number }>;
  };
  briefs: {
    total: number;
    pending: number;
    completed: number;
  };
  pipeline: {
    avgTimeToPublish: number | null;
    contentPerDay: number;
  };
};

/**
 * GET /api/metrics/pipeline
 * Returns agent pipeline metrics for studio members
 */
export async function GET(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const member = await getStudioMember(email);
  if (!member) {
    return NextResponse.json({ error: "Forbidden: studio member only" }, { status: 403 });
  }

  const cacheKey = "pipeline-metrics";
  const cached = pipelineMetricsCache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
    return NextResponse.json(cached.payload);
  }

  try {
    const data = await fetchPipelineMetrics();

    pipelineMetricsCache.set(cacheKey, { createdAt: Date.now(), payload: data });
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Pipeline metrics error:", msg);
    return NextResponse.json(
      { error: "Failed to fetch pipeline metrics", details: msg },
      { status: 500 }
    );
  }
}

async function fetchPipelineMetrics(): Promise<PipelineResponse> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const agentRunModel = (prisma as any).agentRun;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const storyDraftModel = (prisma as any).storyDraft;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const briefModel = (prisma as any).curriculumBrief;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const qaReviewModel = (prisma as any).qaReview;

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // ─── Agent Runs ────────────────────────────────────────────────
  const totalAgentRuns = await agentRunModel.count();

  const agentRunsByKind = await agentRunModel.groupBy({
    by: ["agentKind"],
    _count: true,
  });

  const agentRunsByStatus = await agentRunModel.groupBy({
    by: ["status"],
    _count: true,
  });

  const agentRunsLast7Days = await agentRunModel.groupBy({
    by: ["createdAt"],
    where: { createdAt: { gte: sevenDaysAgo } },
    _count: true,
    orderBy: { createdAt: "asc" },
  });

  const agentRunsLast7DaysGrouped = await agentRunModel.groupBy({
    by: ["createdAt"],
    where: { createdAt: { gte: sevenDaysAgo } },
    _count: true,
  });

  // Group by date and status
  const dateStatusMap = new Map<string, { completed: number; failed: number }>();
  const agentRunsByDateAndStatus = await agentRunModel.findMany({
    where: { createdAt: { gte: sevenDaysAgo } },
    select: { createdAt: true, status: true },
  });

  agentRunsByDateAndStatus.forEach((run: { createdAt: Date; status: string }) => {
    const dateStr = run.createdAt.toISOString().split("T")[0];
    if (!dateStatusMap.has(dateStr)) {
      dateStatusMap.set(dateStr, { completed: 0, failed: 0 });
    }
    const counts = dateStatusMap.get(dateStr)!;
    if (run.status === "completed") counts.completed++;
    if (run.status === "failed") counts.failed++;
  });

  const agentRunsLast7DaysFormatted = Array.from(dateStatusMap.entries()).map(([date, counts]) => ({
    date,
    ...counts,
  }));

  // ─── Story Drafts ─────────────────────────────────────────────
  const totalDrafts = await storyDraftModel.count();

  const draftsByStatus = await storyDraftModel.groupBy({
    by: ["status"],
    _count: true,
  });

  const statusCounts = Object.fromEntries(
    draftsByStatus.map((item: { status: string; _count: number }) => [item.status, item._count])
  );

  // QA pass rate calculation
  const allQaReviews = await qaReviewModel.findMany({
    select: { score: true, status: true },
  });

  const qaPassedCount = allQaReviews.filter((r: { status: string }) => r.status === "passed").length;
  const qaPassRate = allQaReviews.length > 0 ? (qaPassedCount / allQaReviews.length) * 100 : 0;
  const avgQaScore =
    allQaReviews.length > 0
      ? allQaReviews.reduce((sum: number, r: { score: number | null }) => sum + (r.score ?? 0), 0) /
        allQaReviews.length
      : null;

  // Drafts created and published last 7 days
  const draftsLast7Days = await storyDraftModel.findMany({
    where: { createdAt: { gte: sevenDaysAgo } },
    select: { createdAt: true, status: true, updatedAt: true },
  });

  const draftsByDateMap = new Map<string, { created: number; published: number }>();
  draftsLast7Days.forEach(
    (draft: {
      createdAt: Date;
      status: string;
      updatedAt: Date;
    }) => {
      const createdDateStr = draft.createdAt.toISOString().split("T")[0];
      if (!draftsByDateMap.has(createdDateStr)) {
        draftsByDateMap.set(createdDateStr, { created: 0, published: 0 });
      }
      draftsByDateMap.get(createdDateStr)!.created++;

      if (draft.status === "published") {
        const publishedDateStr = draft.updatedAt.toISOString().split("T")[0];
        if (!draftsByDateMap.has(publishedDateStr)) {
          draftsByDateMap.set(publishedDateStr, { created: 0, published: 0 });
        }
        draftsByDateMap.get(publishedDateStr)!.published++;
      }
    }
  );

  const draftsLast7DaysFormatted = Array.from(draftsByDateMap.entries()).map(([date, counts]) => ({
    date,
    ...counts,
  }));

  // ─── Curriculum Briefs ────────────────────────────────────────
  const totalBriefs = await briefModel.count();
  const pendingBriefs = await briefModel.count({ where: { status: "draft" } });
  const completedBriefs = await briefModel.count({
    where: { status: { in: ["generated", "qa_pass", "published"] } },
  });

  // ─── Pipeline Metrics ─────────────────────────────────────────
  // Time to publish: from draft creation to published status
  const publishedDrafts = await storyDraftModel.findMany({
    where: {
      status: "published",
      createdAt: { gte: thirtyDaysAgo },
    },
    select: { createdAt: true, updatedAt: true },
  });

  let avgTimeToPublish: number | null = null;
  if (publishedDrafts.length > 0) {
    const totalMinutes = publishedDrafts.reduce((sum: number, draft: { createdAt: Date; updatedAt: Date }) => {
      const timeInMs = draft.updatedAt.getTime() - draft.createdAt.getTime();
      return sum + timeInMs / (1000 * 60);
    }, 0);
    avgTimeToPublish = totalMinutes / publishedDrafts.length;
  }

  // Content per day: average stories generated per day over last 30 days
  const draftCountLast30 = await storyDraftModel.count({
    where: { createdAt: { gte: thirtyDaysAgo } },
  });
  const contentPerDay = draftCountLast30 / 30;

  return {
    agentRuns: {
      total: totalAgentRuns,
      byKind: {
        planner: agentRunsByKind.find((k: { agentKind: string }) => k.agentKind === "planner")?._count ?? 0,
        content: agentRunsByKind.find((k: { agentKind: string }) => k.agentKind === "content")?._count ?? 0,
        qa: agentRunsByKind.find((k: { agentKind: string }) => k.agentKind === "qa")?._count ?? 0,
      },
      byStatus: {
        completed: agentRunsByStatus.find((s: { status: string }) => s.status === "completed")?._count ?? 0,
        failed: agentRunsByStatus.find((s: { status: string }) => s.status === "failed")?._count ?? 0,
        running: agentRunsByStatus.find((s: { status: string }) => s.status === "running")?._count ?? 0,
      },
      last7Days: agentRunsLast7DaysFormatted,
    },
    drafts: {
      total: totalDrafts,
      byStatus: {
        draft: statusCounts.draft ?? 0,
        generated: statusCounts.generated ?? 0,
        qa_pass: statusCounts.qa_pass ?? 0,
        qa_fail: statusCounts.qa_fail ?? 0,
        needs_review: statusCounts.needs_review ?? 0,
        approved: statusCounts.approved ?? 0,
        published: statusCounts.published ?? 0,
      },
      avgQaScore,
      qaPassRate: Math.round(qaPassRate),
      last7Days: draftsLast7DaysFormatted,
    },
    briefs: {
      total: totalBriefs,
      pending: pendingBriefs,
      completed: completedBriefs,
    },
    pipeline: {
      avgTimeToPublish,
      contentPerDay: Math.round(contentPerDay * 100) / 100,
    },
  };
}
