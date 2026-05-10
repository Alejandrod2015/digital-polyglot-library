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

export type StoryJSON = {
  title: string;
  text: string;
  arcType: string;
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
  /**
   * Synopses of stories already in the same journey. Used to detect the
   * dominant emotional arc / tone of the journey so the new story can
   * vary register instead of repeating "warm encounter, happy ending"
   * eight times in a row.
   */
  existingSynopses?: { title: string; synopsis: string }[];
  usedCharacterNames?: string[];
  /**
   * Words flagged by a previous audit as above the requested CEFR level.
   * When present, the prompt explicitly asks the model to avoid them and
   * pick simpler equivalents. Closes the audit→regenerate feedback loop.
   */
  wordsToAvoid?: string[];
  existingArcTypes?: string[];
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

function hasLegacyHtmlStoryMarkup(text: string): boolean {
  return /<(?:p|blockquote|div|span|br)\b/i.test(text);
}

function extractSpeakerNames(text: string): string[] {
  const speakerRegex = /^([\p{Lu}][\p{L}\p{M}.'\-]*(?:\s+[\p{Lu}][\p{L}\p{M}.'\-]*){0,3}):\s+\S.*$/gmu;
  const speakers = new Set<string>();
  let match: RegExpExecArray | null = speakerRegex.exec(text);
  while (match) {
    const name = match[1]?.trim();
    if (name) speakers.add(name);
    match = speakerRegex.exec(text);
  }
  return [...speakers];
}

function countSpeakerLines(text: string): number {
  const speakerRegex = /^[\p{Lu}][\p{L}\p{M}.'\-]*(?:\s+[\p{Lu}][\p{L}\p{M}.'\-]*){0,3}:\s+\S.*$/gmu;
  return [...text.matchAll(speakerRegex)].length;
}

function hasNarratorOpeningParagraph(text: string): boolean {
  const firstBlock = text.split(/\n{2,}/).map((block) => block.trim()).find(Boolean) ?? "";
  if (!firstBlock) return false;
  if (/^[\p{Lu}][\p{L}\p{M}.'\-]*(?:\s+[\p{Lu}][\p{L}\p{M}.'\-]*){0,3}:\s+/u.test(firstBlock)) return false;
  return /[\p{L}].+[.!?]/u.test(firstBlock);
}

