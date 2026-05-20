import OpenAI from "openai";

export type VocabItem = {
  word: string;
  surface?: string;
  definition: string;
  type?: string;
  priority?: number;
};

function wordCount(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function hasDetailedDefinition(definition: string): boolean {
  const wc = wordCount(definition);
  return wc >= 6 && wc <= 16;
}

const MULETILLA_OPENERS: RegExp[] = [
  /^refers\s+to\b/i,
  /^describes?\b/i,
  /^used\s+(to|for|in|as|when)\b/i,
  /^means?\b/i,
  /^meaning\b/i,
  /^conveys?\b/i,
  /^speaks?\s+to\b/i,
  /^brings?\b/i,
  /^this\s+word\b/i,
  /^a\s+type\s+of\b/i,
  /^a\s+person\s+who\b/i,
  /^someone\s+who\b/i,
  /^something\s+that\b/i,
  /^the\s+(action|state|quality)\s+of\b/i,
];

function hasMuletillaOpener(definition: string): boolean {
  const trimmed = definition.trim();
  return MULETILLA_OPENERS.some((re) => re.test(trimmed));
}

// Catches "translation in disguise" patterns where the first clause is just a
// gloss followed by an explanatory clause:
//   "Silence; the active quiet..."           single word
//   "A book; bound printed pages..."         article + noun
//   "To work; to do a job..."                infinitive
//   "Cheese (m); commonly bought..."         gloss + parenthetical gender
//   "A book (n); printed pages..."           article + noun + parenthetical
const LEADING_GLOSS_PATTERNS: RegExp[] = [
  /^[A-Za-z][A-Za-z'\-]*[;,:]/,
  /^[A-Za-z][A-Za-z'\-]*\s*\([^)]*\)\s*[;,:]/,
  /^(A|An|The|To)\s+[A-Za-z'\-]+[;,:]/i,
  /^(A|An|The|To)\s+[A-Za-z'\-]+\s*\([^)]*\)\s*[;,:]/i,
];

function hasLeadingOneWordGloss(definition: string): boolean {
  const trimmed = definition.trim();
  return LEADING_GLOSS_PATTERNS.some((re) => re.test(trimmed));
}

function hasEmDash(definition: string): boolean {
  return /—/.test(definition);
}

// Pragmatic detector for "this definition is not in English" without depending
// on a language-detection library. Catches the two common failure modes:
//   1) Heavy use of accented characters typical of Spanish / German / French /
//      Italian / Portuguese (ñ, ü, ß, é, etc.)
//   2) A definition of 15+ words that contains none of the ubiquitous English
//      function words/lead-ins the prompt asks the model to use.
// A single loan word like "Frühstück" inside an otherwise English sentence will
// not trip the first heuristic. A definition written entirely in e.g. German
// will trip both.
function looksNotInEnglish(definition: string): boolean {
  const text = definition.trim();
  if (!text) return false;
  const nonAsciiLetterCount = (text.match(/[À-ÿ]/g) ?? []).length;
  const letterCount = (text.match(/[A-Za-zÀ-ÿ]/g) ?? []).length;
  if (letterCount > 0 && nonAsciiLetterCount / letterCount >= 0.06) {
    return true;
  }
  const wc = wordCount(text);
  if (wc < 6) return false;
  const lower = ` ${text.toLowerCase()} `;
  const englishMarkers = [
    " the ", " a ", " an ", " to ", " of ", " in ", " on ", " is ", " are ",
    " was ", " were ", " be ", " used ", " means ", " refers ", " describes ",
    " something ", " someone ", " when ", " how ", " expresses ", " indicates ",
    " said ", " often ", " usually ", " typically ", " without ", " with ",
    " for ", " about ", " who ", " that ", " this ",
  ];
  const hasAnyMarker = englishMarkers.some((marker) => lower.includes(marker));
  return !hasAnyMarker;
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
  return (
    hasDetailedDefinition(definition) &&
    !isLikelyDirectTranslation(definition) &&
    !hasMuletillaOpener(definition) &&
    !hasLeadingOneWordGloss(definition) &&
    !hasEmDash(definition) &&
    !looksNotInEnglish(definition)
  );
}

export const __testing__ = {
  hasDetailedDefinition,
  hasMuletillaOpener,
  hasLeadingOneWordGloss,
  hasEmDash,
  isLikelyDirectTranslation,
};

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
    const priorityRaw = record.priority;
    const priority =
      typeof priorityRaw === "number" && priorityRaw >= 1 && priorityRaw <= 3
        ? Math.round(priorityRaw)
        : undefined;
    if (!word || !definition) continue;
    const key = word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push({
      word,
      ...(surface ? { surface } : {}),
      definition,
      ...(type ? { type } : {}),
      ...(priority ? { priority } : {}),
    });
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
  return base.map((item) => {
    const r = rewrittenByKey.get(item.word.toLowerCase());
    if (!r) return item;
    return { ...item, definition: r.definition };
  });
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
- HARD LIMIT: each definition must be 3-7 English words AND no more than 50 characters total (counting spaces). Both bounds are mandatory; the chip cannot wrap.
- Style: concise gloss in the spirit of a translation app (Linguee/Reverso). Lead with the noun/concept, an infinitive ("To stir..."), or a descriptive adjective phrase. Two senses joined by ";" or "," are fine.
- Never use em-dashes; use semicolons, colons, commas, or parentheses instead.
- Never return a bare one-word literal translation ("Idea", "Stir"); add one clarifying word or sense ("An idea or concept", "To stir gently").
- Never write long descriptive paraphrases that exceed the limits.
- Return ONLY a valid JSON array with objects: { "word", "surface?", "definition", "type?" }.
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: "You rewrite vocabulary definitions for pedagogy. CRITICAL: every definition MUST be in English, never in the target language. Output JSON only." },
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
- HARD LIMIT: 3-7 English words AND ≤50 characters total per definition. Both bounds mandatory.
- Style: concise gloss, like a translation app. Lead with the concept, an infinitive ("To stir"), or an adjective phrase.
- Never use em-dashes; use semicolons, colons, commas, parentheses.
- Never return a bare one-word translation; add one clarifying word.
- Return ONLY valid JSON array.
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: "You rewrite vocabulary definitions for pedagogy. CRITICAL: every definition MUST be in English, never in the target language. Output JSON only." },
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
