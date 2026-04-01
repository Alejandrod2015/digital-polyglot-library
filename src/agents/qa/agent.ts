import type { QAAgentOutput, QAAgentRun } from "@/agents/qa/types";
import { loadJourneyStoryForQa, runStoryQaChecks } from "@/agents/qa/tools";
import { persistAgentRun, persistQAReview } from "@/lib/agentPersistence";
import { loadPedagogicalRules } from "@/agents/config/pedagogicalConfig";
import { agentLog, agentTimer } from "@/lib/agentLogger";

function summarize(status: QAAgentOutput["status"], findingsCount: number): string {
  if (status === "pass") {
    return "La historia pasa QA y está lista para revisión final o publicación.";
  }
  if (status === "needs_review") {
    return `La historia necesita revisión humana. Hay ${findingsCount} hallazgos no bloqueantes.`;
  }
  return `La historia no pasa QA. Hay ${findingsCount} hallazgos bloqueantes o de calidad importante.`;
}

function computeStatus(
  criticalCount: number,
  warningCount: number
): QAAgentOutput["status"] {
  if (criticalCount > 0) {
    return "fail";
  }
  if (warningCount > 0) {
    return "needs_review";
  }
  return "pass";
}

function computeScore(
  criticalCount: number,
  warningCount: number,
  infoCount: number,
  llmQualityScore?: number
): number {
  // Structural score: based on findings
  const structuralScore = 100 - criticalCount * 30 - warningCount * 12 - infoCount * 3;
  const normalizedStructuralScore = Math.max(0, Math.min(100, structuralScore));

  // If LLM quality score is available, blend the two scores
  // Structural checks: 40% weight, LLM quality: 60% weight
  if (llmQualityScore !== undefined) {
    const llmPercentage = (llmQualityScore / 10) * 100;
    const finalScore = normalizedStructuralScore * 0.4 + llmPercentage * 0.6;
    return Math.round(finalScore);
  }

  return normalizedStructuralScore;
}

export async function runJourneyStoryQaAgent(storyId: string): Promise<QAAgentRun & { runId: string }> {
  const startedAt = new Date().toISOString();
  // Preload pedagogical rules from DB so QA checks use latest config
  await loadPedagogicalRules();
  const story = await loadJourneyStoryForQa(storyId);
  const findings = await runStoryQaChecks(story);
  const criticalCount = findings.filter((finding) => finding.severity === "critical").length;
  const warningCount = findings.filter((finding) => finding.severity === "warning").length;
  const infoCount = findings.filter((finding) => finding.severity === "info").length;
  const status = computeStatus(criticalCount, warningCount);
  const llmQualityScore = (story as any)._llmQualityScore;
  const score = computeScore(criticalCount, warningCount, infoCount, llmQualityScore);
  const completedAt = new Date().toISOString();

  const runStatus = status === "pass" ? "completed" : status === "needs_review" ? "needs_review" : "failed";

  // Persist the run
  const toolsUsed = llmQualityScore !== undefined ? ["loadJourneyStoryForQa", "runStoryQaChecks", "runLLMQualityCheck"] : ["loadJourneyStoryForQa", "runStoryQaChecks"];
  const runId = await persistAgentRun({
    agentKind: "qa",
    status: runStatus,
    input: { storyId },
    output: {
      status,
      score,
      summary: summarize(status, findings.length),
      findings,
      story: {
        id: story.id,
        title: story.title,
        slug: story.slug,
        level: story.cefrLevel,
        variant: story.variant,
        journeyTopic: story.journeyTopic,
        journeyOrder: story.journeyOrder,
      },
    },
    toolsUsed,
    startedAt,
    completedAt,
  });

  // Persist QA review
  await persistQAReview({
    sourceStoryId: storyId,
    sourceRunId: runId,
    status,
    score,
    report: {
      findings,
      summary: summarize(status, findings.length),
    },
  });

  return {
    runId,
    agent: "qa",
    status: runStatus,
    startedAt,
    completedAt,
    input: {
      storyId,
    },
    output: {
      status,
      score,
      summary: summarize(status, findings.length),
      findings,
      story: {
        id: story.id,
        title: story.title,
        slug: story.slug,
        level: story.cefrLevel,
        variant: story.variant,
        journeyTopic: story.journeyTopic,
        journeyOrder: story.journeyOrder,
      },
    },
    toolsUsed: llmQualityScore !== undefined
      ? [
          { toolName: "loadJourneyStoryForQa", summary: "Carga la historia desde Studio/Sanity." },
          { toolName: "runStoryQaChecks", summary: "Aplica validaciones pedagógicas, de Journey, media y vocabulario." },
          { toolName: "runLLMQualityCheck", summary: "Evalúa calidad narrativa, conformidad CEFR, naturalidad del idioma, relevancia temática y autenticidad cultural." },
        ]
      : [
          { toolName: "loadJourneyStoryForQa", summary: "Carga la historia desde Studio/Sanity." },
          { toolName: "runStoryQaChecks", summary: "Aplica validaciones pedagógicas, de Journey, media y vocabulario." },
        ],
  };
}

