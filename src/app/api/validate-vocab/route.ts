import { NextResponse } from "next/server";
import OpenAI from "openai";
import { buildSanityCorsHeaders } from "@/lib/sanityCors";
import {
  computeDynamicVocabRange,
  computeSoftMinimum,
  stripHtml,
  validateAndNormalizeVocab,
  type VocabItem,
  type VocabValidationIssue,
} from "@/lib/vocabValidation";

type ValidateVocabBody = {
  text?: string;
  language?: string;
  level?: string;
  cefrLevel?: string;
  vocab?: unknown;
  minItems?: number;
  maxItems?: number;
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

function parseModelResponse(content: string): unknown {
  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    const start = trimmed.indexOf("[");
    const end = trimmed.lastIndexOf("]");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1)) as unknown;
    }
    throw new Error("Model did not return valid JSON.");
  }
}

async function repairWeakDefinitions(args: {
  vocab: unknown;
  text: string;
  language?: string;
}): Promise<VocabItem[]> {
  const prompt = `
Rewrite the definition of each vocabulary item into strong learner-friendly English.

Rules:
- Keep the same "word", preserve "surface" when present, and keep "type".
- Return ONLY a JSON array.
- Each "definition" must be 6-18 words.
- Explain practical meaning or usage nuance.
- Do NOT use one-word glosses.
- Do NOT start with a direct translation followed by comma or colon.
- Keep the word itself unchanged.
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    messages: [
      { role: "system", content: "You rewrite vocabulary definitions. Output valid JSON only." },
      {
        role: "user",
        content: `${prompt}\n\nLanguage: ${args.language ?? "Spanish"}\nStory text:\n${args.text}\n\nVocabulary:\n${JSON.stringify(args.vocab)}`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content?.trim();
  if (!content) return [];
  const parsed = parseModelResponse(content);
  return Array.isArray(parsed) ? (parsed as VocabItem[]) : [];
}

function mergeRepairedVocab(original: unknown, repaired: VocabItem[]): unknown[] {
  const base = Array.isArray(original) ? original : [];
  const repairedByWord = new Map(repaired.map((item) => [item.word.toLowerCase(), item] as const));
  return base.map((row) => {
    if (!row || typeof row !== "object") return row;
    const record = row as Record<string, unknown>;
    const word = typeof record.word === "string" ? record.word : "";
    const replacement = repairedByWord.get(word.toLowerCase());
    if (!replacement) return row;
    return {
      ...record,
      definition: replacement.definition,
      ...(replacement.type ? { type: replacement.type } : {}),
    };
  });
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  const corsHeaders = buildSanityCorsHeaders(origin);

  try {
    let body: ValidateVocabBody = {};
    try {
      body = (await req.json()) as ValidateVocabBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers: corsHeaders });
    }

    const text = stripHtml(typeof body.text === "string" ? body.text : "");
    if (!text || text.length < 120) {
      return NextResponse.json(
        { error: "Story text is too short to validate vocabulary." },
        { status: 400, headers: corsHeaders }
      );
    }

    const dynamicRange = computeDynamicVocabRange(text);
    const minItems =
      typeof body.minItems === "number" && Number.isFinite(body.minItems)
        ? Math.max(10, Math.min(40, Math.round(body.minItems)))
        : dynamicRange.minItems;
    const maxItems =
      typeof body.maxItems === "number" && Number.isFinite(body.maxItems)
        ? Math.max(minItems, Math.min(45, Math.round(body.maxItems)))
        : dynamicRange.maxItems;

    let initialRawVocab = body.vocab;
    let { vocab, issues } = validateAndNormalizeVocab({
      rawVocab: body.vocab,
      text,
      language: typeof body.language === "string" ? body.language : undefined,
      level: typeof body.level === "string" ? body.level : undefined,
      cefrLevel: typeof body.cefrLevel === "string" ? body.cefrLevel : undefined,
    });

    const weakDefinitionItems = Array.isArray(initialRawVocab)
      ? initialRawVocab.filter((row) => {
          if (!row || typeof row !== "object") return false;
          const record = row as Record<string, unknown>;
          const word = typeof record.word === "string" ? record.word : "";
          return issues.some(
            (issue: VocabValidationIssue) => issue.code === "weak_definition" && issue.word.toLowerCase() === word.toLowerCase()
          );
        })
      : [];

    if (weakDefinitionItems.length > 0 && process.env.OPENAI_API_KEY) {
      const repaired = await repairWeakDefinitions({
        vocab: weakDefinitionItems,
        text,
        language: typeof body.language === "string" ? body.language : undefined,
      });
      if (repaired.length > 0) {
        initialRawVocab = mergeRepairedVocab(initialRawVocab, repaired);
        const rerun = validateAndNormalizeVocab({
          rawVocab: initialRawVocab,
          text,
          language: typeof body.language === "string" ? body.language : undefined,
          level: typeof body.level === "string" ? body.level : undefined,
          cefrLevel: typeof body.cefrLevel === "string" ? body.cefrLevel : undefined,
        });
        vocab = rerun.vocab;
        issues = rerun.issues;
      }
    }

    const minimumUsableItems = computeSoftMinimum(minItems);
    const validationSummary = {
      valid: vocab.length >= minimumUsableItems,
      acceptedCount: vocab.length,
      rejectedCount: issues.length,
      minItems,
      maxItems,
      minimumUsableItems,
      issueBreakdown: issues.reduce<Record<string, number>>((acc, issue) => {
        acc[issue.code] = (acc[issue.code] ?? 0) + 1;
        return acc;
      }, {}),
    };

    const payload = {
      vocab: vocab.slice(0, maxItems) as VocabItem[],
      issues,
      validation: validationSummary,
    };

    if (vocab.length < minimumUsableItems) {
      return NextResponse.json(
        {
          ...payload,
          error: `Validated vocabulary fell below the minimum usable threshold (${minimumUsableItems}).`,
        },
        { status: 422, headers: corsHeaders }
      );
    }

    return NextResponse.json(payload, { headers: corsHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in POST /api/validate-vocab:", error);
    return NextResponse.json(
      { error: "Failed to validate vocabulary", details: message },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin");
  return new NextResponse(null, {
    status: 204,
    headers: buildSanityCorsHeaders(origin),
  });
}
