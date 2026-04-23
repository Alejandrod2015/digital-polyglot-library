import OpenAI from "openai";
import { improveVocabDefinitions } from "@/lib/vocabQuality";
import { isInvalidMultiwordVocab, normalizeToken } from "@/lib/vocabSelection";
import { resolveCanonicalVocabEntry } from "@/lib/vocabWordNormalization";
import {
  HARD_STORY_WORDS_MAX,
  MIN_STORY_WORDS,
  TARGET_STORY_WORDS_MAX,
  TARGET_STORY_WORDS_MIN,
  countStoryWords,
} from "@domain/storyLength";
import { cefrPromptLabel } from "@domain/cefr";
import { buildVariantPromptClause, normalizeVariant } from "@/lib/languageVariant";

export type StoryJSON = {
  title: string;
  text: string;
  vocab: { word: string; surface?: string; definition: string; type?: string }[];
};

export type GenerateStoryParams = {
  language?: string;
  variant?: string;
  region?: string;
  cefrLevel?: string;
  level?: string;
  focus?: string;
  topic?: string;
  title?: string;
  synopsis?: string;
  existingTitles?: string[];
  usedCharacterNames?: string[];
};

const MAX_GENERATION_ATTEMPTS = 3;
const MIN_VOCAB_ITEMS = 15;

