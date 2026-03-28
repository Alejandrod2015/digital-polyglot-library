import { prisma } from "@/lib/prisma";
import {
  loadBrief,
  generateSlug,
  generateStoryWithLLM,
  generateVocabFromText,
  generateSynopsis,
  saveStoryDraft,
} from "@/agents/content/tools";
import { persistAgentRun, updateAgentRunOutput } from "@/lib/agentPersistence";
import { loadPedagogicalRules } from "@/agents/config/pedagogicalConfig";
import type { ContentAgentOutput, ContentAgentRun } from "@/agents/content/types";

/**
 * Regenerate a story draft using QA feedback.
 * Loads the original brief + QA findings, then generates a new draft
 * with the feedback injected into the LLM prompt.
 */
export async function regenerateFromQA(
  draftId: string
): Promise<ContentAgentRun & { runId: string }> {
  const startedAt = new Date().toISOString();

  try {
    await loadPedagogicalRules();

    // 1. Load the failed draft and its QA review
    const draft = await (prisma as any).storyDraft.findUnique({
      where: { id: draftId },
    });
    if (!draft) throw new Error(`Draft ${draftId} not found`);

    const qaReview = await (prisma as any).qaReview.findFirst({
      where: { sourceStoryId: draftId },
      orderBy: { createdAt: "desc" },
    });

    // 2. Build QA feedback string from findings
    let qaFeedback = "";
    if (qaReview?.report) {
      const report = qaReview.report as {
        findings?: Array<{
          severity: string;
          title: string;
          message: string;
          suggestion?: string;
        }>;
      };
      if (report.findings && report.findings.length > 0) {
        qaFeedback = report.findings
          .filter((f) => f.severity === "critical" || f.severity === "warning")
          .map(
            (f) =>
              `- [${f.severity.toUpperCase()}] ${f.title}: ${f.message}${
                f.suggestion ? ` → ${f.suggestion}` : ""
              }`
          )
          .join("\n");
      }
    }

    // 3. Load the original brief for metadata
    const meta = (draft.metadata ?? {}) as Record<string, any>;
    const briefId = draft.briefId;
    let brief: any = null;
    if (briefId) {
      try {
        brief = await loadBrief(briefId);
      } catch {
        /* brief may have been deleted */
      }
    }

    const language = brief?.language ?? meta.language ?? "";
    const variant = brief?.variant ?? meta.variant ?? "";
    const level = brief?.level ?? meta.level ?? "";
    const topic = brief?.topicSlug ?? meta.journeyTopic ?? "";
    const journeyFocus = brief?.journeyFocus ?? meta.journeyFocus ?? "General";
    const storySlot = brief?.storySlot ?? meta.storySlot ?? 1;
    const title = draft.title ?? "";

    // 4. Regenerate with QA feedback
    const slug = generateSlug(title, language, variant, storySlot);
    const generated = await generateStoryWithLLM({
      title,
      language,
      level,
      topic,
      journeyFocus,
      variant,
      qaFeedback: qaFeedback || undefined,
    });

    const text = generated.text;
    const newTitle = generated.title || title;

    const vocab = await generateVocabFromText({
      text,
      language,
      level,
      topic,
    });

    const synopsis = await generateSynopsis({
      title: newTitle,
      text,
      language,
    });

    const wordCount = text.split(/\s+/).filter(Boolean).length;
    const completedAt = new Date().toISOString();

    const input = {
      briefId: briefId ?? draftId,
      language,
      variant,
      level,
      journeyTopic: topic,
      storySlot,
      journeyFocus,
      title: newTitle,
      briefDescription: `Regeneración desde QA. Draft original: ${draftId}`,
    };

    // 5. Persist run
    const runId = await persistAgentRun({
      agentKind: "content",
      status: "completed",
      input: {
        ...input,
        regeneratedFrom: draftId,
        qaFeedback,
      } as unknown as Record<string, unknown>,
      output: null,
      toolsUsed: [
        "loadDraft",
        "loadQAReview",
        "generateStoryWithLLM",
        "generateVocabFromText",
        "generateSynopsis",
        "saveStoryDraft",
      ],
      startedAt,
      completedAt,
    });

    // 6. Save new draft
    const newDraftId = await saveStoryDraft({
      briefId: briefId ?? "",
      sourceRunId: runId,
      title: newTitle,
      slug,
      text,
      synopsis,
      vocab,
      metadata: {
        language,
        variant,
        level,
        journeyTopic: topic,
        journeyFocus,
        storySlot,
        regeneratedFrom: draftId,
      },
    });

    // 7. Mark old draft as superseded
    try {
      await (prisma as any).storyDraft.update({
        where: { id: draftId },
        data: { status: "qa_fail" },
      });
    } catch {
      /* non-critical */
    }

    const output: ContentAgentOutput = {
      status: "generated",
      draftId: newDraftId,
      title: newTitle,
      slug,
      synopsis,
      textPreview: text.slice(0, 200),
      wordCount,
      vocabItemCount: vocab.length,
      summary: `Regenerado desde QA. Nuevo draft "${newTitle}" (${wordCount} palabras, ${vocab.length} vocab). Original: ${draftId}.`,
    };

    await updateAgentRunOutput(
      runId,
      output as unknown as Record<string, unknown>
    );

    return {
      runId,
      agent: "content",
      status: "completed",
      startedAt,
      completedAt,
      input: input as any,
      output,
      toolsUsed: [
        {
          toolName: "loadDraft",
          summary: `Cargó draft ${draftId} y su QA review.`,
        },
        {
          toolName: "generateStoryWithLLM",
          summary: `Regeneró historia con feedback de QA.`,
        },
        {
          toolName: "generateVocabFromText",
          summary: `Extrajo ${vocab.length} items de vocabulario.`,
        },
        {
          toolName: "saveStoryDraft",
          summary: `Guardó nuevo draft ${newDraftId}.`,
        },
      ],
    };
  } catch (error) {
    const completedAt = new Date().toISOString();
    const errorMessage = error instanceof Error ? error.message : String(error);

    const runId = await persistAgentRun({
      agentKind: "content",
      status: "failed",
      input: {
        draftId,
        regeneration: true,
      } as unknown as Record<string, unknown>,
      output: null,
      errorMessage,
      toolsUsed: [],
      startedAt,
      completedAt,
    });

    return {
      runId,
      agent: "content",
      status: "failed",
      startedAt,
      completedAt,
      input: { briefId: draftId } as any,
      output: {
        status: "failed",
        draftId: null,
        title: "",
        slug: "",
        synopsis: "",
        textPreview: "",
        wordCount: 0,
        vocabItemCount: 0,
        summary: `Fallo al regenerar draft ${draftId}: ${errorMessage}`,
      },
      toolsUsed: [],
    };
  }
}
