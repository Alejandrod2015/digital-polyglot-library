import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isStudioMember } from "@/lib/studio-access";
import { runPlannerAgent } from "@/agents/planner/agent";
import { runContentAgentParallel } from "@/agents/content/parallel";
import { runDraftQaAgent } from "@/agents/qa/agent";
import { regenerateFromQA } from "@/agents/content/regenerate";
import { loadDirective } from "@/agents/config/directive";
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

        // Build directive summary
        const directiveSummary = `Directriz activa: idiomas ${directive.languages.join(", ")}, niveles ${directive.levels.join(", ")}, ${directive.topics.length > 0 ? "temas " + directive.topics.join(", ") : "todos los temas"}, ${directive.storiesPerSlot} historias por slot.`;
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
          },
        });

        // Determine parameters: use body overrides if provided, otherwise use directive
        const scope = body.scope ?? "full";
        const contentLimit = body.contentLimit ?? 5;
        const concurrency = body.concurrency ?? 3;
        const autoRetryQA = body.autoRetryQA !== false;

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
            directive.storiesPerSlot,
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

          send({
            step: "content",
            status: "completed",
            detail: `${okCount} generadas, ${failCount} fallidas.`,
            data: { ok: okCount, fail: failCount, draftIds },
          });

          // ── Step 3: QA on new drafts ──
          if (draftIds.length === 0) {
            send({ step: "qa", status: "skipped", detail: "No hay drafts para validar." });
          } else {
            send({ step: "qa", status: "running", detail: `Validando ${draftIds.length} drafts...` });
            let pass = 0, fail = 0, review = 0;
            const failedDraftIds: string[] = [];

            for (const draftId of draftIds) {
              try {
                const qaResult = await runDraftQaAgent(draftId);
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
              data: { pass, review, fail, failedDraftIds },
            });

            // ── Step 4: Auto-retry failed QA ──
            if (autoRetryQA && failedDraftIds.length > 0) {
              send({ step: "retry", status: "running", detail: `Regenerando ${failedDraftIds.length} drafts que fallaron QA...` });
              let retryOk = 0, retryFail = 0;

              for (const draftId of failedDraftIds) {
                try {
                  const regenResult = await regenerateFromQA(draftId);
                  if (regenResult.output.draftId) {
                    const reQA = await runDraftQaAgent(regenResult.output.draftId);
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
                data: { retryOk, retryFail },
              });
            }

            // ── Step 5: Auto-promote drafts ──
            try {
              send({ step: "promote", status: "running", detail: "Promoviendo drafts aprobados por QA..." });
              const promoted = await autoPromoteDrafts({ minScore: 85 });

              if (promoted.length === 0) {
                send({
                  step: "promote",
                  status: "skipped",
                  detail: "No hay drafts con puntuación >= 85 para promover.",
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
              if (promoted.length > 0) {
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

        send({ step: "done", status: "completed", detail: "Pipeline completo. Historias publicadas en Sanity CMS." });
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
