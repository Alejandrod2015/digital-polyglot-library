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
  // New: QA quality trends over the last 7 days
  qaQuality?: {
    scoreTrend: Array<{ date: string; avgScore: number; count: number }>;
    recentReviews: Array<{
      id: string;
      storyTitle: string;
      score: number;
      status: string;
      createdAt: string;
    }>;
    passRateTrend: Array<{ date: string; passRate: number; total: number }>;
  };
  // New: Agent performance (avg duration in ms)
  agentPerformance?: {
    avgDurationByKind: Record<string, number | null>;
    failureRate: number;
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
  const qaReviewModel = (prisma as any).qAReview;

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // ─── Agent Runs ────────────────────────────────────────────────
  // Use raw SQL to avoid Prisma enum deserialization errors
  // (DB contains legacy agentKind values like 'curriculum' not in the Prisma enum)
  const VALID_KINDS = new Set(["planner", "content", "qa"]);

  const allAgentRuns: Array<{ agentKind: string; status: string; createdAt: Date }> =
    await prisma.$queryRawUnsafe(
      `SELECT "agentKind"::text, "status"::text, "createdAt" FROM "dp_agent_runs_v1"`
    );

  const validRuns = allAgentRuns.filter((r) => VALID_KINDS.has(r.agentKind));
  const totalAgentRuns = validRuns.length;

  const kindCounts = { planner: 0, content: 0, qa: 0 };
  const statusCounts_runs = { completed: 0, failed: 0, running: 0 };

  for (const run of validRuns) {
    if (run.agentKind in kindCounts) kindCounts[run.agentKind as keyof typeof kindCounts]++;
    if (run.status in statusCounts_runs) statusCounts_runs[run.status as keyof typeof statusCounts_runs]++;
  }

  // Last 7 days grouped by date
  const dateStatusMap = new Map<string, { completed: number; failed: number }>();
  for (const run of validRuns) {
    if (run.createdAt < sevenDaysAgo) continue;
    const dateStr = run.createdAt.toISOString().split("T")[0];
    if (!dateStatusMap.has(dateStr)) {
      dateStatusMap.set(dateStr, { completed: 0, failed: 0 });
    }
    const counts = dateStatusMap.get(dateStr)!;
    if (run.status === "completed") counts.completed++;
    if (run.status === "failed") counts.failed++;
  }

  const agentRunsLast7DaysFormatted = Array.from(dateStatusMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, counts]) => ({ date, ...counts }));

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

  // ─── QA Quality Trends ───────────────────────────────────────
  let qaQuality: PipelineResponse["qaQuality"] = undefined;
  try {
    // Score trend by date (last 7 days)
    const recentQaReviews = await qaReviewModel.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      select: { id: true, score: true, status: true, createdAt: true, sourceStoryId: true },
      orderBy: { createdAt: "desc" },
    });

    // Group by date for score trend
    const scoreByDate = new Map<string, { total: number; sum: number; passed: number }>();
    for (const review of recentQaReviews) {
      const dateStr = review.createdAt.toISOString().split("T")[0];
      if (!scoreByDate.has(dateStr)) {
        scoreByDate.set(dateStr, { total: 0, sum: 0, passed: 0 });
      }
      const entry = scoreByDate.get(dateStr)!;
      entry.total++;
      entry.sum += review.score ?? 0;
      if (review.status === "passed" || review.status === "pass") entry.passed++;
    }

    const scoreTrend = Array.from(scoreByDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { total, sum }]) => ({
        date,
        avgScore: Math.round((sum / total) * 10) / 10,
        count: total,
      }));

    const passRateTrend = Array.from(scoreByDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { total, passed }]) => ({
        date,
        passRate: Math.round((passed / total) * 100),
        total,
      }));

    // Recent reviews with story info
    const recentReviewsFormatted = await Promise.all(
      recentQaReviews.slice(0, 10).map(async (review: any) => {
        let storyTitle = "Unknown";
        try {
          const draft = await storyDraftModel.findUnique({
            where: { id: review.sourceStoryId },
            select: { title: true },
          });
          if (draft?.title) storyTitle = draft.title;
        } catch { /* non-critical */ }
        return {
          id: review.id,
          storyTitle,
          score: review.score ?? 0,
          status: review.status,
          createdAt: review.createdAt.toISOString(),
        };
      })
    );

    qaQuality = { scoreTrend, recentReviews: recentReviewsFormatted, passRateTrend };
  } catch {
    // Non-critical — qaQuality will be undefined
  }

  // ─── Agent Performance ──────────────────────────────────────
  let agentPerformance: PipelineResponse["agentPerformance"] = undefined;
  try {
    // Calculate average duration by agent kind from runs with both timestamps
    const runsWithDuration: Array<{ agentKind: string; startedAt: Date; completedAt: Date | null }> =
      await prisma.$queryRawUnsafe(
        `SELECT "agentKind"::text, "startedAt", "completedAt" FROM "dp_agent_runs_v1" WHERE "completedAt" IS NOT NULL`
      );

    const durationByKind = new Map<string, { total: number; sum: number }>();
    let totalRuns = 0;
    let failedRuns = 0;

    for (const run of runsWithDuration) {
      if (!VALID_KINDS.has(run.agentKind) || !run.completedAt) continue;
      const durationMs = new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime();
      if (durationMs < 0 || durationMs > 600000) continue; // skip invalid (>10min)

      if (!durationByKind.has(run.agentKind)) {
        durationByKind.set(run.agentKind, { total: 0, sum: 0 });
      }
      const entry = durationByKind.get(run.agentKind)!;
      entry.total++;
      entry.sum += durationMs;
      totalRuns++;
    }

    // Count failures from our existing validRuns
    failedRuns = validRuns.filter((r) => r.status === "failed").length;

    const avgDurationByKind: Record<string, number | null> = {};
    for (const kind of ["planner", "content", "qa"]) {
      const entry = durationByKind.get(kind);
      avgDurationByKind[kind] = entry ? Math.round(entry.sum / entry.total) : null;
    }

    agentPerformance = {
      avgDurationByKind,
      failureRate: totalRuns > 0 ? Math.round((failedRuns / totalRuns) * 100) : 0,
    };
  } catch {
    // Non-critical
  }

  return {
    agentRuns: {
      total: totalAgentRuns,
      byKind: kindCounts,
      byStatus: statusCounts_runs,
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
    qaQuality,
    agentPerformance,
  };
}
