import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isStudioMember } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";
import { runContentAgentParallel } from "@/agents/content/parallel";
import { runDraftQaAgent } from "@/agents/qa/agent";
import { regenerateFromQA } from "@/agents/content/regenerate";
import { autoPromoteDrafts, publishDraftToSanity } from "@/agents/publish/tools";
import { loadDirective, DEFAULT_BUDGET, type PipelineBudget } from "@/agents/config/directive";

/** Vercel Hobby allows up to 60s */
export const maxDuration = 60;

type StepEvent = {
  step: string;
  status: "running" | "completed" | "failed" | "skipped";
  detail?: string;
  data?: Record<string, unknown>;
};

/**
 * POST /api/studio/pipeline/generate-topic
 *
 * Generates stories for a single (level, topicSlug) combination.
 * Runs: Content Agent → QA → Retry → Promote → Publish
 * Covers are handled separately by the UI via /api/studio/pipeline/generate-cover.
 *
 * Body: { level: string, topicSlug: string }
 */
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
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { level, topicSlug } = body;
  if (!level || !topicSlug) {
    return NextResponse.json({ error: "level and topicSlug are required" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(step: StepEvent) {
        controller.enqueue(encoder.encode(JSON.stringify(step) + "\n"));
      }

      try {
        const directive = await loadDirective();
        const budget: PipelineBudget = { ...DEFAULT_BUDGET, ...directive.budget };

        // Fetch draft briefs for this topic+level
        const briefs = await (prisma as any).curriculumBrief.findMany({
          where: { level, topicSlug, status: "draft" },
          orderBy: { storySlot: "asc" },
          take: budget.maxStoriesPerRun,
        });

        if (briefs.length === 0) {
          send({ step: "content", status: "skipped", detail: `No hay briefs draft para ${level.toUpperCase()} > ${topicSlug}.` });
          send({ step: "done", status: "completed", detail: "Nada que generar." });
          controller.close();
          return;
        }

        // ── Content Agent ──
        send({ step: "content", status: "running", detail: `Generando ${briefs.length} historias para ${level.toUpperCase()} > ${topicSlug}...` });
        const briefIds = briefs.map((b: any) => b.id as string);
        const results = await runContentAgentParallel(briefIds, 3);
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

        if (draftIds.length === 0) {
          send({ step: "done", status: "completed", detail: "No se generaron drafts." });
          controller.close();
          return;
        }

        // ── QA ──
        send({ step: "qa", status: "running", detail: `Validando ${draftIds.length} drafts...` });
        let pass = 0, fail = 0, review = 0;
        const failedDraftIds: string[] = [];

        for (const draftId of draftIds) {
          try {
            const qaResult = await runDraftQaAgent(draftId, { enableLLMQA: budget.enableLLMQA });
            if (qaResult.output.status === "pass") pass++;
            else if (qaResult.output.status === "fail") { fail++; failedDraftIds.push(draftId); }
            else review++;
          } catch { fail++; }
        }

        send({
          step: "qa",
          status: "completed",
          detail: `${pass} pass, ${review} review, ${fail} fail.`,
          data: { pass, review, fail },
        });

        // ── Retry ──
        if (budget.autoRetryQA && failedDraftIds.length > 0) {
          send({ step: "retry", status: "running", detail: `Regenerando ${failedDraftIds.length} que fallaron QA...` });
          let retryOk = 0, retryFail = 0;

          for (const draftId of failedDraftIds) {
            try {
              const regen = await regenerateFromQA(draftId, { maxRetries: budget.maxRetriesPerStory });
              if (regen.output.draftId) {
                const reQA = await runDraftQaAgent(regen.output.draftId, { enableLLMQA: budget.enableLLMQA });
                if (reQA.output.status === "pass") retryOk++; else retryFail++;
              } else { retryFail++; }
            } catch { retryFail++; }
          }

          send({ step: "retry", status: "completed", detail: `${retryOk} recuperados, ${retryFail} siguen fallando.` });
        }

        // ── Promote ──
        const promoted = await autoPromoteDrafts({ minScore: budget.minQAScore });
        if (promoted.length > 0) {
          send({ step: "promote", status: "completed", detail: `${promoted.length} historias aprobadas.` });

          // ── Publish ──
          send({ step: "publish", status: "running", detail: "Publicando a Sanity CMS..." });
          let pubOk = 0, pubFail = 0;
          const publishedStories: Array<{ draftId: string; sanityId: string }> = [];
          for (const draftId of promoted) {
            const result = await publishDraftToSanity(draftId);
            if (result.success && result.sanityId) {
              pubOk++;
              publishedStories.push({ draftId, sanityId: result.sanityId });
            } else { pubFail++; }
          }
          send({
            step: "publish",
            status: pubFail === promoted.length ? "failed" : "completed",
            detail: `${pubOk} publicadas${pubFail > 0 ? `, ${pubFail} fallidas` : ""}.`,
            data: { publishedStories },
          });
        } else {
          send({ step: "promote", status: "skipped", detail: `No hay drafts con score >= ${budget.minQAScore}.` });
        }

        send({
          step: "done",
          status: "completed",
          detail: `Topic ${level.toUpperCase()} > ${topicSlug} completo.`,
          data: { level, topicSlug, generated: okCount, passed: pass, promoted: promoted.length },
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