function isValidMultiVoiceJourneyBody(text: string): { ok: boolean; reason?: string } {
  if (hasLegacyHtmlStoryMarkup(text)) {
    return { ok: false, reason: "Body used legacy HTML markup; must be plain text multi-voice." };
  }

  if (!hasNarratorOpeningParagraph(text)) {
    return { ok: false, reason: "Body must open with a narrator paragraph before dialogue." };
  }

  const speakerLines = countSpeakerLines(text);
  if (speakerLines < 4) {
    return { ok: false, reason: `Only ${speakerLines} speaker lines; need at least 4.` };
  }

  const speakers = extractSpeakerNames(text);
  if (speakers.length < 2) {
    return { ok: false, reason: `Only ${speakers.length} named speaker; need at least 2 distinct speakers.` };
  }

  return { ok: true };
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
    typeof (data as StoryJSON).arcType === "string" &&
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
    existingSynopses = [],
    usedCharacterNames = [],
    wordsToAvoid = [],
    existingArcTypes = [],
  } = params;
  const resolvedProvidedTitle = typeof providedTitle === "string" ? providedTitle.trim() : "";

  const learnerProfile = cefrPromptLabel(cefrLevel, level);
  const cefrCode = resolveCefrLevel(cefrLevel, level);
  const cefrLabel = cefrCode ? cefrCode.toUpperCase() : "";
  // Lexical constraint applies on every generation: keep the whole story
  // body — not only the highlighted vocab items — within the target CEFR
  // level. Narrow on purpose: lexicon only, no constraints on tense,
  // sentence length, or style.
  const lexicalEmphasis = cefrLabel
    ? `\nVocabulary level: keep EVERY word in the story body — not only the highlighted vocab items — at or below CEFR ${cefrLabel}. If a higher-level word is essential, swap it for a simpler equivalent. Do not flatten narrative tension, dialogue, or pacing — this constrains the lexicon only.`
    : "";
  const dedupedWordsToAvoid = Array.from(new Set(wordsToAvoid.map((w) => w.trim()).filter(Boolean))).slice(0, 40);
  const wordsToAvoidClause = dedupedWordsToAvoid.length && cefrLabel
    ? `\nA previous draft used these words flagged as above CEFR ${cefrLabel}. Do NOT reuse them — choose simpler equivalents that fit the level: ${dedupedWordsToAvoid.join(", ")}.`
    : "";
  const normalizedVariant = normalizeVariant(variant);
  const regionClause = region ? `, specifically from ${region}` : "";
  const variantClause = buildVariantPromptClause(language, normalizedVariant);
  const resolvedRequestedTopic = typeof topic === "string" ? topic.trim() : "";
  const resolvedSynopsis = typeof synopsis === "string" ? synopsis.trim() : "";

  const existingTitlesClause = existingTitles.length
    ? `\nNEVER reuse these existing titles or close variations: ${existingTitles.map((t) => `"${t}"`).join(", ")}. Use completely different characters, settings, and situations.`
    : "";
  // Tonal variety clause: feed up to 8 prior synopses so the model can
  // detect the dominant emotional shape of the journey and DELIBERATELY
  // vary it. The default failure mode is repetition: every story ends
  // with a warm encounter and a happy protagonist, which makes a journey
  // of 20+ stories feel monotone. Telling the model what tones already
  // exist lets it pick a fresh register.
  const tonalVarietyClause = existingSynopses.length
    ? `\n\nTONAL VARIETY (read carefully):
The journey already contains these synopses:
${existingSynopses.slice(0, 8).map((s, i) => `[${i + 1}] "${s.title}": ${s.synopsis}`).join("\n")}
Detect the DOMINANT emotional arc above (e.g. "friendly stranger helps protagonist, ends warmly", "protagonist rediscovers something familiar", "small triumph through patience"). The new story MUST use a different register. Avoid repeating the dominant arc. Possible alternatives:
- A moment of doubt or hesitation that doesn't fully resolve
- A small disappointment or missed connection handled with grace
- Comedic tension or a misunderstanding played for humor
- A contemplative monologue while alone (no second character)
- A bittersweet realization
- An open-ended decision the protagonist hasn't made yet
- A mildly frustrating interaction handled politely
The reader should finish this story feeling something different from what the previous synopses evoke. Do not default to "warm encounter, happy ending" if that pattern already dominates.`
    : "";
  const usedNamesClause = usedCharacterNames.length
    ? `\nNEVER reuse these character names (they already appear in other stories): ${usedCharacterNames.join(", ")}. Invent completely new, fresh character names.`
    : "";
  const existingArcTypesClause = existingArcTypes.length
    ? `\nRecent arc types already used nearby in this journey: ${existingArcTypes.join(", ")}. Prefer a different arc type unless the synopsis absolutely requires otherwise.`
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
Write a long engaging story for a ${learnerProfile} learner studying ${language}${regionClause}.${lexicalEmphasis}${wordsToAvoidClause}
${resolvedRequestedTopic ? `The topic of the story is "${resolvedRequestedTopic}".` : "Choose a clear, concrete topic that fits the level."}
${resolvedSynopsis ? `Use this synopsis as the main narrative foundation and keep all key beats coherent: "${resolvedSynopsis}".` : "If no synopsis is provided, invent a coherent narrative arc with clear beginning, development, and payoff."}
${titleClause}
${variantClause}
Return 18-22 vocabulary items (aim for 20). After post-processing filters transparent cognates and invalid multi-word fragments, this yields roughly 15-17 keeper items — the target the app needs.
All vocabulary definitions must be written in clear English, regardless of the story language.
Each definition must be 8-14 English words and read like a dictionary entry: describe the concept the word names, not the word itself.
Lead with the noun/concept, with an infinitive verb ("To join..."), or with a descriptive adjective phrase. Integrate any usage hint or short example into the same sentence.
Never start a definition with: "Refers to", "Describes", "Used to", "Used for", "Used in", "Used as", "Used when", "Means", "Means to", "Conveys", "Speaks to", "Brings", "This word", "A type of", "A person who", "Someone who", "Something that", "The action of", "The state of", "The quality of".
Never start with a one-word translation followed by punctuation (e.g. "Silence;", "Hurry,", "Homeland:") — that is a translation in disguise, not a definition.
Never start with article + noun (or article + noun + gender) followed by punctuation. Forbidden: "A book; bound pages...", "The market; vendors selling...", "A newspaper (f); printed news...", "To work; to do a job...". The first clause must already be doing definitional work, not announcing the gloss before the colon. Instead lead with a richer descriptor that integrates the meaning: "Bound printed pages read for pleasure or study", "Open-air gathering of vendors selling food and produce", "Daily printed news, read at home or in cafés".
Never use em-dashes (—); use semicolons, colons, commas, or parentheses instead.
Never return one-word literal translations.
Body format is REQUIRED:
- Plain text only. NO HTML. Do NOT use <blockquote>, <p>, <span>, or any tags.
- Open with one short narrator paragraph in close third person.
- After that, use multi-voice dialogue blocks in the exact form: Speaker: line
- Separate paragraphs/turns with blank lines.
- Use at least 2 distinct named speakers.
- Use at least 4 total speaker lines.
- The narrator may return briefly between dialogue sections, but the story must clearly read as multi-voice, not as single-voice prose with a few quoted lines.

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
- Do NOT let the body collapse into a single-character internal monologue. The reader should hear distinct people talking.
- The opening must feel authored, not templated. Avoid reusing the same camera move across stories.
- Do NOT default to this opening formula:
  - "Es [day/time] en [place]."
  - then a smell/weather sentence
  - then "X enters/walks/sees a small local place"
  - then a short inventory of tables, counter, window, or objects
