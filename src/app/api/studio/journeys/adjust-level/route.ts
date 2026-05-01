import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { isStudioMember } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";
import { auditStoryVocabularyLevel, type LevelAuditResult } from "@/lib/storyLevelAudit";

export const maxDuration = 90;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const MAX_ITERATIONS = 3;

type Replacement = { from: string; to: string };

function buildAdjustPrompt(args: { text: string; wordsToAvoid: string[]; language: string; cefrLabel: string }): string {
  const { text, wordsToAvoid, language, cefrLabel } = args;
  return `
You are editing a ${language} story for a CEFR ${cefrLabel} learner.

The story below is good as a whole, but it uses some words ABOVE level ${cefrLabel}. Your job is a MINIMAL surgical edit: rewrite ONLY the sentences that contain those words, replacing them with simpler equivalents at or below ${cefrLabel}. Keep the rest of the story BYTE-IDENTICAL.

Words to remove (each one is above level ${cefrLabel}): ${wordsToAvoid.join(", ")}

Hard rules:
- Keep the same <blockquote>...</blockquote> structure exactly as in the input.
- Keep character names, places, and proper nouns unchanged.
- Do NOT change the title (it is not part of the input below anyway).
- Do NOT shorten or summarize. Maintain the same approximate length.
- Do NOT rewrite sentences that don't contain any offender word.
- When a single offender word can't be replaced 1-to-1 (e.g. an idiom or a verb with no simple synonym), reformulate the sentence concretely using basic words at or below ${cefrLabel}.
- CRITICAL: Do NOT introduce new words above ${cefrLabel} when you reformulate. The replacement words must themselves be ${cefrLabel} or simpler. If you cannot find a ${cefrLabel}-or-below replacement, prefer a longer concrete description with basic words over a single fancy synonym.
- Output the FULL story text (every paragraph), not just the changed sentences.

ALSO: keep track of every replacement you make. Use short fragments — single words when 1-to-1, short phrases when reformulating. Ignore punctuation tweaks.

STORY:
${text}

Return ONLY valid JSON of this shape:
{
  "text": "<full rewritten story body, all paragraphs, preserving <blockquote> tags>",
  "replacements": [
    { "from": "<original surface fragment>", "to": "<rewritten surface fragment>" }
  ]
}
No commentary, no markdown fences, no extra fields.
`;
}

async function callAdjustLLM(args: {
  text: string;
  wordsToAvoid: string[];
  language: string;
  cefrLabel: string;
}): Promise<{ text: string; replacements: Replacement[] }> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.3,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: `You perform minimal surgical edits on ${args.language} stories for CEFR alignment. You preserve everything that doesn't need changing. Output JSON only.` },
      { role: "user", content: buildAdjustPrompt(args) },
    ],
  });
  const raw = response.choices[0]?.message?.content?.trim() ?? "";
  if (!raw) return { text: "", replacements: [] };

  try {
    const parsed = JSON.parse(raw) as { text?: unknown; replacements?: unknown };
    const text = typeof parsed.text === "string" ? parsed.text.trim() : "";
    const replacements: Replacement[] = Array.isArray(parsed.replacements)
      ? parsed.replacements
          .filter((r): r is { from: string; to: string } =>
            r != null && typeof r === "object"
            && typeof (r as { from?: unknown }).from === "string"
            && typeof (r as { to?: unknown }).to === "string")
          .map((r) => ({ from: r.from.trim(), to: r.to.trim() }))
          .filter((r) => r.from.length > 0 && r.from !== r.to)
      : [];
    return { text, replacements };
  } catch {
    return { text: raw, replacements: [] };
  }
}

