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
import { cefrPromptLabel, resolveCefrLevel } from "@domain/cefr";
import { buildVariantPromptClause, normalizeVariant } from "@/lib/languageVariant";

/**
 * Level-specific guidance + word-count targets injected into the prompt.
 * Language-agnostic on purpose: we describe the constraint (vocabulary
 * frequency, tense complexity, sentence length) and let the LLM apply it
 * to whatever target language we pass in. This is what lets A1 feel like
 * A1 across Italian, German, Korean, etc. without per-language wordlists.
 */
function levelGuidanceFor(cefr: string | null, language: string): {
  /** Floor used by the post-generation length gate. Anything below this
   *  triggers a retry. */
  wordsMin: number;
  /** Lower bound shown to the model in the prompt. Set higher than
   *  wordsMin so the model aims with cushion — it tends to undershoot
   *  the lower end of any range it sees, so the prompt range is
   *  strictly inside the gate. */
  wordsTargetMin: number;
  /** Upper bound shown to the model in the prompt. */
  wordsMax: number;
  /** Truncation cap. Stories above this get cut. */
  wordsHard: number;
  instructions: string;
} {
  const lvl = (cefr ?? "").toLowerCase();
  if (lvl === "a1") {
    return {
      // Floor stays at 180 (real A1 publication minimum). Target shown
      // in the prompt is 80 words above the floor so the model's
      // natural ~50-word undershoot still lands comfortably above the
      // gate. Earlier the prompt asked for 210 → model landed 137-170
      // → most failed the gate. With target 260 the model lands ~210
      // → passes 180 with cushion.
      wordsMin: 180,
      wordsTargetMin: 260,
      wordsMax: 300,
      wordsHard: 320,
      instructions: `
STRICT A1 LEVEL CONSTRAINTS — every line is mandatory:
- Vocabulary: ONLY the most common words a true beginner (~80 hours of study) would know in ${language}. If a non-basic word is essential to the plot, replace it with a simpler synonym or rewrite the action concretely.
- Tenses: use ONLY simple present and simple past for completed actions, plus a near-future construction if natural in ${language} (e.g. "going to" / "ir a + infinitivo" / "werde + Infinitiv"). FORBIDDEN: present perfect, pluperfect, synthetic future, conditional, any subjunctive form.
- Sentences: short. Average 7-9 words. NO sentence longer than 12 words.
- Avoid subordinate clauses; prefer simple connectors ("and", "but", "because", "then" — equivalent in ${language}).
- Drop subject pronouns in pro-drop languages (Italian, Spanish, Portuguese). "Cammina per Trastevere." beats "Lui cammina per Trastevere." Use the pronoun only when needed for contrast or clarity.
- NO idioms, NO figurative language, NO fancy adjectives.
- Concrete actions and visible objects only, not abstract concepts.
- Repetition is OK — beginners benefit from re-encountering the same word.
- The reader must be able to follow the plot without a dictionary.`,
    };
  }
  if (lvl === "a2") {
    return {
      wordsMin: 220,
      wordsTargetMin: 300,
      wordsMax: 340,
      wordsHard: 360,
      instructions: `
A2 LEVEL CONSTRAINTS:
- Vocabulary: common everyday words. A learner with ~180 hours of study should follow without a dictionary.
- Tenses: simple present, simple past, near future, basic continuous forms. Avoid conditional and subjunctive.
- Sentences: short to medium (avg 9-12 words). Up to one subordinate clause is fine.
- Avoid complex idioms and dense figurative language.
- Drop subject pronouns in pro-drop languages unless needed for emphasis or contrast.
- Show feelings through action and dialogue, not abstract description ("his hands shook" beats "he was very nervous").`,
    };
  }
  if (lvl === "b1") {
    return {
      wordsMin: 280,
      wordsTargetMin: 360,
      wordsMax: 400,
      wordsHard: 420,
      instructions: `
B1 LEVEL CONSTRAINTS:
- Vocabulary: intermediate everyday + common topical vocabulary.
- Tenses: most common forms, including conditional and basic subjunctive in everyday contexts. Avoid rare literary forms.
- Sentences: natural variety, subordinate clauses welcome.
- Some idioms OK if clearly contextualized.
- Push subtext: the protagonist's feelings can be implied by what they choose NOT to say or do, not just described.
- One genuine moment of internal conflict (a doubt, a temptation, a regret) belongs in every B1 story.`,
    };
  }
  if (lvl === "b2") {
    return {
      wordsMin: 320,
      wordsTargetMin: 400,
      wordsMax: 460,
      wordsHard: 480,
      instructions: `
B2 LEVEL CONSTRAINTS:
- Vocabulary: rich and varied; semi-technical terms allowed with context.
- Tenses: full range, including less common forms when natural.
- Sentences: complex syntax welcome, multi-clause structures fine.
- Idioms and figurative language welcome.
- Subtext is essential: characters can hide what they really mean. The reader should feel they are reading between the lines at least once.
- Stakes should feel real — even small ones (a friendship, a reputation, a chance) — and the protagonist should leave changed, even slightly.`,
    };
  }
  if (lvl === "c1") {
    return {
      wordsMin: 380,
      wordsTargetMin: 460,
      wordsMax: 520,
      wordsHard: 550,
      instructions: `
C1 LEVEL CONSTRAINTS:
- Sophisticated vocabulary including nuanced and abstract terms.
- Full grammatical range; literary and formal registers allowed.
- Complex and varied sentence structure.
- Cultural references, idioms, and stylistic flourishes welcome.
- Voice matters: the prose should have a recognizable rhythm or register, not feel anonymous.
- Allow ambiguity — not everything needs to be explained on the page.`,
    };
  }
  if (lvl === "c2") {
    return {
      wordsMin: 420,
      wordsTargetMin: 500,
      wordsMax: 580,
      wordsHard: 620,
      instructions: `
C2 LEVEL CONSTRAINTS:
- Native-level vocabulary, including rare, literary, and specialized terms.
- Full nuance and stylistic variety.
- Long, complex sentences with sophisticated structure.
- Embrace ambiguity, layered meaning, and cultural depth.
- The story should reward close reading: a second pass should reveal something the first didn't.`,
    };
  }
  // Fallback: behave like the historic defaults (B1 territory).
  return {
    wordsMin: MIN_STORY_WORDS,
    wordsTargetMin: TARGET_STORY_WORDS_MIN,
    wordsMax: TARGET_STORY_WORDS_MAX,
    wordsHard: HARD_STORY_WORDS_MAX,
    instructions: "",
  };
}

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
  /**
   * Opt-in flag for the V2 path (`/api/studio/journeys/generate-v2`).
   * When true, the prompt receives explicit per-CEFR-level constraints
   * (vocabulary frequency, allowed tenses, sentence length) and the
   * length targets shrink to level-appropriate ranges (A1 ≈ 180-260
   * words instead of the historic 220-380). V1 (the default `generate`
   * route) keeps its original behavior — same prompt, same constants —
   * so anything calling generateStoryPayload without this flag is
   * unchanged.
   */
  useLevelGuidance?: boolean;
};

