import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isStudioMember } from "@/lib/studio-access";
import { runPlannerAgent } from "@/agents/planner/agent";
import { runContentAgentParallel } from "@/agents/content/parallel";
import { runDraftQaAgent } from "@/agents/qa/agent";
import { regenerateFromQA } from "@/agents/content/regenerate";
import { loadDirective, DEFAULT_BUDGET, type PipelineBudget } from "@/agents/config/directive";
import { autoPromoteDrafts, publishDraftToSanity } from "@/agents/publish/tools";
import { prisma } from "@/lib/prisma";
import { getJourneyCurriculumPlans, saveJourneyVariantPlanForStudio } from "@/lib/journeyCurriculumSource";
import type { JourneyVariantPlan } from "@/app/journey/journeyCurriculum";

/**
 * Map directive language names (lowercase) to the language/variant
 * used in curriculum plans. Falls back to sensible defaults.
 */
const LANG_TO_VARIANT: Record<string, { language: string; variant: string }> = {
  es: { language: "spanish", variant: "latam" },
  pt: { language: "portuguese", variant: "brazil" },
  fr: { language: "french", variant: "france" },
  it: { language: "italian", variant: "italy" },
  en: { language: "english", variant: "us" },
  de: { language: "german", variant: "germany" },
  spanish: { language: "spanish", variant: "latam" },
  portuguese: { language: "portuguese", variant: "brazil" },
  french: { language: "french", variant: "france" },
  italian: { language: "italian", variant: "italy" },
  english: { language: "english", variant: "us" },
  german: { language: "german", variant: "germany" },
};

/**
 * Bootstrap journey structure for languages that don't have curriculum plans yet.
 * Copies the topic structure from the most complete existing language (most levels/topics),
 * adapting it for the new language and filtering to the directive's target levels.
 */
async function bootstrapNewLanguages(
  languages: string[],
  directiveLevels: string[],
  storiesPerSlot: number,
): Promise<{ bootstrapped: string[]; skipped: string[] }> {
  const existingPlans = await getJourneyCurriculumPlans();
  const bootstrapped: string[] = [];
  const skipped: string[] = [];

  // Find the most complete plan to use as template
  let templatePlan: JourneyVariantPlan | null = null;
  let maxTopics = 0;
  for (const plan of existingPlans) {
    const totalTopics = plan.levels.reduce((sum, l) => sum + l.topics.length, 0);
    if (totalTopics > maxTopics) {
      maxTopics = totalTopics;
      templatePlan = plan;
    }
  }

  if (!templatePlan) {
    return { bootstrapped, skipped: languages };
  }

  for (const lang of languages) {
    const resolved = LANG_TO_VARIANT[lang.toLowerCase()] ?? { language: lang.toLowerCase(), variant: lang.toLowerCase() };

    // Check if plan already exists for this language
    const exists = existingPlans.some(
      (p) => p.language.toLowerCase() === resolved.language.toLowerCase()
    );

    if (exists) {
      skipped.push(lang);
      continue;
    }

    // Create new plan by copying template structure
    const newPlan: JourneyVariantPlan = {
      language: resolved.language,
      variantId: resolved.variant,
      levels: templatePlan.levels
        .filter((level) => {
          // Only include levels that are in the directive
          if (directiveLevels.length === 0) return true;
          return directiveLevels.some((dl) => dl.toLowerCase() === level.id.toLowerCase());
        })
        .map((level) => ({
          ...level,
          storyTargetPerTopic: storiesPerSlot,
          topics: level.topics.map((topic) => ({
            slug: topic.slug,
            label: topic.label,
            storyTarget: storiesPerSlot,
            checkpoint: "mixed" as const,
          })),
        })),
    };

    await saveJourneyVariantPlanForStudio(newPlan);
    bootstrapped.push(`${resolved.language} (${resolved.variant})`);
  }

  return { bootstrapped, skipped };
}

type PipelineStep = {
  step: string;
  status: "running" | "completed" | "failed" | "skipped";
  detail?: string;
  data?: Record<string, unknown>;
};

