import type { PlannerAgentInput, PlannerAgentOutput, PlannerAgentRun } from "./types";
import { loadCatalog, detectGaps, saveBriefs, proposeJourneys, createJourneys } from "./tools";
import { persistAgentRun, updateAgentRunOutput } from "@/lib/agentPersistence";
import { loadPedagogicalRules } from "@/agents/config/pedagogicalConfig";
import { loadPlannerConfig } from "@/agents/config/plannerConfig";
import { loadDirective } from "@/agents/config/directive";

export async function runPlannerAgent(
  input: PlannerAgentInput
): Promise<PlannerAgentRun & { runId: string }> {
  const startedAt = new Date().toISOString();
  const mode = input.mode ?? "gaps";

  try {
    await loadPedagogicalRules();
    const plannerConfig = await loadPlannerConfig();

    if (mode === "gaps") {
      // ── Existing gap-detection logic ──
      const stories = await loadCatalog();

      // If no language filter provided, use directive languages
      let languageFilter = input.language;
      if (!languageFilter) {
        const directive = await loadDirective();
        // For gap detection, if multiple languages in directive, we'll use the first one
        // or pass no filter if we want to detect gaps across all directive languages
        // For now, we use the first language or no filter at all
        if (directive.active && directive.languages.length > 0) {
          languageFilter = directive.languages[0];
        }
      }

      const gaps = await detectGaps(stories, {
        language: languageFilter,
        variant: input.variant,
        journeyTopic: input.journeyTopic,
      });
      const completedAt = new Date().toISOString();

      const runId = await persistAgentRun({
        agentKind: "planner",
        status: "completed",
        input: input as unknown as Record<string, unknown>,
        output: null,
        toolsUsed: ["loadCatalog", "detectGaps", "saveBriefs"],
        startedAt,
        completedAt,
      });

      const briefsCreated = await saveBriefs(gaps, runId);

      const output: PlannerAgentOutput = {
        status: "completed",
        mode: "gaps",
        totalStoriesAnalyzed: stories.length,
        gapsFound: gaps.length,
        briefsCreated,
        gaps: gaps.slice(0, plannerConfig.maxVisibleGaps),
        journeysProposed: [],
        journeysCreated: 0,
        summary: `Analizado catálogo de ${stories.length} historias. Detectados ${gaps.length} gaps. Creados ${briefsCreated} briefs nuevos.`,
      };

      await updateAgentRunOutput(runId, output as unknown as Record<string, unknown>);

      return {
        runId,
        agent: "planner",
        status: "completed",
        startedAt,
        completedAt,
        input,
        output,
        toolsUsed: [
          { toolName: "loadCatalog", summary: `Cargó ${stories.length} historias del catálogo.` },
          { toolName: "detectGaps", summary: `Detectó ${gaps.length} gaps en el currículo.` },
          { toolName: "saveBriefs", summary: `Creó ${briefsCreated} briefs nuevos en Prisma.` },
        ],
      };
    } else {
      // ── Journey creation + automatic gap detection + brief generation ──
      const proposals = await proposeJourneys({
        topic: input.newJourneyTopic!,
        topicLabel: input.newJourneyTopicLabel || input.newJourneyTopic!,
        targetLanguages: input.targetLanguages ?? plannerConfig.defaultTargetLanguages,
        targetLevels: input.targetLevels ?? plannerConfig.defaultTargetLevels,
        storiesPerLevel: input.storiesPerLevel ?? plannerConfig.defaultStoriesPerLevel,
      });

      const journeysCreated = await createJourneys(proposals);

      // ── Chain: detect gaps for the new topic and generate briefs ──
      const stories = await loadCatalog();
      const gaps = await detectGaps(stories, {
        journeyTopic: input.newJourneyTopic,
      });

      const completedAt = new Date().toISOString();

      const runId = await persistAgentRun({
        agentKind: "planner",
        status: "completed",
        input: input as unknown as Record<string, unknown>,
        output: null,
        toolsUsed: ["proposeJourneys", "createJourneys", "loadCatalog", "detectGaps", "saveBriefs"],
        startedAt,
        completedAt,
      });

      const briefsCreated = await saveBriefs(gaps, runId);

      const output: PlannerAgentOutput = {
        status: "completed",
        mode: "create-journey",
        totalStoriesAnalyzed: stories.length,
        gapsFound: gaps.length,
        briefsCreated,
        gaps: gaps.slice(0, plannerConfig.maxVisibleGaps),
        journeysProposed: proposals,
        journeysCreated,
        summary: `Creados ${journeysCreated} journeys para "${input.newJourneyTopic}". Detectados ${gaps.length} gaps. Generados ${briefsCreated} briefs listos para Content Agent.`,
      };

      await updateAgentRunOutput(runId, output as unknown as Record<string, unknown>);

      return {
        runId,
        agent: "planner",
        status: "completed",
        startedAt,
        completedAt,
        input,
        output,
        toolsUsed: [
          { toolName: "proposeJourneys", summary: `Propuso ${proposals.length} journeys nuevos.` },
          { toolName: "createJourneys", summary: `Creó ${journeysCreated} variant plans en Sanity.` },
          { toolName: "loadCatalog", summary: `Cargó ${stories.length} historias del catálogo.` },
          { toolName: "detectGaps", summary: `Detectó ${gaps.length} gaps para topic "${input.newJourneyTopic}".` },
          { toolName: "saveBriefs", summary: `Creó ${briefsCreated} briefs nuevos en Prisma.` },
        ],
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const completedAt = new Date().toISOString();

    const runId = await persistAgentRun({
      agentKind: "planner",
      status: "failed",
      input: input as unknown as Record<string, unknown>,
      output: null,
      toolsUsed: [],
      errorMessage,
      startedAt,
      completedAt,
    });

    const output: PlannerAgentOutput = {
      status: "failed",
      mode,
      totalStoriesAnalyzed: 0,
      gapsFound: 0,
      briefsCreated: 0,
      gaps: [],
      journeysProposed: [],
      journeysCreated: 0,
      summary: `Error ejecutando Planner Agent: ${errorMessage}`,
    };

    return {
      runId,
      agent: "planner",
      status: "failed",
      startedAt,
      completedAt,
      input,
      output,
      toolsUsed: [],
    };
  }
}