const MAX_GENERATION_ATTEMPTS_V1 = 3;
// V2 needs more retries because the stacked constraints (level rules +
// narrative quality + length floor) make undershooting more common —
// 4 of every 5 V2 A1 attempts land at 180+ words, but the 5th lands
// at 140-170. Three retries was leaving us exposed to that tail; five
// gives the gate a near-certain pass without escalating cost much
// (most generations succeed on attempt 1 anyway).
const MAX_GENERATION_ATTEMPTS_V2 = 5;
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
 * Returns null if generation fails after MAX_GENERATION_ATTEMPTS_V1
 * (or _V2 when `useLevelGuidance` is true).
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
    useLevelGuidance = false,
  } = params;
  const resolvedProvidedTitle = typeof providedTitle === "string" ? providedTitle.trim() : "";

  const learnerProfile = cefrPromptLabel(cefrLevel, level);
  const resolvedCefr = resolveCefrLevel(cefrLevel, level);
  // V1 (default) keeps the original prompt. V2 (opt-in via useLevelGuidance)
  // injects the per-CEFR-level constraints + uses level-appropriate length
  // targets. The two paths share the rest of the pipeline (vocab, retries,
  // sanitization) so V2 stays a thin layer on top of V1.
  const levelGuidance = useLevelGuidance ? levelGuidanceFor(resolvedCefr, language) : null;
  const guidanceBlock = levelGuidance ? levelGuidance.instructions : "";
  const wordsHard = levelGuidance ? levelGuidance.wordsHard : HARD_STORY_WORDS_MAX;
  const wordsMin = levelGuidance ? levelGuidance.wordsMin : MIN_STORY_WORDS;
  const wordsTargetMin = levelGuidance ? levelGuidance.wordsTargetMin : TARGET_STORY_WORDS_MIN;
  const wordsTargetMax = levelGuidance ? levelGuidance.wordsMax : TARGET_STORY_WORDS_MAX;
  const longClause = levelGuidance ? "" : "long ";
  const writeClause = levelGuidance ? "Write an engaging story" : "Write a long engaging story";
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

  const maxAttempts = useLevelGuidance ? MAX_GENERATION_ATTEMPTS_V2 : MAX_GENERATION_ATTEMPTS_V1;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const retryClause =
      attempt === 0
        ? ""
        : `\nRetry constraints: previous attempt failed: ${previousFeedback}. If it was about length, expand the scenes, dialogue, internal reactions, and consequences. If it was about vocab count, return more candidate items (22 or more) so that enough survive post-processing.`;

    const titleClause = resolvedProvidedTitle
      ? `The story's title is already fixed: "${resolvedProvidedTitle}". Do NOT invent a different title. Return exactly this title in the JSON "title" field, and write the story so its content is coherent with it — the title's concrete nouns (dishes, places, objects, numbers) must appear or be clearly reflected in the narrative.`
      : "";

    const prompt = `
You are an expert language teacher and ${longClause}story writer.
${writeClause} for a ${learnerProfile} learner studying ${language}${regionClause}.
${guidanceBlock}
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
- Length target: ${wordsTargetMin}-${wordsTargetMax} words.
- Absolute minimum: ${wordsMin} words.
- Hard maximum: ${wordsHard} words.${existingTitlesClause}${usedNamesClause}
${retryClause}

Return ONLY valid JSON:
{
  "title": "string",
  "text": "string",
  "vocab": [{ "word": "string", "surface": "string", "definition": "string", "type": "verb|noun|adjective|adverb|expression|slang" }]
}
`;

    const response = await openai.chat.completions.create({
      // V2 uses gpt-4o (the bigger model) so it can satisfy the stacked
      // constraints (level rules + narrative quality + length target)
      // without undershooting. gpt-4o-mini was consistently landing at
      // ~140 words for A1 even when asked for 210, because juggling
      // sentence-length caps + tense restrictions + vocab frequency
      // exhausts its instruction-following budget. V1 keeps mini —
      // it's the cheaper path with looser constraints.
      model: useLevelGuidance ? "gpt-4o" : "gpt-4o-mini",
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
      countStoryWords(sanitized) > wordsHard
        ? truncateToWordLimit(sanitized, wordsHard)
        : sanitized;

    const wordCount = countStoryWords(text);
    if (wordCount < wordsMin) {
      // Concrete next-attempt instructions instead of just stating the
      // gap. The model otherwise tends to undershoot the same way on
      // retry; telling it WHAT to add (a paragraph of dialogue, a
      // sensory beat, an internal reaction) gives it a clear lever
      // without compromising level constraints.
      const gap = wordsTargetMin - wordCount;
      previousFeedback = `${wordCount} words, need at least ${wordsMin} (target ${wordsTargetMin}-${wordsTargetMax}). You undershot by about ${gap} words. ADD one of: another short dialogue exchange (2-3 lines between characters), a sensory beat (smell / sound / sight), or an internal reaction (what the protagonist thinks or feels) — keeping the same level constraints (vocabulary, tense, sentence length).`;
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

  if (!finalPayload && previousFeedback) {
    // Surface the last attempt's reason so callers can show the user
    // a useful message instead of "failed after multiple attempts" with
    // no context. The function used to silently return null here, which
    // made it impossible to tell whether the LLM was undershooting on
    // length, returning malformed JSON, or hitting some other gate.
    throw new Error(`Story generation failed: ${previousFeedback}`);
  }
  return finalPayload;
}