// ── Budget counter: tracks resource usage across the run ──

type BudgetCounter = {
  llmCalls: number;
  stories: number;
  startTime: number;
  budget: PipelineBudget;
  testMode: boolean;
};

function checkBudget(counter: BudgetCounter): { exceeded: boolean; reason: string } {
  if (counter.llmCalls >= counter.budget.maxLLMCallsPerRun) {
    return { exceeded: true, reason: `Límite de llamadas LLM alcanzado (${counter.llmCalls}/${counter.budget.maxLLMCallsPerRun})` };
  }
  if (counter.stories >= counter.budget.maxStoriesPerRun) {
    return { exceeded: true, reason: `Límite de historias alcanzado (${counter.stories}/${counter.budget.maxStoriesPerRun})` };
  }
  const elapsedMs = Date.now() - counter.startTime;
  const maxMs = counter.budget.maxRunDurationMinutes * 60_000;
  if (elapsedMs >= maxMs) {
    return { exceeded: true, reason: `Tiempo máximo alcanzado (${Math.round(elapsedMs / 60_000)}/${counter.budget.maxRunDurationMinutes} min)` };
  }
  return { exceeded: false, reason: "" };
}

function budgetSummary(counter: BudgetCounter): Record<string, unknown> {
  const elapsedMs = Date.now() - counter.startTime;
  return {
    llmCallsUsed: counter.llmCalls,
    llmCallsBudget: counter.budget.maxLLMCallsPerRun,
    storiesGenerated: counter.stories,
    storiesBudget: counter.budget.maxStoriesPerRun,
    timeElapsedSeconds: Math.round(elapsedMs / 1000),
    timeBudgetSeconds: counter.budget.maxRunDurationMinutes * 60,
    testMode: counter.testMode,
  };
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email || !(await isStudioMember(email))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Record<string, any> = {};
  try {
    body = await request.json();
  } catch { /* use defaults */ }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(step: PipelineStep) {
        controller.enqueue(encoder.encode(JSON.stringify(step) + "\n"));
      }

      try {
        // ── Step 0: Load Directive ──
        const directive = await loadDirective();

        if (!directive.active) {
          send({ step: "directive", status: "skipped", detail: "Directriz desactivada" });
          controller.close();
          return;
        }

        // ── Resolve budget and testMode ──
        const testMode = body.testMode === true;
        const budget: PipelineBudget = {
          ...DEFAULT_BUDGET,
          ...directive.budget,
          // Body overrides (for UI controls)
          ...(typeof body.maxStoriesPerRun === "number" ? { maxStoriesPerRun: body.maxStoriesPerRun } : {}),
          ...(typeof body.maxLLMCallsPerRun === "number" ? { maxLLMCallsPerRun: body.maxLLMCallsPerRun } : {}),
        };

        // In test mode: override to minimal generation
        if (testMode) {
          budget.maxStoriesPerRun = Math.min(budget.maxStoriesPerRun, 6);
          budget.maxLLMCallsPerRun = Math.min(budget.maxLLMCallsPerRun, 60);
        }

        const counter: BudgetCounter = {
          llmCalls: 0,
          stories: 0,
          startTime: Date.now(),
          budget,
          testMode,
        };

        // Build directive summary
        const modeLabel = testMode ? " [MODO TEST]" : "";
        const directiveSummary = `${modeLabel}Directriz activa: idiomas ${directive.languages.join(", ")}, niveles ${directive.levels.join(", ")}, ${directive.topics.length > 0 ? "temas " + directive.topics.join(", ") : "todos los temas"}, ${directive.storiesPerSlot} historias por slot. Budget: max ${budget.maxStoriesPerRun} historias, ${budget.maxLLMCallsPerRun} LLM calls, ${budget.maxRunDurationMinutes} min.`;
        send({
          step: "directive",
          status: "completed",
          detail: directiveSummary,
          data: {
            languages: directive.languages,
            levels: directive.levels,
            topics: directive.topics,
            storiesPerSlot: directive.storiesPerSlot,
            note: directive.note,
            testMode,
            budget,
          },
        });

        // Determine parameters: use body overrides if provided, otherwise use directive
        const scope = body.scope ?? "full";
        const contentLimit = testMode
          ? Math.min(6, budget.maxStoriesPerRun)
          : Math.min(body.contentLimit ?? budget.maxStoriesPerRun, budget.maxStoriesPerRun);
        const concurrency = body.concurrency ?? 3;

        // Use body params if explicitly provided, else fall back to directive
        const languages = body.language ? [body.language] : directive.languages;
        const variant = body.variant ?? undefined;
        const journeyTopic = body.journeyTopic ?? undefined;

        // ── Step 0.5: Bootstrap new languages ──
        // If the directive includes languages that don't have curriculum plans,
        // create the journey structure by copying from the most complete language.
        send({ step: "bootstrap", status: "running", detail: `Verificando estructura para: ${languages.join(", ")}...` });
        try {
          const { bootstrapped, skipped } = await bootstrapNewLanguages(
            languages,
            directive.levels,
            testMode ? 1 : directive.storiesPerSlot,
          );

          if (bootstrapped.length > 0) {
            send({
              step: "bootstrap",
              status: "completed",
              detail: `Estructura de journey creada para: ${bootstrapped.join(", ")}. ${skipped.length > 0 ? `Ya existía: ${skipped.join(", ")}.` : ""}`,
              data: { bootstrapped, skipped },
            });
          } else {
            send({
              step: "bootstrap",
              status: "completed",
              detail: "Todos los idiomas ya tienen estructura de journey.",
              data: { bootstrapped: [], skipped },
            });
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          send({ step: "bootstrap", status: "failed", detail: `Error creando estructura: ${msg}` });
          // Continue anyway — planner will just find no gaps for new languages
        }

        // ── Step 1: Planner ──
        send({ step: "planner", status: "running", detail: "Analizando catálogo..." });

        // Run planner for each language in directive
        let totalGapsFound = 0;
        let totalBriefsCreated = 0;
        let lastPlanResult: any = null;

        for (const lang of languages) {
          // Resolve language name to the form used in curriculum plans
          const resolved = LANG_TO_VARIANT[lang.toLowerCase()];
          const language = resolved?.language ?? lang;
          const resolvedVariant = variant ?? resolved?.variant;

          const planResult = await runPlannerAgent({
            mode: "gaps",
            scope,
            language,
            variant: resolvedVariant,
            journeyTopic,
          });
          totalGapsFound += planResult.output.gapsFound;
          totalBriefsCreated += planResult.output.briefsCreated;
          lastPlanResult = planResult;
        }

        // In test mode, mark all new briefs
        if (testMode && totalBriefsCreated > 0) {
          await (prisma as any).$executeRawUnsafe(
            `UPDATE dp_curriculum_briefs_v1 SET brief = jsonb_set(COALESCE(brief, '{}'::jsonb), '{isTest}', 'true') WHERE status = 'draft' AND brief->>'isTest' IS NULL`
          );
        }

        send({
          step: "planner",
          status: "completed",
          detail: `Analizadas ${languages.length} idiomas. ${totalGapsFound} gaps encontrados, ${totalBriefsCreated} briefs creados.`,
          data: {
            lastRunId: lastPlanResult?.runId,
            totalGapsFound,
            totalBriefsCreated,
            languagesProcessed: languages,
          },
        });

        // ── planOnly: stop after planning ──
        if (body.planOnly === true) {
          send({ step: "done", status: "completed", detail: `Plan completo. ${totalBriefsCreated} briefs listos para generar topic por topic.` });
          controller.close();
          return;
        }

        // ── Budget check before content generation ──
        const preContentCheck = checkBudget(counter);
        if (preContentCheck.exceeded) {
          send({ step: "budget-exhausted", status: "completed", detail: preContentCheck.reason, data: budgetSummary(counter) });
          send({ step: "done", status: "completed", detail: "Pipeline detenido por presupuesto.", data: budgetSummary(counter) });
          controller.close();
          return;
        }

        // ── Step 2: Content (parallel) ──
        const briefs = await (prisma as any).curriculumBrief.findMany({
          where: { status: "draft" },
          orderBy: { createdAt: "asc" },
          take: contentLimit,
        });

        if (briefs.length === 0) {
          send({ step: "content", status: "skipped", detail: "No hay briefs en estado draft." });
        } else {
          send({ step: "content", status: "running", detail: `Generando ${briefs.length} historias (concurrency: ${concurrency})...` });
          const briefIds = briefs.map((b: any) => b.id as string);
          const results = await runContentAgentParallel(briefIds, concurrency);
          const okCount = results.filter((r) => r.result?.output.draftId).length;
          const failCount = results.filter((r) => r.error || !r.result?.output.draftId).length;
          const draftIds = results
            .filter((r) => r.result?.output.draftId)
            .map((r) => r.result!.output.draftId!);

          // Track budget: 3 LLM calls per successful story (text + vocab + synopsis)
          counter.llmCalls += okCount * 3;
          counter.stories += okCount;

          // In test mode, mark all generated drafts
          if (testMode && draftIds.length > 0) {
            for (const draftId of draftIds) {
              try {
                const draft = await (prisma as any).storyDraft.findUnique({ where: { id: draftId } });
                if (draft) {
                  const meta = (draft.metadata ?? {}) as Record<string, any>;
                  await (prisma as any).storyDraft.update({
                    where: { id: draftId },
                    data: { metadata: { ...meta, isTest: true } },
                  });
                }
              } catch { /* non-critical */ }
            }
          }

          send({
            step: "content",
            status: "completed",
            detail: `${okCount} generadas, ${failCount} fallidas.`,
            data: { ok: okCount, fail: failCount, draftIds, ...budgetSummary(counter) },
          });

          // ── Budget check before QA ──
          const preQACheck = checkBudget(counter);
          if (preQACheck.exceeded) {
            send({ step: "budget-exhausted", status: "completed", detail: preQACheck.reason, data: budgetSummary(counter) });
            send({ step: "done", status: "completed", detail: "Pipeline detenido por presupuesto.", data: budgetSummary(counter) });
            controller.close();
            return;
          }

          // ── Step 3: QA on new drafts ──
          if (draftIds.length === 0) {
            send({ step: "qa", status: "skipped", detail: "No hay drafts para validar." });
          } else {
            send({ step: "qa", status: "running", detail: `Validando ${draftIds.length} drafts...` });
            let pass = 0, fail = 0, review = 0;
            const failedDraftIds: string[] = [];

            for (const draftId of draftIds) {
              try {
                const qaResult = await runDraftQaAgent(draftId, { enableLLMQA: budget.enableLLMQA });
                // Track: 1 LLM call per QA if LLM QA is enabled
                if (budget.enableLLMQA) counter.llmCalls++;
                if (qaResult.output.status === "pass") pass++;
                else if (qaResult.output.status === "fail") {
                  fail++;
                  failedDraftIds.push(draftId);
                } else review++;
              } catch {
                fail++;
              }
            }

            send({
              step: "qa",
              status: "completed",
              detail: `${pass} pass, ${review} review, ${fail} fail.`,
              data: { pass, review, fail, failedDraftIds, ...budgetSummary(counter) },
            });

            // ── Step 4: Auto-retry failed QA ──
            if (budget.autoRetryQA && failedDraftIds.length > 0) {
              // Budget check before retrying
              const preRetryCheck = checkBudget(counter);
              if (preRetryCheck.exceeded) {
                send({ step: "retry", status: "skipped", detail: `Omitido: ${preRetryCheck.reason}` });
              } else {
                send({ step: "retry", status: "running", detail: `Regenerando ${failedDraftIds.length} drafts que fallaron QA...` });
                let retryOk = 0, retryFail = 0;

                for (const draftId of failedDraftIds) {
                  // Check budget before each retry
                  const midRetryCheck = checkBudget(counter);
                  if (midRetryCheck.exceeded) {
                    send({ step: "budget-exhausted", status: "completed", detail: midRetryCheck.reason, data: budgetSummary(counter) });
                    break;
                  }

                  try {
                    const regenResult = await regenerateFromQA(draftId, { maxRetries: budget.maxRetriesPerStory });
                    // 3 LLM calls for regeneration (text + vocab + synopsis)
                    counter.llmCalls += 3;
                    if (regenResult.output.draftId) {
                      // Mark regenerated draft as test too
                      if (testMode) {
                        try {
                          const reDraft = await (prisma as any).storyDraft.findUnique({ where: { id: regenResult.output.draftId } });
                          if (reDraft) {
                            const meta = (reDraft.metadata ?? {}) as Record<string, any>;
                            await (prisma as any).storyDraft.update({
                              where: { id: regenResult.output.draftId },
                              data: { metadata: { ...meta, isTest: true } },
                            });
                          }
                        } catch { /* non-critical */ }
                      }
                      const reQA = await runDraftQaAgent(regenResult.output.draftId, { enableLLMQA: budget.enableLLMQA });
                      if (budget.enableLLMQA) counter.llmCalls++;
                      if (reQA.output.status === "pass") retryOk++;
                      else retryFail++;
                    } else {
                      retryFail++;
                    }
                  } catch {
                    retryFail++;
                  }
                }

                send({
                  step: "retry",
                  status: "completed",
                  detail: `${retryOk} recuperados, ${retryFail} siguen fallando.`,
                  data: { retryOk, retryFail, ...budgetSummary(counter) },
                });
              }
            }

            // ── Step 5: Auto-promote drafts ──
            try {
              send({ step: "promote", status: "running", detail: "Promoviendo drafts aprobados por QA..." });
              const promoted = await autoPromoteDrafts({ minScore: budget.minQAScore });

              if (promoted.length === 0) {
                send({
                  step: "promote",
                  status: "skipped",
                  detail: `No hay drafts con puntuación >= ${budget.minQAScore} para promover.`,
                  data: { promoted: [] },
                });
              } else {
                send({
                  step: "promote",
                  status: "completed",
                  detail: `${promoted.length} historias promovidas a estado "approved".`,
                  data: { promoted },
                });
              }

              // ── Step 6: Auto-publish to Sanity ──
              if (testMode) {
                // In test mode, do NOT auto-publish — leave as approved for review
                send({
                  step: "publish",
                  status: "skipped",
                  detail: "Modo test: historias aprobadas pero NO publicadas a Sanity. Revisar en Borradores.",
                  data: { promoted, testMode: true },
                });
              } else if (promoted.length > 0) {
                send({ step: "publish", status: "running", detail: "Publicando a Sanity CMS..." });
                const publishedIds: string[] = [];
                const errors: Array<{ draftId: string; error: string }> = [];

                for (const draftId of promoted) {
                  const result = await publishDraftToSanity(draftId);
                  if (result.success) {
                    publishedIds.push(draftId);
                  } else {
                    errors.push({ draftId, error: result.error || "Error desconocido" });
                  }
                }

                const detail = errors.length === 0
                  ? `${publishedIds.length} historias publicadas.`
                  : `${publishedIds.length} publicadas, ${errors.length} fallidas.`;

                send({
                  step: "publish",
                  status: errors.length === promoted.length ? "failed" : "completed",
                  detail,
                  data: { publishedIds, errors: errors.length > 0 ? errors : undefined },
                });
              } else {
                send({
                  step: "publish",
                  status: "skipped",
                  detail: "No hay historias promovidas para publicar.",
                });
              }
            } catch (error) {
              const msg = error instanceof Error ? error.message : String(error);
              send({ step: "promote", status: "failed", detail: `Error en auto-promote: ${msg}` });
            }
          }
        }

        send({
          step: "done",
          status: "completed",
          detail: testMode
            ? "Pipeline test completo. Revisar drafts en Borradores antes de publicar."
            : "Pipeline completo. Historias publicadas en Sanity CMS.",
          data: budgetSummary(counter),
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        send({ step: "error", status: "failed", detail: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
