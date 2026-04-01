import { prisma } from "@/lib/prisma";
import { getRuleForLevel } from "@/agents/config/pedagogicalConfig";
import { buildContentPromptContext, type CEFRLevel } from "@/agents/config/pedagogicalConfig";
import { chatCompletion, extractJSON, getProvider } from "@/agents/config/llmProvider";

// Load a brief from the database
export async function loadBrief(briefId: string): Promise<any> {
  const brief = await (prisma as any).curriculumBrief.findUnique({
    where: { id: briefId },
  });
  if (!brief) throw new Error(`Brief ${briefId} not found`);
  return brief;
}

// Generate a slug from title and metadata
export function generateSlug(
  title: string,
  language: string,
  variant: string,
  slot: number
): string {
  const titleSlug = title
    .toLowerCase()
    .replace(/[áéíóúñ]/g, (char) => {
      const map: Record<string, string> = { á: "a", é: "e", í: "i", ó: "o", ú: "u", ñ: "n" };
      return map[char] || char;
    })
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const languageSlug = language.toLowerCase();
  const variantSlug = variant.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  return `${titleSlug}-${languageSlug}-${variantSlug}-${slot}`;
}

function sanitizeText(input: string): string {
  return input
    .replace(/\r\n?/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, " ")
    .replace(/\\"/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── LLM-powered story generation ──

export async function generateStoryWithLLM(params: {
  title: string;
  language: string;
  level: string;
  topic: string;
  journeyFocus: string;
  variant?: string;
  qaFeedback?: string;
}): Promise<{ text: string; title: string }> {
  const rule = getRuleForLevel(params.level);
  const pedagogicalContext = buildContentPromptContext(
    params.level as CEFRLevel,
    params.language,
    params.topic
  );

  const variantClause = params.variant
    ? `Write in the ${params.variant} variant of ${params.language}.`
    : "";

  const feedbackClause = params.qaFeedback
    ? `\n\n## Previous QA Feedback (fix these issues):\n${params.qaFeedback}`
    : "";

  const prompt = `${pedagogicalContext}

## Additional Requirements
- Story title suggestion: "${params.title}" (you may improve it)
- Journey focus: ${params.journeyFocus}
${variantClause}
- Write the story entirely in ${params.language}. Do NOT write in English.
- Wrap each paragraph in <blockquote> tags.
- Use a close third-person narrator with internal focalization.
- Keep paragraphs short and dynamic (1-3 sentences).
- Include dialogue to keep pacing lively.
${feedbackClause}

Return ONLY valid JSON with this exact structure:
{
  "title": "string (story title in ${params.language})",
  "text": "string (full story text with <blockquote> paragraphs)"
}`;

  const raw = await chatCompletion(
    [
      {
        role: "system",
        content:
          "You are an expert language teacher and creative story writer for language learners. You always return valid JSON.",
      },
      { role: "user", content: prompt },
    ],
    { temperature: 0.8, maxTokens: 3000 }
  );

  if (!raw) throw new Error(`${getProvider()} returned no content`);

  const parsed = extractJSON<{ title: string; text: string }>(raw);

  return {
    title: parsed.title?.trim() || params.title,
    text: sanitizeText(parsed.text || ""),
  };
}

// ── LLM-powered vocabulary extraction ──

export async function generateVocabFromText(params: {
  text: string;
  language: string;
  level: string;
  topic: string;
}): Promise<Array<{ word: string; translation: string; type: string; example?: string }>> {
  const rule = getRuleForLevel(params.level);
  const minItems = rule?.vocabDensity.minItems ?? 8;
  const maxItems = rule?.vocabDensity.maxItems ?? 20;

  const prompt = `Analyze the following ${params.language} story and extract the ${minItems}-${maxItems} most pedagogically valuable vocabulary items for a ${params.level.toUpperCase()} learner.

## Story text:
${params.text.slice(0, 3000)}

## Requirements:
- Extract ${minItems}-${maxItems} vocabulary items
- Each item must actually appear in the story text
- Prefer: useful verbs, culturally specific terms, key expressions, and level-appropriate words
- Avoid: basic cognates, articles, pronouns, numbers
- "word" should be the dictionary/root form
- "translation" should be a clear English definition (8-15 words), not a one-word gloss
- "type" should be one of: verb, noun, adjective, adverb, expression
- "example" should be a short example sentence using the word in context

Return ONLY a valid JSON array:
[{ "word": "string", "translation": "string", "type": "string", "example": "string" }]`;

  const raw = await chatCompletion(
    [
      {
        role: "system",
        content:
          "You are a vocabulary extraction specialist for language learning. You always return valid JSON arrays.",
      },
      { role: "user", content: prompt },
    ],
    { temperature: 0.3, maxTokens: 2000 }
  );

  if (!raw) return [];

  try {
    const parsed = extractJSON<unknown>(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item: any) => item.word && item.translation && item.type
    );
  } catch {
    return [];
  }
}

// ── Synopsis generation ──

export async function generateSynopsis(params: {
  title: string;
  text: string;
  language: string;
}): Promise<string> {
  const raw = await chatCompletion(
    [
      {
        role: "system",
        content:
          "You write brief, engaging story synopses for language learners. Write in the same language as the story.",
      },
      {
        role: "user",
        content: `Write a 1-2 sentence synopsis for this ${params.language} story titled "${params.title}":\n\n${params.text.slice(0, 1500)}`,
      },
    ],
    { temperature: 0.3, maxTokens: 200 }
  );

  return raw || "";
}

// ── Content safety filter ──

const UNSAFE_PATTERNS = [
  /\b(kill|murder|suicide|self[- ]?harm)\b/i,
  /\b(drug|cocaine|heroin|meth|marijuana)\b/i,
  /\b(sex|nude|naked|erotic|porn)\b/i,
  /\b(gun|weapon|bomb|explosive)\b/i,
  /\b(racist|racial\s+slur|hate\s+speech)\b/i,
  /\b(terror|terrorist|extremis)\b/i,
];

export type SafetyCheckResult = {
  safe: boolean;
  flags: string[];
};

/**
 * Check generated content for unsafe patterns.
 * This is a fast regex-based pre-filter. The LLM QA agent provides deeper analysis.
 */
export function checkContentSafety(text: string, title: string): SafetyCheckResult {
  const combined = `${title} ${text}`;
  const flags: string[] = [];

  for (const pattern of UNSAFE_PATTERNS) {
    const match = combined.match(pattern);
    if (match) {
      flags.push(`Detected unsafe pattern: "${match[0]}"`);
    }
  }

  return { safe: flags.length === 0, flags };
}

// ── Pre-QA validation (fast structural checks before saving) ──

export type PreQAResult = {
  pass: boolean;
  issues: string[];
};

/**
 * Quick structural validation before persisting a draft.
 * Catches obvious problems early so we don't waste a QA cycle.
 */
export function preQAValidation(params: {
  text: string;
  vocab: Array<{ word: string; translation: string; type: string }>;
  level: string;
  title: string;
}): PreQAResult {
  const issues: string[] = [];
  const words = params.text.split(/\s+/).filter(Boolean).length;

  // Minimum word count by level
  const minWords: Record<string, number> = {
    a1: 80, a2: 120, b1: 200, b2: 300, c1: 400, c2: 500,
  };
  const min = minWords[params.level.toLowerCase()] ?? 100;
  if (words < min * 0.7) {
    issues.push(`Story too short: ${words} words (minimum ~${min} for ${params.level.toUpperCase()})`);
  }

  // Minimum vocab items
  if (params.vocab.length < 3) {
    issues.push(`Too few vocab items: ${params.vocab.length} (need at least 3)`);
  }

  // Title must not be empty
  if (!params.title.trim()) {
    issues.push("Title is empty");
  }

  // Text must contain actual content (not just HTML tags)
  const textOnly = params.text.replace(/<[^>]+>/g, "").trim();
  if (textOnly.length < 50) {
    issues.push("Story text appears to contain only markup or is too short");
  }

  return { pass: issues.length === 0, issues };
}

// Save a story draft to the database
export async function saveStoryDraft(params: {
  briefId: string;
  sourceRunId: string;
  title: string;
  slug: string;
  text: string;
  synopsis: string;
  vocab: any;
  metadata: any;
}): Promise<string> {
  const draft = await (prisma as any).storyDraft.create({
    data: {
      briefId: params.briefId,
      sourceRunId: params.sourceRunId,
      title: params.title,
      slug: params.slug,
      text: params.text,
      synopsis: params.synopsis,
      vocab: params.vocab ?? [],
      metadata: params.metadata ?? {},
      status: "draft",
    },
  });
  return draft.id;
}