/**
 * POST /api/studio/journeys/adjust-level
 * Body: { storyId, wordsToAvoid: string[] }
 *
 * Surgical lexical edit with internal convergence loop. Each iteration:
 *   1. Ask the LLM to rewrite the text avoiding the current seed list.
 *   2. Re-audit the rewrite holistically.
 *   3. If the audit SCORE strictly improves, keep the rewrite and feed
 *      the new highlights back as the next seed list.
 *   4. Stop on near-perfect score, regression/plateau, or after
 *      MAX_ITERATIONS.
 *
 * The result is guaranteed to have a strictly higher (or equal) score
 * than the original. If the very first iteration regresses, the story
 * is left UNCHANGED and the response carries `noImprovement: true`.
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email || !(await isStudioMember(email)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: Record<string, unknown> = {};
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const storyId = typeof body.storyId === "string" ? body.storyId : "";
  if (!storyId) return NextResponse.json({ error: "storyId required" }, { status: 400 });
  const initialWordsToAvoid = Array.isArray(body.wordsToAvoid)
    ? body.wordsToAvoid.filter((w): w is string => typeof w === "string" && w.trim().length > 0)
    : [];
  if (initialWordsToAvoid.length === 0) {
    return NextResponse.json({ error: "wordsToAvoid required" }, { status: 400 });
  }

  const story = await prisma.journeyStory.findUnique({
    where: { id: storyId },
    include: { journey: true },
  });
  if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });
  if (!story.text) return NextResponse.json({ error: "Story has no text yet" }, { status: 400 });

  const cefrLabel = story.level.toUpperCase();
  const language = story.journey.language;

  // Baseline audit: needed to compare scores across iterations.
  const baselineAudit = await auditStoryVocabularyLevel({
    text: story.text,
    language,
    cefrLevel: story.level,
  });

  let candidateText = story.text;
  let candidateWordsToAvoid = initialWordsToAvoid;
  let bestText = story.text;
  let bestScore = baselineAudit.score;
  let bestAudit: LevelAuditResult = baselineAudit;
  const accumulatedReplacements: Replacement[] = [];
  const iterationsLog: { iteration: number; scoreBefore: number; scoreAfter: number; replacementCount: number }[] = [];

  try {
    for (let i = 0; i < MAX_ITERATIONS; i += 1) {
      if (candidateWordsToAvoid.length === 0) break;
      // Already at near-perfect — nothing left to gain.
      if (bestScore >= 95) break;

      const { text: rewritten, replacements } = await callAdjustLLM({
        text: candidateText,
        wordsToAvoid: candidateWordsToAvoid,
        language,
        cefrLabel,
      });
      if (!rewritten) break;

      const audit = await auditStoryVocabularyLevel({
        text: rewritten,
        language,
        cefrLevel: story.level,
      });

      iterationsLog.push({
        iteration: i + 1,
        scoreBefore: bestScore,
        scoreAfter: audit.score,
        replacementCount: replacements.length,
      });

      // Strict score improvement required to accept the iteration.
      if (audit.score > bestScore) {
        bestText = rewritten;
        bestScore = audit.score;
        bestAudit = audit;
        accumulatedReplacements.push(...replacements);
        if (audit.score >= 95 || audit.highlights.length === 0) break;
        // Feed remaining highlights into the next iteration.
        candidateText = rewritten;
        candidateWordsToAvoid = audit.highlights.map((h) => h.word);
      } else {
        // Regression or plateau — stop and keep the best so far.
        break;
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg, iterations: iterationsLog }, { status: 500 });
  }

  // Nothing improved over the original — leave the DB untouched.
  if (bestText === story.text) {
    return NextResponse.json({
      id: story.id,
      text: story.text,
      wordCount: story.wordCount,
      replacements: [],
      noImprovement: true,
      iterations: iterationsLog,
    });
  }

  const wordCount = bestText.split(/\s+/).filter(Boolean).length;
  const updated = await prisma.journeyStory.update({
    where: { id: storyId },
    data: {
      text: bestText,
      wordCount,
      auditScore: bestAudit.score,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      auditOffenders: { summary: bestAudit.summary, highlights: bestAudit.highlights } as any,
      auditedAt: new Date(),
    },
  });

  return NextResponse.json({
    id: updated.id,
    text: updated.text,
    wordCount: updated.wordCount,
    replacements: accumulatedReplacements,
    audit: bestAudit,
    iterations: iterationsLog,
  });
}