- Specifically, avoid opening with "Es ..." unless there is a strong reason. Vary the first sentence shape across stories.
- Rotate among different opening strategies:
  - start with a concrete action already in progress
  - start with a line of dialogue, then reveal place/time
  - start with a striking object or sound tied to the conflict
  - start from the protagonist's inner tension before naming the setting
  - start with a small physical gesture that already implies the problem
- Delay at least one of these on purpose in many stories: the exact place, the exact time of day, the food item, or the full visual layout of the venue. Do not front-load all scene metadata in the first four sentences.
- Never use the same order every time: time -> place -> smell -> protagonist arrives -> inventory of the shop.
- If you mention sensory detail early, vary the sense; do not rely mostly on smell. Sound, texture, heat, light, crowd pressure, or body tension are equally valid.
- Choose exactly ONE arc type for the story and make the whole story execute it clearly:
  - white-lie
  - last-minute-decision
  - return-after-years
  - unspoken-subtext
  - plan-falls-short
  - late-reveal
  - small-stake
  - open-ending
  - daily-encounter
- The default transaction template is BANNED unless the synopsis explicitly forces it: protagonist asks for a specific food or drink, the item is unavailable, staff offers an alternative, protagonist tries it, likes it, and leaves warmly promising to return.
- Also avoid these fallback endings unless the arc explicitly demands them:
  - "esta muy rico" / "que rico" as the emotional payoff
  - a generic promise to come back another day
  - everyone smiling and parting warmly after a tiny inconvenience
- If the setting is a cafe, market, fonda, bakery, or stall, the food can stay central, but the arc must carry a fresh emotional or narrative movement beyond simple substitution or service recovery.${existingArcTypesClause}
- Length target: ${TARGET_STORY_WORDS_MIN}-${TARGET_STORY_WORDS_MAX} words.
- Absolute minimum: ${MIN_STORY_WORDS} words.
- Hard maximum: ${HARD_STORY_WORDS_MAX} words.${existingTitlesClause}${usedNamesClause}${tonalVarietyClause}
${retryClause}

Return ONLY valid JSON:
{
  "title": "string",
  "text": "string",
  "arcType": "white-lie|last-minute-decision|return-after-years|unspoken-subtext|plan-falls-short|late-reveal|small-stake|open-ending|daily-encounter",
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
    const arcType = raw.arcType.trim();
    const sanitized = sanitizeGeneratedStoryText(raw.text);
    const text =
      countStoryWords(sanitized) > HARD_STORY_WORDS_MAX
        ? truncateToWordLimit(sanitized, HARD_STORY_WORDS_MAX)
        : sanitized;

    const formatCheck = isValidMultiVoiceJourneyBody(text);
    if (!formatCheck.ok) {
      previousFeedback = formatCheck.reason ?? "Story body did not satisfy required multi-voice format.";
      continue;
    }

    const wordCount = countStoryWords(text);
    if (wordCount < MIN_STORY_WORDS) {
      previousFeedback = `${wordCount} words, need at least ${MIN_STORY_WORDS} (target ${TARGET_STORY_WORDS_MIN}-${TARGET_STORY_WORDS_MAX}). Expand scenes, dialogue, and internal reactions.`;
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
      finalPayload = { title, text, arcType, vocab: improvedVocab };
      continue;
    }

    finalPayload = { title, text, arcType, vocab: improvedVocab };
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
