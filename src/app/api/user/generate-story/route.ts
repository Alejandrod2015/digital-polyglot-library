import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { PrismaClient } from "@/generated/prisma";
import slugify from "slugify";
import { generateAndUploadCover } from "@/lib/dalle";
import { inferTopicFromText } from "@/lib/topicClassifier";
import { improveVocabDefinitions } from "@/lib/vocabQuality";
import { isInvalidMultiwordVocab, normalizeToken, splitWordTokens } from "@/lib/vocabSelection";
import { resolveCanonicalVocabEntry } from "@/lib/vocabWordNormalization";
import {
  HARD_STORY_WORDS_MAX,
  MIN_STORY_WORDS,
  TARGET_STORY_WORDS_MAX,
  TARGET_STORY_WORDS_MIN,
  countStoryWords,
} from "@domain/storyLength";
import { broadLevelFromCefr, cefrPromptLabel, normalizeCefrLevel, normalizeBroadLevel } from "@domain/cefr";
import { buildVariantPromptClause, normalizeVariant } from "@/lib/languageVariant";
import { syncCreateStoryMirror } from "@/lib/createStoryMirror";
import {
  computeDynamicVocabRange,
  computeSoftMinimum,
  stripHtml,
  validateAndNormalizeVocab,
} from "@/lib/vocabValidation";
import { getMobileSessionFromRequest } from "@/lib/mobileSession";

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

type StoryJSON = {
  title: string;
  text: string;
  vocab: { word: string; surface?: string; definition: string; type?: string }[];
};

type StoryVocabItem = StoryJSON["vocab"][number];

const TARGET_VOCAB_ITEMS = 22;
const MIN_VOCAB_ITEMS_HARD = 8;
const MAX_GENERATION_ATTEMPTS = 3;
const TITLE_SIMILARITY_THRESHOLD = 0.82;
const UNIVERSAL_ANGLICISMS = new Set([
  "internet",
  "online",
  "email",
  "e-mail",
  "wifi",
  "wi-fi",
  "smartphone",
  "laptop",
  "marketing",
  "software",
  "hardware",
  "podcast",
  "streaming",
  "influencer",
  "hashtag",
  "startup",
  "feedback",
  "deadline",
  "meeting",
  "briefing",
  "chat",
  "coach",
  "shopping",
  "app",
  "apps",
]);

