import { prisma } from "@/lib/prisma";
import {
  loadBrief,
  generateSlug,
  generateStoryWithLLM,
  generateVocabFromText,
  generateSynopsis,
  saveStoryDraft,
  checkContentSafety,
  preQAValidation,
} from "@/agents/content/tools";
import { persistAgentRun, updateAgentRunOutput } from "@/lib/agentPersistence";
import { loadPedagogicalRules } from "@/agents/config/pedagogicalConfig";
import type { ContentAgentOutput, ContentAgentRun } from "@/agents/content/types";

/** Maximum number of times a single draft can be regenerated to prevent infinite loops. */
const MAX_REGENERATION_ATTEMPTS = 2;

/**
 * Regenerate a story draft using QA feedback.
 * Loads the original brief + QA findings, then generates a new draft
 * with the feedback injected into the LLM prompt.
 */
export async function regenerateFromQA(
  draftId: string,
  options?: { maxRetries?: number }
): Promise<ContentAgentRun & { runId: string }> {
  const startedAt = new Date().toISOString();

  try {
    await loadPedagogicalRules();

    // 1. Load the failed draft and its QA review
    const draft = await (prisma as any).storyDraft.findUnique({
      where: { id: draftId },
    });
    if (!draft) throw new Error(`Draft ${draftId} not found`);

    const qaReview = await (prisma as any).qAReview.findFirst({
      where: { sourceStoryId: draftId },
      orderBy: { createdAt: "desc" },
    });

    // 1b. Check regeneration attempt count to prevent infinite loops
    const meta = (draft.metadata ?? {}) as Record<string, any>;
    const prevAttempts = (meta.regenerationAttempt as number) ?? 0;
    const maxRetries = options?.maxRetries ?? MAX_REGENERATION_ATTEMPTS;
    if (prevAttempts >= maxRetries) {
      throw new Error(
        `Draft ${draftId} has already been regenerated ${prevAttempts} times (max: ${maxRetries}). ` +
        `Manual review required.`
      );
    }

    // 2. Build structured QA feedback for better LLM comprehension
    let qaFeedback = "";
    if (qaReview?.report) {
      const report = qaReview.report as {
        findings?: Array<{
          code: string;
          severity: string;
          field: string;
          title: string;
          message: string;
          suggestion?: string;
        }>;
        score?: number;
      };
      if (report.findings && report.findings.length > 0) {
        const criticals = report.findings.filter((f) => f.severity === "critical");
        const warnings = report.findings.filter((f) => f.severity === "warning");

        const parts: string[] = [];
        if (report.score !== undefined) {
          parts.push(`Previous QA score: ${report.score}/100`);
        }
        if (criticals.length > 0) {
          parts.push(`\nCRITICAL issues (must fix):`);
          criticals.forEach((f) => {
            parts.push(`  • ${f.title}: ${f.message}`);
            if (f.suggestion) parts.push(`    Fix: ${f.suggestion}`);
          });
        }
        if (warnings.length > 0) {
          parts.push(`\nWARNING issues (should fix):`);
          warnings.forEach((f) => {
            parts.push(`  • ${f.title}: ${f.message}`);
            if (f.suggestion) parts.push(`    Fix: ${f.suggestion}`);
          });
        }
        qaFeedback = parts.join("\n");
      }
    }

    // 3. Load the original brief for metadata
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

    // 4b. Content safety filter
    const safetyResult = checkContentSafety(text, newTitle);
    if (!safetyResult.safe) {
      throw new Error(
        `Content safety check failed on regeneration: ${safetyResult.flags.join("; ")}`
      );
    }

    // 4c. Pre-QA structural validation
    const preQA = preQAValidation({ text, vocab, level, title: newTitle });
    if (!preQA.pass) {
      throw new Error(
        `Pre-QA validation failed on regeneration: ${preQA.issues.join("; ")}`
      );
    }

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
        regenerationAttempt: prevAttempts + 1,
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
