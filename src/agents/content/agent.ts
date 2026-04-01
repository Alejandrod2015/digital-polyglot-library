import type { ContentAgentInput, ContentAgentOutput, ContentAgentRun } from "@/agents/content/types";
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
import { agentLog, agentTimer } from "@/lib/agentLogger";

export async function runContentAgent(briefId: string): Promise<ContentAgentRun & { runId: string }> {
  const startedAt = new Date().toISOString();
  const totalTimer = agentTimer("content", "runContentAgent");

  try {
    // 0. Preload pedagogical rules from DB
    await loadPedagogicalRules();

    // 1. Load brief
    const briefTimer = agentTimer("content", "loadBrief");
    const brief = await loadBrief(briefId);
    briefTimer.end({ briefId });
    const briefData = brief.brief as Record<string, any>;

    const input: ContentAgentInput = {
      briefId,
      language: brief.language,
      variant: brief.variant,
      level: brief.level,
      journeyTopic: brief.topicSlug,
      storySlot: brief.storySlot,
      journeyFocus: brief.journeyFocus ?? "General",
      title: brief.title,
      briefDescription: briefData.description ?? "",
    };

    agentLog.info("content", "Starting content generation", {
      briefId,
      language: brief.language,
      level: brief.level,
      topic: brief.topicSlug,
    });

    // 2. Generate content with LLM
    const slug = generateSlug(brief.title, brief.language, brief.variant, brief.storySlot);

    const storyTimer = agentTimer("content", "generateStoryWithLLM");
    const generated = await generateStoryWithLLM({
      title: brief.title,
      language: brief.language,
      level: brief.level,
      topic: brief.topicSlug,
      journeyFocus: brief.journeyFocus ?? "General",
      variant: brief.variant,
    });
    const storyMs = storyTimer.end({ charCount: generated.text.length });

    const text = generated.text;
    const title = generated.title || brief.title;

    const vocabTimer = agentTimer("content", "generateVocabFromText");
    const vocab = await generateVocabFromText({
      text,
      language: brief.language,
      level: brief.level,
      topic: brief.topicSlug,
    });
    vocabTimer.end({ vocabCount: vocab.length });

    const synopsisTimer = agentTimer("content", "generateSynopsis");
    const synopsis = await generateSynopsis({
      title,
      text,
      language: brief.language,
    });
    synopsisTimer.end();

    const wordCount = text.split(/\s+/).filter(Boolean).length;

    // 2b. Content safety filter
    const safetyResult = checkContentSafety(text, title);
    if (!safetyResult.safe) {
      throw new Error(
        `Content safety check failed: ${safetyResult.flags.join("; ")}. ` +
        `The generated story contains potentially inappropriate content for language learners.`
      );
    }

    // 2c. Pre-QA structural validation
    const preQA = preQAValidation({ text, vocab, level: brief.level, title });
    if (!preQA.pass) {
      throw new Error(
        `Pre-QA validation failed: ${preQA.issues.join("; ")}. ` +
        `The generated content does not meet minimum quality standards.`
      );
    }

    const completedAt = new Date().toISOString();

    // 3. Persist run (before draft save, so we have a runId)
    const runId = await persistAgentRun({
      agentKind: "content",
      status: "completed",
      input: input as unknown as Record<string, unknown>,
      output: null, // will be updated after draft save
      toolsUsed: ["loadBrief", "generateSlug", "generateStoryWithLLM", "generateVocabFromText", "generateSynopsis", "saveStoryDraft"],
      startedAt,
      completedAt,
    });

    // 4. Save draft
    const draftId = await saveStoryDraft({
      briefId,
      sourceRunId: runId,
      title,
      slug,
      text,
      synopsis,
      vocab,
      metadata: {
        language: brief.language,
        variant: brief.variant,
        level: brief.level,
        journeyTopic: brief.topicSlug,
        journeyFocus: brief.journeyFocus,
        storySlot: brief.storySlot,
      },
    });

    const output: ContentAgentOutput = {
      status: "generated",
      draftId,
      title,
      slug,
      synopsis,
      textPreview: text.slice(0, 200),
      wordCount,
      vocabItemCount: vocab.length,
      summary: `Draft generado para "${title}" (${brief.level.toUpperCase()}, ${brief.language}). ${wordCount} palabras. Guardado como borrador pendiente de revisión.`,
    };

    // Update run with actual output
    await updateAgentRunOutput(runId, output as unknown as Record<string, unknown>);

    const totalMs = totalTimer.end({
      briefId,
      draftId,
      wordCount,
      vocabItemCount: vocab.length,
      level: brief.level,
      language: brief.language,
    });
    agentLog.info("content", `Draft generated successfully: "${title}"`, {
      runId,
      draftId,
      wordCount,
      vocabItemCount: vocab.length,
      durationMs: totalMs,
    });

    return {
      runId,
      agent: "content",
      status: "completed",
      startedAt,
      completedAt,
      input,
      output,
      toolsUsed: [
        { toolName: "loadBrief", summary: "Carga el brief curricular desde Prisma." },
        { toolName: "generateSlug", summary: "Genera un slug limpio para la historia." },
        {
          toolName: "generateStoryWithLLM",
          summary: "Genera el texto de la historia usando OpenAI basado en restricciones pedagógicas CEFR.",
        },
        {
          toolName: "generateVocabFromText",
          summary: "Extrae vocabulario pedagógico de la historia usando OpenAI.",
        },
        {
          toolName: "generateSynopsis",
          summary: "Genera una sinopsis breve de la historia usando OpenAI.",
        },
        { toolName: "saveStoryDraft", summary: "Guarda el borrador en Prisma." },
      ],
    };
  } catch (error) {
    const completedAt = new Date().toISOString();
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    agentLog.error("content", `Content generation failed: ${errorMessage}`, {
      briefId,
      durationMs: totalTimer.elapsed(),
    });

    // Persist failed run
    const runId = await persistAgentRun({
      agentKind: "content",
      status: "failed",
      input: { briefId } as unknown as Record<string, unknown>,
      output: null,
      errorMessage,
      toolsUsed: ["loadBrief"],
      startedAt,
      completedAt,
    });

    const output: ContentAgentOutput = {
      status: "failed",
      draftId: null,
      title: "",
      slug: "",
      synopsis: "",
      textPreview: "",
      wordCount: 0,
      vocabItemCount: 0,
      summary: `Fallo al generar draft: ${errorMessage}`,
    };

    return {
      runId,
      agent: "content",
      status: "failed",
      startedAt,
      completedAt,
      input: { briefId } as unknown as ContentAgentInput,
      output,
      toolsUsed: [
        { toolName: "loadBrief", summary: "Fallo al cargar el brief desde Prisma." },
      ],
    };
  }
}