const SIMPLE_WORDS_BY_LANGUAGE: Record<string, Set<string>> = {
  spanish: new Set([
    "el",
    "la",
    "los",
    "las",
    "un",
    "una",
    "unos",
    "unas",
    "de",
    "del",
    "y",
    "o",
    "en",
    "con",
    "por",
    "para",
    "es",
    "son",
    "ser",
    "estar",
    "tener",
    "hacer",
    "ir",
    "muy",
    "bien",
    "mal",
    "casa",
    "día",
    "noche",
    "hola",
    "gracias",
  ]),
  french: new Set([
    "le",
    "la",
    "les",
    "un",
    "une",
    "des",
    "de",
    "du",
    "et",
    "ou",
    "dans",
    "avec",
    "pour",
    "est",
    "sont",
    "être",
    "avoir",
    "faire",
    "aller",
    "très",
    "bien",
    "bonjour",
    "merci",
  ]),
  german: new Set([
    "der",
    "die",
    "das",
    "ein",
    "eine",
    "und",
    "oder",
    "in",
    "mit",
    "für",
    "ist",
    "sind",
    "sein",
    "haben",
    "machen",
    "gehen",
    "sehr",
    "gut",
    "hallo",
    "danke",
  ]),
  italian: new Set([
    "il",
    "lo",
    "la",
    "i",
    "gli",
    "le",
    "un",
    "una",
    "e",
    "o",
    "di",
    "del",
    "in",
    "con",
    "per",
    "è",
    "sono",
    "essere",
    "avere",
    "fare",
    "andare",
    "molto",
    "bene",
    "ciao",
    "grazie",
  ]),
  portuguese: new Set([
    "o",
    "a",
    "os",
    "as",
    "um",
    "uma",
    "de",
    "do",
    "da",
    "e",
    "ou",
    "em",
    "com",
    "para",
    "é",
    "são",
    "ser",
    "estar",
    "ter",
    "fazer",
    "ir",
    "muito",
    "bem",
    "olá",
    "obrigado",
  ]),
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

function isValidStoryJSON(data: unknown): data is StoryJSON {
  return (
    typeof data === "object" &&
    data !== null &&
    typeof (data as StoryJSON).title === "string" &&
    typeof (data as StoryJSON).text === "string" &&
    Array.isArray((data as StoryJSON).vocab)
  );
}

// 🔹 Normaliza el HTML para mantener formato igual al de Sanity
function normalizeStoryHtml(html: string): string {
  // Envuelve cada bloque <blockquote> en <p> si no lo tiene
  const withParagraphs = html.replace(
    /<blockquote>([\s\S]*?)<\/blockquote>/gi,
    (_m, inner: string) => {
      const hasP = /<\s*p\b/i.test(inner);
      const wrapped = hasP ? inner : `<p>${inner.trim()}</p>`;
      return `<blockquote>${wrapped}</blockquote>`;
    }
  );

  // Si no hay blockquotes, garantiza que los párrafos estén dentro de <p>
  if (!withParagraphs.includes("<p>")) {
    const chunks = withParagraphs
      .split(/\n{2,}/)
      .map((c) => c.trim())
      .filter(Boolean)
      .map((c) => `<p>${c}</p>`);
    return chunks.join("");
  }

  return withParagraphs;
}

function stripLegacyVocabSpans(text: string): string {
  return text.replace(
    /<span\s+[^>]*class=['"]vocab-word['"][^>]*data-word=['"][^'"]+['"][^>]*>(.*?)<\/span>/giu,
    (_match: string, inner: string) => inner
  );
}

function normalizeComparableTitle(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getBigrams(value: string): Set<string> {
  const compact = value.replace(/\s+/g, " ");
  if (compact.length < 2) return new Set(compact ? [compact] : []);
  const bigrams = new Set<string>();
  for (let i = 0; i < compact.length - 1; i += 1) {
    bigrams.add(compact.slice(i, i + 2));
  }
  return bigrams;
}

function calculateTitleSimilarity(a: string, b: string): number {
  const normalizedA = normalizeComparableTitle(a);
  const normalizedB = normalizeComparableTitle(b);

  if (!normalizedA || !normalizedB) return 0;
  if (normalizedA === normalizedB) return 1;
  if (normalizedA.includes(normalizedB) || normalizedB.includes(normalizedA)) return 0.95;

  const tokensA = new Set(normalizedA.split(" "));
  const tokensB = new Set(normalizedB.split(" "));
  const sharedTokens = [...tokensA].filter((token) => tokensB.has(token)).length;
  const tokenScore = (2 * sharedTokens) / (tokensA.size + tokensB.size);

  const bigramsA = getBigrams(normalizedA);
  const bigramsB = getBigrams(normalizedB);
  const sharedBigrams = [...bigramsA].filter((bigram) => bigramsB.has(bigram)).length;
  const bigramScore = (2 * sharedBigrams) / (bigramsA.size + bigramsB.size);

  return Math.max(tokenScore, bigramScore);
}

function findTooSimilarTitle(candidate: string, existingTitles: string[]): string | null {
  const normalizedCandidate = normalizeComparableTitle(candidate);
  if (!normalizedCandidate) return null;

  for (const existingTitle of existingTitles) {
    if (!existingTitle.trim()) continue;
    const similarity = calculateTitleSimilarity(candidate, existingTitle);
    if (similarity >= TITLE_SIMILARITY_THRESHOLD) {
      return existingTitle;
    }
  }

  return null;
}

async function createReadableUniqueSlug(title: string): Promise<string> {
  const baseSlug = slugify(title, { lower: true, strict: true }).slice(0, 80) || "story";
  const existingStories = await prisma.userStory.findMany({
    where: {
      slug: {
        startsWith: baseSlug,
      },
    },
    select: {
      slug: true,
    },
  });

  const existingSlugs = new Set(existingStories.map((story) => story.slug));
  if (!existingSlugs.has(baseSlug)) return baseSlug;

  let counter = 2;
  while (existingSlugs.has(`${baseSlug}-${counter}`)) {
    counter += 1;
  }

  return `${baseSlug}-${counter}`;
}

function stripHtmlTags(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function hasInlineGlossaryExplanation(text: string): boolean {
  const plainText = stripHtmlTags(text);
  if (!plainText) return false;

  const patterns = [
    /\b[bB]edeutet,\s+dass\b/u,
    /\b[bB]edeutet\s+dass\b/u,
    /\bhei[sß]t,\s+dass\b/u,
    /\bhei[sß]t,\s+mit\b/u,
    /\bim\s+Sinne\s+von\b/u,
    /\bmeans?\s+that\b/iu,
    /\bmeans?\b.{0,24}\bused to\b/iu,
    /\brefers?\s+to\b/iu,
    /\bdescribes?\b.{0,24}\bthat\b/iu,
  ];

  return patterns.some((pattern) => pattern.test(plainText));
}

function truncateToWordLimit(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text.trim();
  const sliced = words.slice(0, maxWords).join(" ").trim();
  const lastPunctuation = Math.max(
    sliced.lastIndexOf("."),
    sliced.lastIndexOf("!"),
    sliced.lastIndexOf("?")
  );
  if (lastPunctuation > Math.floor(sliced.length * 0.7)) {
    return sliced.slice(0, lastPunctuation + 1).trim();
  }
  return `${sliced}.`;
}

function unwrapRemovedVocabSpans(text: string, wordsToRemove: Set<string>): string {
  if (wordsToRemove.size === 0) return text;
  return text.replace(
    /<span\s+[^>]*class=['"]vocab-word['"][^>]*data-word=['"]([^'"]+)['"][^>]*>(.*?)<\/span>/giu,
    (match: string, rawWord: string, inner: string) => {
      const key = normalizeToken(rawWord);
      if (!key || !wordsToRemove.has(key)) return match;
      return inner;
    }
  );
}

function mergeVocab(base: StoryVocabItem[], incoming: StoryVocabItem[], language?: string): StoryVocabItem[] {
  return sanitizeVocab([...base, ...incoming], language);
}

function extractCandidateWords(text: string, max = 500): string[] {
  const matches = text.match(/[\p{L}][\p{L}\p{M}\-']*/gu) ?? [];
  const counts = new Map<string, number>();

  for (const token of matches) {
    const clean = token.trim();
    if (!clean || clean.length < 3) continue;
    const lower = clean.toLowerCase();
    counts.set(lower, (counts.get(lower) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([token]) => token);
}

function parseModelJson(content: string): unknown {
  const trimmed = content.trim();
  const withoutFence = trimmed.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(withoutFence) as unknown;
  } catch {
    const arrayStart = withoutFence.indexOf("[");
    const arrayEnd = withoutFence.lastIndexOf("]");
    if (arrayStart >= 0 && arrayEnd > arrayStart) {
      return JSON.parse(withoutFence.slice(arrayStart, arrayEnd + 1)) as unknown;
    }
    const start = withoutFence.indexOf("{");
    const end = withoutFence.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(withoutFence.slice(start, end + 1)) as unknown;
    }
    throw new Error("Model did not return valid JSON.");
  }
}

function isUniversalAnglicism(word: string, language: string): boolean {
  if (normalizeToken(language) === "english") return false;
  const normalized = normalizeToken(word);
  if (!normalized) return false;
  if (UNIVERSAL_ANGLICISMS.has(normalized)) return true;
  return splitWordTokens(word).some((token) => UNIVERSAL_ANGLICISMS.has(token));
}

function isSimpleWord(word: string, language: string): boolean {
  const languageKey = normalizeToken(language);
  const simpleWords = SIMPLE_WORDS_BY_LANGUAGE[languageKey];
  const tokens = splitWordTokens(word);
  if (tokens.length === 0) return true;
  if (tokens.length === 1 && tokens[0].length <= 3) return true;
  if (!simpleWords) return false;
  return tokens.every((token) => simpleWords.has(token));
}

function isDiscouragedTransparentWord(word: string, language: string): boolean {
  const languageKey = normalizeToken(language);
  const discouraged = DISCOURAGED_VOCAB_BY_LANGUAGE[languageKey];
  if (!discouraged) return false;
  const tokens = splitWordTokens(word);
  return tokens.length > 0 && tokens.every((token) => discouraged.has(token));
}

function isLikelyComplexWord(item: StoryVocabItem, language: string): boolean {
  const tokens = splitWordTokens(item.word);
  const type = normalizeToken(item.type ?? "");
  if (isUniversalAnglicism(item.word, language)) return false;
  if (isSimpleWord(item.word, language)) return false;
  if (isDiscouragedTransparentWord(item.word, language)) return false;
  if (isInvalidMultiwordVocab(item.word, { type: item.type })) return false;
  if (tokens.length >= 2) return true;
  if ((item.word ?? "").trim().length >= 8) return true;
  if (type === "expression") return true;
  if (type === "adjective" || type === "adverb") return true;
  return false;
}

function sanitizeVocab(items: StoryVocabItem[], language?: string): StoryVocabItem[] {
  const out: StoryVocabItem[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const type = typeof item.type === "string" ? item.type.trim() : undefined;
    const rawWord = typeof item.word === "string" ? item.word : "";
    const { word, surface } = resolveCanonicalVocabEntry({
      word: rawWord,
      surface: typeof item.surface === "string" ? item.surface : rawWord,
      type,
      language,
    });
    const definition = typeof item.definition === "string" ? item.definition.trim() : "";
    if (!word || !definition) continue;
    const key = normalizeToken(word);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(
      type
        ? { word, ...(surface && surface !== word ? { surface } : {}), definition, type }
        : { word, ...(surface && surface !== word ? { surface } : {}), definition }
    );
  }

  return out;
}

function analyzeVocab(items: StoryVocabItem[], language: string): {
  total: number;
  complexCount: number;
  simpleCount: number;
  anglicismCount: number;
  score: number;
} {
  let complexCount = 0;
  let simpleCount = 0;
  let anglicismCount = 0;

  for (const item of items) {
    if (isUniversalAnglicism(item.word, language)) {
      anglicismCount += 1;
      continue;
    }
    if (
      isSimpleWord(item.word, language) ||
      isDiscouragedTransparentWord(item.word, language) ||
      isInvalidMultiwordVocab(item.word, { type: item.type })
    ) {
      simpleCount += 1;
      continue;
    }
    if (isLikelyComplexWord(item, language)) {
      complexCount += 1;
      continue;
    }
    simpleCount += 1;
  }

  const total = items.length;
  const score = total * 8 + complexCount * 3 - simpleCount * 4 - anglicismCount * 8;
  return { total, complexCount, simpleCount, anglicismCount, score };
}

function isVocabAcceptable(items: StoryVocabItem[], language: string): boolean {
  const stats = analyzeVocab(items, language);
  if (stats.total < Math.max(12, Math.floor(TARGET_VOCAB_ITEMS * 0.65))) return false;
  if (stats.anglicismCount > 0) return false;
  return stats.complexCount >= Math.max(15, Math.floor(stats.total * 0.6));
}

async function generateComplexVocabFill(
  openaiClient: OpenAI,
  args: {
    text: string;
    language: string;
    level: string;
    cefrLevel?: string;
    focus: string;
    topic: string;
    existingVocab: StoryVocabItem[];
    needed: number;
  }
): Promise<StoryVocabItem[]> {
  const { text, language, level, cefrLevel, focus, topic, existingVocab, needed } = args;
  if (needed <= 0) return [];

  const existingWords = existingVocab.map((item) => item.word);
  const prompt = `
Select exactly ${needed} additional vocabulary items from this story text.

Context:
- Language: ${language}
- Level: ${cefrPromptLabel(cefrLevel, level)}
- Focus: ${focus}
- Topic: ${topic || "general"}

Rules:
- Return ONLY advanced or less frequent words/expressions useful for learners.
- Strongly prefer short fixed expressions, nuanced verbs, and culturally grounded phrases.
- Single words are preferred.
- If you return more than one word, it must be a short fixed expression or idiom (usually 2-3 words).
- Any multi-word item MUST use type "expression".
- Never return arbitrary sentence fragments or descriptive chunks like "con cada ensayo" or "mostrar lo que somos".
- Exclude globally known anglicisms such as internet, marketing, smartphone, software, meeting.
- Exclude transparent/basic cognates such as "importante", "normal", "general", "social", or direct equivalents.
- Exclude extremely basic function words and beginner vocabulary.
- Do not repeat these existing words: ${JSON.stringify(existingWords)}.
- Set "surface" to the exact form that appears in the story.
- Set "word" to the dictionary/root form learners should study.
- Definitions must be in English, 8-18 words, pedagogical and contextual.
- Return ONLY valid JSON array:
[{"word":"...","surface":"...","definition":"...","type":"verb|noun|adjective|adverb|expression|slang"}]

Story text:
${text.slice(0, 9000)}
`;

  try {
    const response = await openaiClient.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.25,
      messages: [
        { role: "system", content: "You extract challenging vocabulary from a story. Output JSON only." },
        { role: "user", content: prompt },
      ],
    });
    const content = response.choices[0]?.message?.content?.trim();
    if (!content) return [];
    const parsed = parseModelJson(content);
    const rows = Array.isArray(parsed) ? parsed : [];
    const normalized = sanitizeVocab(rows as StoryVocabItem[], language);
    return normalized.filter(
      (item) =>
        !isUniversalAnglicism(item.word, language) &&
        !isSimpleWord(item.word, language) &&
        !isDiscouragedTransparentWord(item.word, language) &&
        !isInvalidMultiwordVocab(item.word, { type: item.type, storyText: text })
    );
  } catch (error) {
    console.warn("[vocab] fill pass failed", error);
    return [];
  }
}

async function requestVocabFromStoryText(
  openaiClient: OpenAI,
  args: {
    text: string;
    language: string;
    variant?: string | null;
    level: string;
    cefrLevel?: string;
    focus: string;
    topic: string;
    minItems: number;
    maxItems: number;
    candidates?: string[];
  }
): Promise<StoryVocabItem[]> {
  const {
    text,
    language,
    variant,
    level,
    cefrLevel,
    focus,
    topic,
    minItems,
    maxItems,
    candidates = [],
  } = args;
  const variantClause = buildVariantPromptClause(language, normalizeVariant(variant));
  const candidateBlock =
    candidates.length > 0
      ? `\nUse ONLY words/phrases from this exact candidate list:\n${candidates.join(", ")}\n`
      : "";

  const prompt = `
You extract study vocabulary from language-learning stories.

Task:
- Return ONLY a JSON array.
- Extract between ${minItems} and ${maxItems} useful words/phrases from the story.
- Prioritize this focus: "${focus}".
- Story language: ${language}.
- Learner level: ${cefrPromptLabel(cefrLevel, level)}.
- Story topic/context: ${topic || "general"}.
${variantClause}
- Each item must have:
  - "word": dictionary/root form learners should study
  - "surface": exact form as it appears in the story text
  - "definition": clear English explanation with 8-18 words, including nuance or typical usage in context
  - "type": one label among ["verb","noun","adjective","adverb","expression","slang","other"]
- Prefer high-learning-value items that are practical, reusable, nuanced, or culturally grounded.
- Do not include duplicates.
- Avoid ultra-generic items unless they are essential to the story meaning.
- Avoid globally known anglicisms (internet, marketing, smartphone, software, meeting, etc.) unless truly unavoidable.
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

  try {
    const response = await openaiClient.chat.completions.create({
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
    if (!content) return [];

    const parsed = parseModelJson(content);
    const rows = Array.isArray(parsed) ? parsed : [];
    const normalized = sanitizeVocab(rows as StoryVocabItem[], language);
    return normalized.filter(
      (item) =>
        !isUniversalAnglicism(item.word, language) &&
        !isDiscouragedTransparentWord(item.word, language) &&
        !isInvalidMultiwordVocab(item.word, { type: item.type, storyText: text })
    );
  } catch (error) {
    console.warn("[vocab] extraction pass failed", error);
    return [];
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkUserId } = (await auth()) ?? { userId: null };
    const mobileSession = getMobileSessionFromRequest(req);
    const userId = clerkUserId ?? mobileSession?.sub ?? null;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = clerkUserId ? await currentUser() : null;
    const plan = clerkUserId
      ? ((user?.publicMetadata?.plan as string) ?? "free")
      : (mobileSession?.plan ?? "free");
    if (plan !== "polyglot") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json()) as {
      language?: string;
      variant?: string;
      region?: string;
      cefrLevel?: string;
      level?: string;
      focus?: string;
      topic?: string;
      customTopic?: string;
    };

    const {
      language = "Spanish",
      variant,
      region,
      cefrLevel,
      level = "intermediate",
      focus = "verbs",
      topic = "",
      customTopic = "",
    } = body;
    const normalizedCefrLevel = normalizeCefrLevel(cefrLevel);
    const normalizedBroadLevel = broadLevelFromCefr(normalizedCefrLevel) ?? normalizeBroadLevel(level) ?? "beginner";
    const normalizedVariant = normalizeVariant(variant);
    const learnerProfile = cefrPromptLabel(normalizedCefrLevel, normalizedBroadLevel);
    const requestedTopic = typeof topic === "string" ? topic.trim() : "";
    const customTopicResolved =
      typeof customTopic === "string" ? customTopic.trim().slice(0, 120) : "";
    const resolvedTopic = customTopicResolved || requestedTopic;
    const existingStoryTitles = (
      await prisma.userStory.findMany({
        where: {
          language,
          ...(resolvedTopic
            ? {
                topic: {
                  contains: resolvedTopic,
                  mode: "insensitive",
                },
              }
            : {}),
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 40,
        select: {
          title: true,
        },
      })
    )
      .map((story) => story.title.trim())
      .filter(Boolean);
    const existingTitlesClause = existingStoryTitles.length
      ? `Avoid titles identical or too similar to these existing titles: ${existingStoryTitles
          .slice(0, 12)
          .map((title) => `"${title}"`)
          .join(", ")}.`
      : "";

    const regionClause = region ? `, specifically from ${region}` : "";
    const variantClause = buildVariantPromptClause(language, normalizedVariant);

    const basePrompt = `
You are an expert fiction writer and language teacher.
Write a vivid, modern story in ${language}${regionClause} for a ${learnerProfile} learner.
${resolvedTopic ? `The topic is "${resolvedTopic}".` : "Choose a concrete, modern topic that fits the level."}
${variantClause}
All vocabulary definitions must be written in clear English, regardless of the story language.
Each vocabulary definition must be a pedagogical explanation (8-18 words), with usage nuance in context.
Never return one-word literal translations.
Never begin a definition with a direct gloss plus comma/colon, such as "To change, ..." or "Important, ...".
Wrap each paragraph inside <blockquote> ... </blockquote>.

Requirements:
Use close third-person narration with natural internal perspective and sharp scene dynamics.
Do NOT explain vocabulary inside the story text itself.
Do NOT add glossary-like appositions such as "X bedeutet, dass...", "X heißt...", "X means...", or "X refers to...".
The story body must read like natural narrative only, never like a lesson, dictionary, annotation, or teacher aside.

Words to wrap:
- Aim for ${TARGET_VOCAB_ITEMS} different items, and try to stay above 20 whenever natural, marking only the first occurrence of each with
<span class='vocab-word' data-word='original-word'>original-word</span>.
- The amount of wrapped items MUST be exactly the same as the vocab list size.
- Single words are preferred.
- Multi-word items are allowed ONLY if they are short lexicalized expressions or idioms.
- Any multi-word item MUST use type "expression".
- Good examples: "de repente", "por fin", "al menos".
- Bad examples: "con cada ensayo", "buenos momentos", "manos temblando", "sazonar correctamente", "mostrar lo que somos".
- Prioritize ${focus.toLowerCase()} when choosing words and expressions to wrap.
- Prefer less frequent, nuanced, and pedagogically rich items over basic beginner words.
- Prefer useful multi-word expressions, discourse markers, nuanced verbs, and culturally grounded phrases.
- Avoid globally known anglicisms (internet, marketing, smartphone, software, meeting, etc.) unless unavoidable.
- Avoid transparent/basic cognates such as "importante", "normal", "general", "social", or their direct equivalents unless they are part of a fixed expression.
- Include a strong mix of verbs, adjectives/adverbs, and multi-word expressions.

Narrative quality rules:
- Avoid childish/fable tone. Do NOT start with "Once upon a time", "Érase una vez", or equivalents.
- Avoid generic moral-of-the-story endings.
- Open with immediate action or tension in the first 2-3 lines.
- Include realistic dialogue and specific details (places, constraints, consequences).
- Keep the story for adult learners: natural, grounded, and emotionally believable.
- Keep title short and specific (max 7 words), avoid clichés like "The Mystery of..." unless truly justified.
- ${existingTitlesClause || "Keep the title clearly distinct from common travel/daily-life template titles."}
- Length target: ${TARGET_STORY_WORDS_MIN}-${TARGET_STORY_WORDS_MAX} words.
- Absolute minimum: ${MIN_STORY_WORDS} words.
- Hard maximum: ${HARD_STORY_WORDS_MAX} words.

Return ONLY valid JSON:
{
  "title": "string",
  "text": "string",
  "vocab": [{ "word": "string", "surface": "string", "definition": "string", "type": "verb|noun|adjective|adverb|expression|slang" }]
}
`;

    let selectedStory: StoryJSON | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    let bestCandidate: StoryJSON | null = null;
    let previousFeedback = "";

    for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
      const retryClause =
        attempt === 0
          ? ""
          : `\nRetry constraints (must fix): ${previousFeedback || "Use more advanced, non-anglicized vocabulary and aim for more than 20 items."}`;
      const prompt = `${basePrompt}${retryClause}`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: attempt === 0 ? 0.8 : 0.6,
        messages: [
          {
            role: "system",
            content:
              "You are a high-quality fiction writer for language learners. Avoid repetitive, childish, and formulaic storytelling.",
          },
          { role: "user", content: prompt },
        ],
      });

      const content = response.choices[0]?.message?.content?.trim();
      if (!content) continue;

      let parsed: unknown;
      try {
        parsed = parseModelJson(content);
      } catch {
        continue;
      }
      if (!isValidStoryJSON(parsed)) continue;

      const candidate = parsed as StoryJSON;
      const tooSimilarTitle = findTooSimilarTitle(candidate.title, existingStoryTitles);
      if (tooSimilarTitle) {
        previousFeedback = `Title "${candidate.title}" is too similar to existing title "${tooSimilarTitle}". Generate a more distinct title.`;
        continue;
      }
      const normalizedCandidateText = normalizeStoryHtml(candidate.text);
      const boundedCandidateText =
        countStoryWords(normalizedCandidateText) > HARD_STORY_WORDS_MAX
          ? truncateToWordLimit(normalizedCandidateText, HARD_STORY_WORDS_MAX)
          : normalizedCandidateText;

      if (countStoryWords(boundedCandidateText) < MIN_STORY_WORDS) {
        previousFeedback = `Story is below the minimum length of ${MIN_STORY_WORDS} words.`;
        continue;
      }

      if (hasInlineGlossaryExplanation(boundedCandidateText)) {
        previousFeedback =
          "Story text contains inline glossary explanations like 'X bedeutet, dass...' and must be pure narrative.";
        continue;
      }

      const cleanedVocab = sanitizeVocab(candidate.vocab, language);
      const stats = analyzeVocab(cleanedVocab, language);
      if (stats.score > bestScore) {
        bestScore = stats.score;
        bestCandidate = { ...candidate, text: boundedCandidateText, vocab: cleanedVocab };
      }
      if (isVocabAcceptable(cleanedVocab, language)) {
        selectedStory = { ...candidate, text: boundedCandidateText, vocab: cleanedVocab };
        break;
      }

      previousFeedback = `Returned ${stats.total} items, with ${stats.simpleCount} basic items and ${stats.anglicismCount} anglicisms.`;
    }

    if (!selectedStory && bestCandidate) {
      selectedStory = bestCandidate;
    }
    if (!selectedStory) {
      return NextResponse.json({ error: "No valid story returned from model" }, { status: 502 });
    }

    const { title, text, vocab } = selectedStory;

    // 🔹 Normalizar texto HTML para formato consistente
    const normalizedText = stripLegacyVocabSpans(normalizeStoryHtml(text));
    if (hasInlineGlossaryExplanation(normalizedText)) {
      return NextResponse.json(
        { error: "Generated story contains inline glossary explanations and was rejected." },
        { status: 502 }
      );
    }
    const plainText = stripHtml(normalizedText);
    const dynamicRange = computeDynamicVocabRange(plainText);
    const minVocabItems = Math.min(
      Math.max(dynamicRange.minItems, TARGET_VOCAB_ITEMS - 4),
      dynamicRange.maxItems
    );
    const maxVocabItems = Math.max(
      minVocabItems,
      Math.min(32, Math.max(dynamicRange.maxItems, TARGET_VOCAB_ITEMS))
    );
    const minimumUsableItems = computeSoftMinimum(minVocabItems);

    let vocabPool = sanitizeVocab(vocab, language).filter(
      (item) =>
        !isUniversalAnglicism(item.word, language) &&
        !isDiscouragedTransparentWord(item.word, language) &&
        !isInvalidMultiwordVocab(item.word, { type: item.type, storyText: plainText })
    );

    const extractedVocab = await requestVocabFromStoryText(openai, {
      text: plainText,
      language,
      variant: normalizedVariant,
      level: normalizedBroadLevel,
      cefrLevel: normalizedCefrLevel ?? undefined,
      focus,
      topic: resolvedTopic,
      minItems: minVocabItems,
      maxItems: maxVocabItems,
    });
    vocabPool = mergeVocab(vocabPool, extractedVocab, language);

    if (vocabPool.length < minVocabItems) {
      const refill = await requestVocabFromStoryText(openai, {
        text: plainText,
        language,
        variant: normalizedVariant,
        level: normalizedBroadLevel,
        cefrLevel: normalizedCefrLevel ?? undefined,
        focus: `${focus} (strictly provide practical, reusable vocabulary; prefer strong single words over weak expressions)`,
        topic: resolvedTopic,
        minItems: Math.max(5, minVocabItems - vocabPool.length),
        maxItems: Math.max(minVocabItems, maxVocabItems - vocabPool.length + 4),
        candidates: extractCandidateWords(plainText, 450).filter(
          (token) => !vocabPool.some((item) => item.word.toLowerCase() === token.toLowerCase())
        ),
      });
      vocabPool = mergeVocab(vocabPool, refill, language);
    }

    let improvedVocab = await improveVocabDefinitions(openai, {
      items: vocabPool,
      language,
      level: learnerProfile,
      focus,
      topic: resolvedTopic,
      text: plainText,
    });

    let validation = validateAndNormalizeVocab({
      rawVocab: improvedVocab,
      text: plainText,
      language,
      level: normalizedBroadLevel,
      cefrLevel: normalizedCefrLevel ?? undefined,
    });

    if (validation.vocab.length < minVocabItems) {
      const rescue = await requestVocabFromStoryText(openai, {
        text: plainText,
        language,
        variant: normalizedVariant,
        level: normalizedBroadLevel,
        cefrLevel: normalizedCefrLevel ?? undefined,
        focus: `${focus} (final rescue pass, prioritize concrete and reusable vocabulary; avoid abstract cognates and avoid expressions unless clearly lexicalized)`,
        topic: resolvedTopic,
        minItems: Math.max(4, minVocabItems - validation.vocab.length),
        maxItems: Math.max(minVocabItems, Math.min(maxVocabItems, validation.vocab.length + 8)),
        candidates: extractCandidateWords(plainText, 550).filter(
          (token) => !validation.vocab.some((item) => item.word.toLowerCase() === token.toLowerCase())
        ),
      });
      improvedVocab = await improveVocabDefinitions(openai, {
        items: mergeVocab(validation.vocab, rescue, language),
        language,
        level: learnerProfile,
        focus,
        topic: resolvedTopic,
        text: plainText,
      });
      validation = validateAndNormalizeVocab({
        rawVocab: improvedVocab,
        text: plainText,
        language,
        level: normalizedBroadLevel,
        cefrLevel: normalizedCefrLevel ?? undefined,
      });
    }

    const finalVocab = validation.vocab.slice(0, maxVocabItems);
    if (finalVocab.length < Math.max(MIN_VOCAB_ITEMS_HARD, minimumUsableItems)) {
      return NextResponse.json(
        {
          error: `Could not assemble enough high-quality vocabulary items (minimum usable threshold: ${Math.max(MIN_VOCAB_ITEMS_HARD, minimumUsableItems)}).`,
        },
        { status: 502 }
      );
    }

    // Normalizar nivel
    const normalizedLevel =
      normalizedBroadLevel === "advanced"
        ? "Advanced"
        : normalizedBroadLevel === "intermediate"
          ? "Intermediate"
          : "Beginner";

    // Generar slug único
    const uniqueSlug = await createReadableUniqueSlug(title);

    const inferredTopic = inferTopicFromText({
      title,
      text: normalizedText,
      existingTopic: resolvedTopic,
      fallback: "Daily life",
    });

    const savedStory = await prisma.userStory.create({
      data: {
        userId,
        title,
        slug: uniqueSlug,
        text: normalizedText,
        vocab: finalVocab,
        audioStatus: "pending",
        language,
        variant: normalizedVariant,
        region,
        level: normalizedLevel,
        cefrLevel: normalizedCefrLevel,
        focus,
        topic: inferredTopic,
        public: true,
      },
    });

    // 🔹 Generación de portada (DALL·E) en segundo plano
    try {
  const cover = await generateAndUploadCover({
    title,
    language,
    region,
    topic: inferredTopic,
    level: normalizedLevel,
    text: normalizedText,
  });

  if (cover && cover.url && cover.filename) {
    const storyWithCover = await prisma.userStory.update({
      where: { id: savedStory.id },
      data: {
        coverUrl: cover.url,
        coverFilename: cover.filename,
      },
    });
    try {
      await syncCreateStoryMirror(storyWithCover);
    } catch (mirrorError) {
      console.warn("[create-story-mirror] Cover sync failed:", mirrorError);
    }
  }
} catch (e: unknown) {
  console.error("[cover] Failed to generate/upload cover:", e);
}

    try {
      await syncCreateStoryMirror(savedStory);
    } catch (mirrorError) {
      console.warn("[create-story-mirror] Initial sync failed:", mirrorError);
    }

    // 🔹 Generación de audio en segundo plano
    try {
      const appUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

      fetch(`${appUrl}/api/audio/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyId: savedStory.id,
          text: normalizedText,
          title,
          language,
          variant: normalizedVariant,
          region,
        }),
      }).catch((err) => console.error("[background audio job failed]", err));
    } catch (err) {
      console.error("[background job launch failed]", err);
    }

    return NextResponse.json({
      message: "Story generated successfully",
      story: {
        id: savedStory.id,
        slug: savedStory.slug,
        title: savedStory.title,
        text: savedStory.text,
        vocab: savedStory.vocab,
        language: savedStory.language,
        variant: savedStory.variant,
        region: savedStory.region,
        level: savedStory.level,
        cefrLevel: savedStory.cefrLevel,
        focus: savedStory.focus,
        topic: savedStory.topic,
        audioStatus: savedStory.audioStatus,
        audioUrl: savedStory.audioUrl,
        coverUrl: savedStory.coverUrl,
      },
    });
  } catch (error: unknown) {
    console.error("💥 ERROR in /api/user/generate-story");
    console.error("Full error object:", JSON.stringify(error, null, 2));
    const maybe = error as {
      code?: string;
      type?: string;
      status?: number;
      message?: string;
      error?: { code?: string; message?: string; type?: string };
    };
    const code = maybe?.code ?? maybe?.error?.code;
    const type = maybe?.type ?? maybe?.error?.type;

    if (code === "insufficient_quota" || type === "insufficient_quota") {
      return NextResponse.json(
        {
          error: "Story generation is temporarily unavailable. Please try again shortly.",
        },
        { status: 429 }
      );
    }

    if (maybe?.status === 429) {
      return NextResponse.json(
        {
          error: "Story generation is temporarily unavailable. Please try again shortly.",
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: "Failed to generate story", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
