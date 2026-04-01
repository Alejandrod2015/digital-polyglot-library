import { prisma } from "@/lib/prisma";
import type { AgentKind, AgentRunStatus } from "@/agents/types";

export async function persistAgentRun(params: {
  agentKind: AgentKind;
  status: AgentRunStatus;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  errorMessage?: string;
  toolsUsed: string[];
  parentRunId?: string;
  model?: string;
  startedAt: string;
  completedAt?: string;
}): Promise<string> {
  const run = await (prisma as any).agentRun.create({
    data: {
      agentKind: params.agentKind,
      status: params.status,
      input: params.input,
      output: params.output,
      errorMessage: params.errorMessage,
      toolsUsed: params.toolsUsed,
      parentRunId: params.parentRunId,
      model: params.model,
      startedAt: new Date(params.startedAt),
      completedAt: params.completedAt ? new Date(params.completedAt) : null,
    },
  });

  return run.id;
}

export async function persistQAReview(params: {
  sourceStoryId: string;
  sourceRunId: string;
  status: string;
  score: number;
  report: Record<string, unknown>;
}): Promise<string> {
  const review = await (prisma as any).qAReview.create({
    data: {
      sourceStoryId: params.sourceStoryId,
      sourceRunId: params.sourceRunId,
      status: params.status,
      score: params.score,
      report: params.report,
    },
  });

  return review.id;
}

export async function getAgentRuns(agentKind: AgentKind, limit: number = 50): Promise<any[]> {
  const runs = await (prisma as any).agentRun.findMany({
    where: {
      agentKind,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
  });

  return runs;
}

export async function getQAReviewsForStory(sourceStoryId: string): Promise<any[]> {
  const reviews = await (prisma as any).qAReview.findMany({
    where: {
      sourceStoryId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return reviews;
}

export async function getAgentRun(runId: string): Promise<any | null> {
  const run = await (prisma as any).agentRun.findUnique({
    where: {
      id: runId,
    },
  });

  return run || null;
}

/** Update the output of an existing agent run (call after draft/brief creation). */
export async function updateAgentRunOutput(
  runId: string,
  output: Record<string, unknown>
): Promise<void> {
  await (prisma as any).agentRun.update({
    where: { id: runId },
    data: { output },
  });
}