function sanitizeGeneratedStoryText(input: string): string {
  return input
    .replace(/\r\n?/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, " ")
    .replace(/\\"/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([.!?])(?:\s*[.!?]){1,}/g, "$1")
    .trim();
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

function isValidStoryJSON(data: unknown): data is StoryJSON {
  return (
    typeof data === "object" &&
    data !== null &&
    typeof (data as StoryJSON).title === "string" &&
    typeof (data as StoryJSON).text === "string" &&
    Array.isArray((data as StoryJSON).vocab)
  );
}

function sanitizeGeneratedVocab(
  items: StoryJSON["vocab"],
  storyText: string,
  language?: string
): StoryJSON["vocab"] {
  const seen = new Set<string>();
  const out: StoryJSON["vocab"] = [];

  for (const item of items) {
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
    if (isInvalidMultiwordVocab(word, { type, storyText })) continue;
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

function parseStoryPayload(content: string): unknown {
  const trimmed = content.trim();
  const maybeFence = trimmed.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  const parsed = JSON.parse(maybeFence) as unknown;
  return typeof parsed === "string" ? (JSON.parse(parsed) as unknown) : parsed;
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

/**
 * Generate a story with the same high-quality logic used by the Sanity studio.
 * Returns null if generation fails after MAX_GENERATION_ATTEMPTS.
 */
export async function generateStoryPayload(params: GenerateStoryParams): Promise<StoryJSON | null> {
  const {
    language = "Spanish",
    variant,
    region,
    cefrLevel,
    level = "intermediate",
    focus = "verbs",
    topic = "",
    title: providedTitle = "",
    synopsis = "",
    existingTitles = [],
    usedCharacterNames = [],
  } = params;
  const resolvedProvidedTitle = typeof providedTitle === "string" ? providedTitle.trim() : "";

  const learnerProfile = cefrPromptLabel(cefrLevel, level);
  const normalizedVariant = normalizeVariant(variant);
  const regionClause = region ? `, specifically from ${region}` : "";
  const variantClause = buildVariantPromptClause(language, normalizedVariant);
  const resolvedRequestedTopic = typeof topic === "string" ? topic.trim() : "";
  const resolvedSynopsis = typeof synopsis === "string" ? synopsis.trim() : "";

  const existingTitlesClause = existingTitles.length
    ? `\nNEVER reuse these existing titles or close variations: ${existingTitles.map((t) => `"${t}"`).join(", ")}. Use completely different characters, settings, and situations.`
    : "";
  const usedNamesClause = usedCharacterNames.length
    ? `\nNEVER reuse these character names (they already appear in other stories): ${usedCharacterNames.join(", ")}. Invent completely new, fresh character names.`
    : "";

  let previousFeedback = "";
  let finalPayload: StoryJSON | null = null;

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const retryClause =
      attempt === 0
        ? ""
        : `\nRetry constraints: previous attempt failed: ${previousFeedback}. If it was about length, expand the scenes, dialogue, internal reactions, and consequences. If it was about vocab count, return more candidate items (22 or more) so that enough survive post-processing.`;

    const titleClause = resolvedProvidedTitle
      ? `The story's title is already fixed: "${resolvedProvidedTitle}". Do NOT invent a different title. Return exactly this title in the JSON "title" field, and write the story so its content is coherent with it — the title's concrete nouns (dishes, places, objects, numbers) must appear or be clearly reflected in the narrative.`
      : "";

    const prompt = `
You are an expert language teacher and long story writer.
Write a long engaging story for a ${learnerProfile} learner studying ${language}${regionClause}.
${resolvedRequestedTopic ? `The topic of the story is "${resolvedRequestedTopic}".` : "Choose a clear, concrete topic that fits the level."}
${resolvedSynopsis ? `Use this synopsis as the main narrative foundation and keep all key beats coherent: "${resolvedSynopsis}".` : "If no synopsis is provided, invent a coherent narrative arc with clear beginning, development, and payoff."}
${titleClause}
${variantClause}
Return 18-22 vocabulary items (aim for 20). After post-processing filters transparent cognates and invalid multi-word fragments, this yields roughly 15-17 keeper items — the target the app needs.
All vocabulary definitions must be written in clear English, regardless of the story language.
Each vocabulary definition must be a pedagogical explanation (17-25 words), with usage nuance in context.
Never return one-word literal translations.
Never begin a definition with a direct gloss plus comma/colon (for example: "To change, ..." or "Important, ...").
Wrap each paragraph inside <blockquote> ... </blockquote>.

Requirements:
Use a close third-person narrator with strong internal focalization.
- The narrator is NOT a character.
- Most of the story should be experienced from inside the characters' perspective (thoughts, sensations, doubts, intentions, quick judgments).
- Keep the prose mainly in third person, but use first-person phrasing only inside dialogue or brief inner-thought moments when natural.
- Prioritize ${focus.toLowerCase()} in lexical choices and situations.
- Prefer useful short fixed expressions, nuanced verbs, and culturally specific phrases.
- In the vocab JSON, set "surface" to the exact form from the story and "word" to the dictionary/root form.
- Single words are preferred.
- If you return more than one word, it must be a short lexicalized expression or idiom (usually 2-3 words).
- Any multi-word item MUST use type "expression".
- Good examples: "de repente", "por fin", "al menos".
- Bad examples: "con cada ensayo", "buenos momentos", "manos temblando", "sazonar correctamente", "mostrar lo que somos".
- Never include arbitrary sentence fragments or descriptive chunks.
- Avoid transparent international/basic cognates such as "importante", "normal", "general", "social", or their direct equivalents unless essential.
- Keep the narrative specific and vivid (concrete scenes, actions, and consequences), not generic.
- Keep paragraphs short and dynamic (usually 1-3 sentences per paragraph).
- Avoid long expository narrator blocks; reduce detached description and increase character-centered viewpoint.
- Include frequent dialogue beats and immediate reactions to keep pacing lively.
- Length target: ${TARGET_STORY_WORDS_MIN}-${TARGET_STORY_WORDS_MAX} words.
- Absolute minimum: ${MIN_STORY_WORDS} words.
- Hard maximum: ${HARD_STORY_WORDS_MAX} words.${existingTitlesClause}${usedNamesClause}
${retryClause}

Return ONLY valid JSON:
{
  "title": "string",
  "text": "string",
  "vocab": [{ "word": "string", "surface": "string", "definition": "string", "type": "verb|noun|adjective|adverb|expression|slang" }]
}
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: attempt === 0 ? 0.8 : 0.6,
      messages: [
        {
          role: "system",
          content:
            "You are a creative story generator for language learners. CRITICAL RULE: the story body is written in the target language, but every vocabulary definition you emit MUST be written in clear English, never in the target language. Definitions that are not in English will be rejected and rewritten.",
        },
        { role: "user", content: prompt },
      ],
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      previousFeedback = "No content returned.";
      continue;
    }

    let parsed: unknown;
    try {
      parsed = parseStoryPayload(content);
    } catch {
      previousFeedback = "Model returned invalid JSON.";
      continue;
    }

    if (!isValidStoryJSON(parsed)) {
      previousFeedback = "Model returned invalid story structure.";
      continue;
    }

    const raw = parsed as StoryJSON;
    const title = resolvedProvidedTitle || raw.title.trim() || "Untitled";
    const sanitized = sanitizeGeneratedStoryText(raw.text);
    const text =
      countStoryWords(sanitized) > HARD_STORY_WORDS_MAX
        ? truncateToWordLimit(sanitized, HARD_STORY_WORDS_MAX)
        : sanitized;

    const wordCount = countStoryWords(text);
    if (wordCount < MIN_STORY_WORDS) {
      previousFeedback = `${wordCount} words, need ${MIN_STORY_WORDS}`;
      continue;
    }

    const improvedVocab = await improveVocabDefinitions(openai, {
      items: sanitizeGeneratedVocab(raw.vocab, text, language),
      language,
      level: learnerProfile,
      focus,
      topic: resolvedRequestedTopic,
      text,
    });

    if (improvedVocab.length < MIN_VOCAB_ITEMS) {
      previousFeedback = `vocab had ${improvedVocab.length} items after filtering, need at least ${MIN_VOCAB_ITEMS}. Return more candidate items next time (aim for 22).`;
      finalPayload = { title, text, vocab: improvedVocab };
      continue;
    }

    finalPayload = { title, text, vocab: improvedVocab };
    break;
  }

  return finalPayload;
}