export async function runDraftQaAgent(draftId: string, options?: { enableLLMQA?: boolean }): Promise<QAAgentRun & { runId: string }> {
  const startedAt = new Date().toISOString();
  const qaTimer = agentTimer("qa", "runDraftQaAgent");
  await loadPedagogicalRules();

  const { loadDraftForQa } = await import("@/agents/qa/tools");
  const story = await loadDraftForQa(draftId);

  const checksTimer = agentTimer("qa", "runStoryQaChecks");
  const findings = await runStoryQaChecks(story, { enableLLMQA: options?.enableLLMQA });
  checksTimer.end({ findingsCount: findings.length });

  const criticalCount = findings.filter((f) => f.severity === "critical").length;
  const warningCount = findings.filter((f) => f.severity === "warning").length;
  const infoCount = findings.filter((f) => f.severity === "info").length;
  const status = computeStatus(criticalCount, warningCount);
  const llmQualityScore = (story as any)._llmQualityScore;
  const score = computeScore(criticalCount, warningCount, infoCount, llmQualityScore);
  const completedAt = new Date().toISOString();

  agentLog.info("qa", `Draft QA completed: ${status} (score: ${score})`, {
    draftId,
    status,
    score,
    criticalCount,
    warningCount,
    infoCount,
    llmQualityScore,
    durationMs: qaTimer.elapsed(),
  });

  const runStatus = status === "pass" ? "completed" : status === "needs_review" ? "needs_review" : "failed";

  const toolsUsed = llmQualityScore !== undefined ? ["loadDraftForQa", "runStoryQaChecks", "runLLMQualityCheck"] : ["loadDraftForQa", "runStoryQaChecks"];
  const runId = await persistAgentRun({
    agentKind: "qa",
    status: runStatus,
    input: { storyId: draftId, source: "draft" },
    output: {
      status,
      score,
      summary: summarize(status, findings.length),
      findings,
      story: {
        id: story.id,
        title: story.title,
        slug: story.slug,
        level: story.cefrLevel,
        variant: story.variant,
        journeyTopic: story.journeyTopic,
        journeyOrder: story.journeyOrder,
      },
    },
    toolsUsed,
    startedAt,
    completedAt,
  });

  await persistQAReview({
    sourceStoryId: draftId,
    sourceRunId: runId,
    status,
    score,
    report: {
      findings,
      summary: summarize(status, findings.length),
    },
  });

  // Update draft with latest QA run reference
  try {
    const { prisma } = await import("@/lib/prisma");
    await (prisma as any).storyDraft.update({
      where: { id: draftId },
      data: { latestQaRunId: runId },
    });
  } catch { /* non-critical */ }

  return {
    runId,
    agent: "qa",
    status: runStatus,
    startedAt,
    completedAt,
    input: { storyId: draftId },
    output: {
      status,
      score,
      summary: summarize(status, findings.length),
      findings,
      story: {
        id: story.id,
        title: story.title,
        slug: story.slug,
        level: story.cefrLevel,
        variant: story.variant,
        journeyTopic: story.journeyTopic,
        journeyOrder: story.journeyOrder,
      },
    },
    toolsUsed: llmQualityScore !== undefined
      ? [
          { toolName: "loadDraftForQa", summary: "Carga el draft desde Prisma y lo adapta para QA." },
          { toolName: "runStoryQaChecks", summary: "Aplica validaciones pedagógicas, de Journey, media y vocabulario." },
          { toolName: "runLLMQualityCheck", summary: "Evalúa calidad narrativa, conformidad CEFR, naturalidad del idioma, relevancia temática y autenticidad cultural." },
        ]
      : [
          { toolName: "loadDraftForQa", summary: "Carga el draft desde Prisma y lo adapta para QA." },
          { toolName: "runStoryQaChecks", summary: "Aplica validaciones pedagógicas, de Journey, media y vocabulario." },
        ],
  };
}
