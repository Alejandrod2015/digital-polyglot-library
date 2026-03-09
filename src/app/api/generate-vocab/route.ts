import { NextResponse } from "next/server";
import OpenAI from "openai";
import { isInvalidMultiwordVocab, normalizeToken, splitWordTokens } from "@/lib/vocabSelection";

type VocabItem = {
  word: string;
  definition: string;
  type?: string;
};

type GenerateVocabBody = {
  text?: string;
  language?: string;
  level?: string;
  focus?: string;
  topic?: string;
  minItems?: number;
  maxItems?: number;
};

const DISCOURAGED_VOCAB_BY_LANGUAGE: Record<string, Set<string>> = {
  spanish: new Set([
    "importante",
    "normal",
    "general",
    "social",
    "natural",
    "especial",
    "popular",
    "formal",
    "local",
    "real",
    "personal",
  ]),
  german: new Set([
    "wichtig",
    "normal",
    "allgemein",
    "sozial",
    "naturlich",
    "speziell",
    "lokal",
    "real",
    "personlich",
  ]),
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

function toIntInRange(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  const rounded = Math.round(value);
  return Math.max(min, Math.min(max, rounded));
}

function computeDynamicVocabRange(text: string): { minItems: number; maxItems: number } {
  const words = wordCount(text);
  const target = Math.max(14, Math.min(28, Math.round(words / 24)));
  const minItems = Math.max(12, Math.min(24, target));
  const maxItems = Math.max(minItems, Math.min(32, target + 4));
  return { minItems, maxItems };
}

function clampItems(items: VocabItem[], minItems: number, maxItems: number): VocabItem[] {
  if (items.length > maxItems) return items.slice(0, maxItems);
  return items;
}

function computeSoftMinimum(minItems: number): number {
  return Math.max(10, minItems - 3);
}

function wordCount(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function hasDetailedDefinition(definition: string): boolean {
  const wc = wordCount(definition);
  return wc >= 6 && wc <= 18;
}

function isLikelyDirectTranslation(definition: string): boolean {
  const normalized = definition.trim().toLowerCase();
  const wc = wordCount(normalized);
  if (!normalized) return true;
  if (wc <= 2) return true;
  if (/^to\s+[a-z][a-z'\-\s]*$/i.test(normalized) && wc <= 4) return true;
  if (/^(a|an|the)\s+[a-z][a-z'\-\s]*$/i.test(normalized) && wc <= 4) return true;
  if (/^[a-z][a-z'\-]*$/i.test(normalized)) return true;
  const firstClause = normalized.split(/[,:;—-]/, 1)[0]?.trim() ?? "";
  const firstClauseWords = wordCount(firstClause);
  if (
    /[,:;—-]/.test(normalized) &&
    firstClauseWords > 0 &&
    firstClauseWords <= 4 &&
    (/^to\s+[a-z][a-z'\-\s]*$/i.test(firstClause) ||
      /^(a|an|the)\s+[a-z][a-z'\-\s]*$/i.test(firstClause) ||
      /^[a-z][a-z'\-\s]*$/i.test(firstClause))
  ) {
    return true;
  }
  return false;
}

function hasPedagogicalDefinition(definition: string): boolean {
  return hasDetailedDefinition(definition) && !isLikelyDirectTranslation(definition);
}

function isDiscouragedTransparentWord(word: string, language: string): boolean {
  const discouraged = DISCOURAGED_VOCAB_BY_LANGUAGE[normalizeToken(language)];
  if (!discouraged) return false;
  const tokens = splitWordTokens(word);
  return tokens.length > 0 && tokens.every((token) => discouraged.has(token));
}

function normalizeDefinition(definition: string): string {
  const compact = definition
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([.!?])(?:\s*[.!?]){1,}$/g, "$1")
    .trim();
  if (!compact) return compact;
  return compact[0].toUpperCase() + compact.slice(1);
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function appearsInText(text: string, phrase: string): boolean {
  const clean = phrase.trim();
  if (!clean) return false;
  const pattern = new RegExp(
    `(^|[^\\p{L}\\p{N}_])${escapeRegex(clean)}(?=$|[^\\p{L}\\p{N}_])`,
    "iu"
  );
  return pattern.test(text);
}

function normalizeVocab(raw: unknown, normalizedText: string, language?: string): VocabItem[] {
  const rows = Array.isArray(raw) ? raw : [];
  const output: VocabItem[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    const word = typeof record.word === "string" ? record.word.trim() : "";
    const rawDefinition =
      typeof record.definition === "string"
        ? record.definition.trim()
        : typeof record.meaning === "string"
          ? record.meaning.trim()
          : "";
    const definition = normalizeDefinition(rawDefinition);
    const type = typeof record.type === "string" ? record.type.trim() : undefined;
    if (!word || !definition) continue;
    if (!appearsInText(normalizedText, word)) continue;
    const key = word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (language && isDiscouragedTransparentWord(word, language)) continue;
    if (isInvalidMultiwordVocab(word, { type, storyText: normalizedText })) continue;
    output.push({ word, definition, ...(type ? { type } : {}) });
  }

  return output;
}

function mergeVocab(base: VocabItem[], incoming: VocabItem[]): VocabItem[] {
  const seen = new Set(base.map((item) => item.word.toLowerCase()));
  const next = [...base];
  for (const item of incoming) {
    const key = item.word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(item);
  }
  return next;
}

function replaceDefinitions(base: VocabItem[], rewritten: VocabItem[]): VocabItem[] {
  const rewrittenByKey = new Map(rewritten.map((item) => [item.word.toLowerCase(), item] as const));
  return base.map((item) => rewrittenByKey.get(item.word.toLowerCase()) ?? item);
}

function extractCandidateWords(text: string, max = 500): string[] {
  const matches = text.match(/[\p{L}][\p{L}\p{M}\-']*/gu) ?? [];
  const counts = new Map<string, number>();
  for (const token of matches) {
    const clean = token.trim();
    if (!clean) continue;
    if (clean.length < 3) continue;
    const lower = clean.toLowerCase();
    counts.set(lower, (counts.get(lower) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([token]) => token);
}

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

async function requestVocabFromModel(args: {
  text: string;
  language: string;
  level: string;
  focus: string;
  topic: string;
  minItems: number;
  maxItems: number;
  candidates?: string[];
  detailedDefinitions?: boolean;
}): Promise<VocabItem[]> {
  const {
    text,
    language,
    level,
    focus,
    topic,
    minItems,
    maxItems,
    candidates = [],
    detailedDefinitions = true,
  } = args;
  const hasCandidates = candidates.length > 0;
  const candidateBlock = hasCandidates
    ? `\nUse ONLY words/phrases from this exact candidate list:\n${candidates.join(", ")}\n`
    : "";
  const prompt = `
You extract study vocabulary from language-learning stories.

Task:
- Return ONLY a JSON array.
- Extract between ${minItems} and ${maxItems} useful words/phrases from the story.
- Prioritize this focus: "${focus}".
- Story language: ${language}.
- Learner level: ${level}.
- Story topic/context: ${topic || "general"}.
- Each item must have:
  - "word": exact form as it appears in the story text
  - "definition": ${
    detailedDefinitions
      ? "clear English explanation with 6-18 words, including nuance or typical usage in context"
      : "concise English definition"
  }
  - "type": one label among ["verb","noun","adjective","expression","slang","other"]
- Prefer high-learning-value items (contextual, frequent, reusable, idiomatic when relevant).
- Do not include duplicates.
- Avoid ultra-generic items unless they are essential to the story meaning.
- Strongly prefer short fixed expressions, nuanced verbs, and culturally grounded phrases over obvious cognates.
- Avoid transparent international/basic items such as "importante", "normal", "general", "social", or their direct equivalents unless part of a fixed expression.
- Single words are preferred.
- If you return more than one word, it must be a short lexicalized expression or idiom (usually 2-3 words).
- Any multi-word item MUST use type "expression".
- Good examples: "de repente", "por fin", "al menos".
- Bad examples: "con cada ensayo", "buenos momentos", "manos temblando", "sazonar correctamente", "mostrar lo que somos", "llenaba de emoción".
- Start each definition with a capital letter.
- Definitions must explain usage/nuance, not just translate the word.
- Definitions must not begin with a literal gloss followed by a comma or colon.
${candidateBlock}
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: "You are a precise vocabulary extraction assistant. Output valid JSON only.",
      },
      {
        role: "user",
        content: `${prompt}\n\nStory:\n${text}`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content?.trim();
  if (!content) throw new Error("Empty response from model.");
  const parsed = parseModelResponse(content);
  return normalizeVocab(parsed, text, language);
}

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
    }

    let body: GenerateVocabBody = {};
    try {
      body = (await req.json()) as GenerateVocabBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const rawText = typeof body.text === "string" ? body.text : "";
    const text = stripHtml(rawText);
    if (!text || text.length < 120) {
      return NextResponse.json(
        { error: "Story text is too short. Add more content before generating vocabulary." },
        { status: 400 }
      );
    }

    const language = typeof body.language === "string" && body.language.trim() ? body.language : "Spanish";
    const level = typeof body.level === "string" && body.level.trim() ? body.level : "intermediate";
    const focus = typeof body.focus === "string" && body.focus.trim() ? body.focus : "verbs";
    const topic = typeof body.topic === "string" ? body.topic.trim() : "";
    const dynamicRange = computeDynamicVocabRange(text);
    const hasCustomMin = typeof body.minItems === "number" && Number.isFinite(body.minItems);
    const hasCustomMax = typeof body.maxItems === "number" && Number.isFinite(body.maxItems);
    const minItems = hasCustomMin
      ? toIntInRange(body.minItems, dynamicRange.minItems, 10, 40)
      : dynamicRange.minItems;
    const maxItems = hasCustomMax
      ? toIntInRange(body.maxItems, dynamicRange.maxItems, minItems, 45)
      : Math.max(minItems, dynamicRange.maxItems);

    let vocab = await requestVocabFromModel({
      text,
      language,
      level,
      focus,
      topic,
      minItems,
      maxItems,
      detailedDefinitions: true,
    });
    vocab = vocab.filter(
      (item) =>
        !isDiscouragedTransparentWord(item.word, language) &&
        !isInvalidMultiwordVocab(item.word, { type: item.type, storyText: text })
    );

    const lowQualityDefinitions = vocab.filter((item) => !hasPedagogicalDefinition(item.definition)).length;
    if (vocab.length < minItems || lowQualityDefinitions > Math.floor(vocab.length * 0.35)) {
      // Fallback pass constrained to exact words found in text, helps verbs/slang alignment.
      const candidates = extractCandidateWords(text, 450);
      const refill = await requestVocabFromModel({
        text,
        language,
        level,
        focus: `${focus} (strictly provide at least ${minItems} high-value items; prioritize concrete verbs, nouns, adjectives, and only short fixed expressions when clearly useful)`,
        topic,
        minItems,
        maxItems,
        candidates,
        detailedDefinitions: true,
      });
      vocab = mergeVocab(vocab, refill);
      vocab = vocab.filter(
        (item) =>
          !isDiscouragedTransparentWord(item.word, language) &&
          !isInvalidMultiwordVocab(item.word, { type: item.type, storyText: text })
      );
    }

    if (vocab.length < minItems) {
      // Second refill focused on missing amount.
      const remainingMin = Math.max(5, minItems - vocab.length);
      const remainingMax = Math.max(remainingMin, maxItems - vocab.length + 5);
      const candidates = extractCandidateWords(text, 500).filter(
        (token) => !vocab.some((item) => item.word.toLowerCase() === token.toLowerCase())
      );
      const refill = await requestVocabFromModel({
        text,
        language,
        level,
        focus: `${focus} (fill missing items with practical, reusable vocabulary; prefer strong single words over weak expressions)`,
        topic,
        minItems: remainingMin,
        maxItems: remainingMax,
        candidates,
        detailedDefinitions: true,
      });
      vocab = mergeVocab(vocab, refill);
      vocab = vocab.filter(
        (item) =>
          !isDiscouragedTransparentWord(item.word, language) &&
          !isInvalidMultiwordVocab(item.word, { type: item.type, storyText: text })
      );
    }

    // Prefer richer definitions if the model returned ultra-short glosses.
    const lowQualityCount = vocab.filter((item) => !hasPedagogicalDefinition(item.definition)).length;
    if (lowQualityCount > 0) {
      const enrichPrompt = `
Rewrite the "definition" of each item in clear English.
Rules:
- Keep the same "word" and "type".
- Definition must be 6-18 words.
- Explain practical meaning in context, not a one-word gloss.
- DO NOT translate directly. Avoid outputs like "to go", "cheese", "to smile".
- Do not begin with a direct gloss plus comma/colon, like "To change, ..." or "Important, ...".
- Mention how the word is typically used or what nuance it carries.
- Start each definition with a capital letter.
Return ONLY valid JSON array with same items.
`;
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.2,
        messages: [
          { role: "system", content: "You rewrite vocabulary definitions. Output JSON only." },
          { role: "user", content: `${enrichPrompt}\n\n${JSON.stringify(vocab)}` },
        ],
      });
      const content = response.choices[0]?.message?.content?.trim();
      if (content) {
        const rewritten = normalizeVocab(parseModelResponse(content), text, language);
        if (rewritten.length > 0) {
          vocab = replaceDefinitions(vocab, rewritten);
        }
      }
    }

    const stillLowQuality = vocab.filter((item) => !hasPedagogicalDefinition(item.definition)).length;
    if (stillLowQuality > 0) {
      const badItems = vocab.filter((item) => !hasPedagogicalDefinition(item.definition));
      const strictPrompt = `
Rewrite ONLY these low-quality definitions.
Rules:
- Keep same "word" and "type".
- Each definition must be 8-18 words.
- Explain meaning in English with context/usage nuance.
- Never return direct translation equivalents.
- Never begin with a direct gloss plus comma/colon.
- Start each definition with a capital letter.
Return ONLY valid JSON array.
`;
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.2,
        messages: [
          { role: "system", content: "You rewrite definitions for pedagogy. Output JSON only." },
          { role: "user", content: `${strictPrompt}\n\n${JSON.stringify(badItems)}` },
        ],
      });
      const content = response.choices[0]?.message?.content?.trim();
      if (content) {
        const rewritten = normalizeVocab(parseModelResponse(content), text, language);
        if (rewritten.length > 0) {
          vocab = replaceDefinitions(vocab, rewritten);
        }
      }
    }

    const lowQualityVocab = vocab.filter((item) => !hasPedagogicalDefinition(item.definition));
    if (lowQualityVocab.length > 0) {
      vocab = vocab.filter((item) => hasPedagogicalDefinition(item.definition));
    }

    vocab = clampItems(vocab, minItems, maxItems);

    if (vocab.length < minItems) {
      const remainingMin = Math.max(4, minItems - vocab.length);
      const remainingMax = Math.max(remainingMin, Math.min(maxItems, vocab.length + remainingMin + 4));
      const candidates = extractCandidateWords(text, 550).filter(
        (token) => !vocab.some((item) => item.word.toLowerCase() === token.toLowerCase())
      );
      const rescue = await requestVocabFromModel({
        text,
        language,
        level,
        focus: `${focus} (final rescue pass, prioritize concrete and reusable vocabulary; avoid abstract cognates and avoid expressions unless clearly lexicalized)`,
        topic,
        minItems: remainingMin,
        maxItems: remainingMax,
        candidates,
        detailedDefinitions: true,
      });
      vocab = mergeVocab(vocab, rescue).filter(
        (item) =>
          hasPedagogicalDefinition(item.definition) &&
          !isDiscouragedTransparentWord(item.word, language) &&
          !isInvalidMultiwordVocab(item.word, { type: item.type, storyText: text })
      );
      vocab = clampItems(vocab, minItems, maxItems);
    }

    const softMinItems = computeSoftMinimum(minItems);
    if (vocab.length < softMinItems) {
      return NextResponse.json(
        {
          error: `Could not extract enough high-quality vocabulary (target: ${minItems}, minimum usable: ${softMinItems}).`,
          generatedCount: vocab.length,
          filteredLowQualityCount: lowQualityVocab.length,
          vocab,
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      vocab,
      generatedCount: vocab.length,
      filteredLowQualityCount: lowQualityVocab.length,
      relaxedMinimumApplied: vocab.length < minItems,
      minimumUsableItems: softMinItems,
      focus,
      minItems,
      maxItems,
      recommendedMinItems: dynamicRange.minItems,
      recommendedMaxItems: dynamicRange.maxItems,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in POST /api/generate-vocab:", error);
    return NextResponse.json({ error: "Failed to generate vocabulary", details: message }, { status: 500 });
  }
}
