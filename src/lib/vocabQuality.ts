import OpenAI from "openai";

export type VocabItem = {
  word: string;
  surface?: string;
  definition: string;
  type?: string;
};

function wordCount(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function hasDetailedDefinition(definition: string): boolean {
  return wordCount(definition) >= 17;
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

export function hasPedagogicalDefinition(definition: string): boolean {
  return hasDetailedDefinition(definition) && !isLikelyDirectTranslation(definition);
}

export function normalizeVocab(raw: unknown): VocabItem[] {
  const rows = Array.isArray(raw) ? raw : [];
  const output: VocabItem[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    const word = typeof record.word === "string" ? record.word.trim() : "";
    const surface = typeof record.surface === "string" ? record.surface.trim() : "";
    const definition =
      typeof record.definition === "string"
        ? record.definition.trim()
        : typeof record.meaning === "string"
          ? record.meaning.trim()
          : "";
    const type = typeof record.type === "string" ? record.type.trim() : undefined;
    if (!word || !definition) continue;
    const key = word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push({ word, ...(surface ? { surface } : {}), definition, ...(type ? { type } : {}) });
  }

  return output;
}

function parseModelJson(content: string): unknown {
  const trimmed = content.trim();
  const maybeFence = trimmed.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(maybeFence) as unknown;
  } catch {
    const start = maybeFence.indexOf("[");
    const end = maybeFence.lastIndexOf("]");
    if (start >= 0 && end > start) {
      return JSON.parse(maybeFence.slice(start, end + 1)) as unknown;
    }
    throw new Error("Model did not return valid JSON.");
  }
}

function replaceDefinitions(base: VocabItem[], rewritten: VocabItem[]): VocabItem[] {
  const rewrittenByKey = new Map(rewritten.map((item) => [item.word.toLowerCase(), item] as const));
  return base.map((item) => rewrittenByKey.get(item.word.toLowerCase()) ?? item);
}

export async function improveVocabDefinitions(
  openai: OpenAI,
  args: {
    items: VocabItem[];
    language: string;
    level: string;
    focus: string;
    topic: string;
    text: string;
  }
): Promise<VocabItem[]> {
  const { items, language, level, focus, topic, text } = args;
  let vocab = normalizeVocab(items);
  if (vocab.length === 0) return vocab;

  const lowQualityCount = vocab.filter((item) => !hasPedagogicalDefinition(item.definition)).length;
  if (lowQualityCount === 0) return vocab;

  const enrichPrompt = `
Rewrite the "definition" of each item in clear English for language learners.
Context:
- Story language: ${language}
- Learner level: ${level}
- Focus: ${focus}
- Topic: ${topic || "general"}
- Story excerpt: ${text.slice(0, 1200)}

Rules:
- Keep exactly the same "word" and preserve "type" when present.
- Keep exactly the same "surface" when present.
- Definition must be 17-25 words minimum.
- Explain practical meaning/usage nuance in context, not one-word gloss.
- NEVER return direct translation equivalents.
- NEVER start with a literal gloss followed by punctuation, such as "To change, ..." or "Important, ...".
- Start directly with an explanation such as "Used to...", "Describes...", "Refers to...", or "Said when...".
- Return ONLY a valid JSON array with objects: { "word", "surface?", "definition", "type?" }.
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: "You rewrite vocabulary definitions for pedagogy. Output JSON only." },
        { role: "user", content: `${enrichPrompt}\n\n${JSON.stringify(vocab)}` },
      ],
    });
    const content = response.choices[0]?.message?.content?.trim();
    if (content) {
      const rewritten = normalizeVocab(parseModelJson(content));
      if (rewritten.length > 0) vocab = replaceDefinitions(vocab, rewritten);
    }
  } catch (error) {
    console.warn("[vocab] first rewrite pass failed", error);
  }

  const stillLowQuality = vocab.filter((item) => !hasPedagogicalDefinition(item.definition));
  if (stillLowQuality.length === 0) return vocab;

  const strictPrompt = `
Rewrite ONLY these low-quality definitions.
Rules:
- Keep same "word", "surface" when present, and "type".
- Each definition must be 17-25 words minimum.
- Explain meaning in English with usage nuance from the story context.
- Never return direct translation equivalents.
- Never begin with a direct gloss plus comma/colon.
- Return ONLY valid JSON array.
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: "You rewrite definitions for pedagogy. Output JSON only." },
        { role: "user", content: `${strictPrompt}\n\n${JSON.stringify(stillLowQuality)}` },
      ],
    });
    const content = response.choices[0]?.message?.content?.trim();
    if (content) {
      const rewritten = normalizeVocab(parseModelJson(content));
      if (rewritten.length > 0) vocab = replaceDefinitions(vocab, rewritten);
    }
  } catch (error) {
    console.warn("[vocab] strict rewrite pass failed", error);
  }

  return vocab;
}
