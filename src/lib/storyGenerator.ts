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
  /**
   * First sentences of each story already in the same journey. Injected
   * into the prompt as a hard constraint: the new story's opening MUST
   * be syntactically distinct from every one of these. No prescribed
   * "right" opening — variety is enforced negatively, not via a fixed
   * rotation menu (which the model just memorizes and reuses).
   */
  existingOpenings?: string[];
  /**
   * Body style for the generated story.
   * - "multivoice" (default): narrator opener + `Speaker: line` dialogue blocks; >=2 named speakers, >=4 speaker lines. This is what the studio pipeline ships today; the prompt block is byte-identical to the historical one. Works at every CEFR level.
   * - "narrator": continuous prose carried by a close-third-person narrator. Dialogue stays embedded with quotation marks. Works at every CEFR level; the caller decides. Observed tendency (DE A1 experiment 2026-05-14): narrator prose drags grammar (Präteritum, declined-preposition relatives, zu-infinitives) toward A2+ even when the lexicon stays A1, because dialogue-free narration uses literary tenses. Multivoice avoids this because speaker turns force present + Perfekt. Use this knowledge when picking the style, not as a hard wall. Kept fully independent from the multi-voice prompt: changing one MUST NOT change the other.
   */
  storyStyle?: "multivoice" | "narrator";
};

const MAX_GENERATION_ATTEMPTS = 3;
const MIN_VOCAB_ITEMS = 20;

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

/**
 * Extract the first sentence of a story body. Handles three formats:
 *  - Plain-text multivoice (current default): take the narrator opening
 *    paragraph (everything before the first `Speaker:` line block), then
 *    its first sentence.
 *  - Legacy `<blockquote>...` HTML: take the first blockquote, then its
 *    first sentence.
 *  - Anything else: take the first sentence of the trimmed text.
 *
 * Used by the journey-generate / regenerate-text routes to feed the
 * model the actual openings of prior stories so the new opening can be
 * required to differ syntactically. Returns `""` for empty input.
 */
export function extractFirstSentence(text: string | null | undefined): string {
  if (!text) return "";
  let working = text.trim();
  if (!working) return "";

  const bqMatch = working.match(/<blockquote>([\s\S]*?)<\/blockquote>/i);
  if (bqMatch) {
    working = bqMatch[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  } else {
    const blocks = working.split(/\n{2,}/);
    const firstBlock = blocks[0]?.trim() ?? "";
    const lines = firstBlock.split("\n");
    const narratorLines: string[] = [];
    for (const line of lines) {
      if (/^[\p{Lu}][\p{L}\p{M}.'\-]*(?:\s+[\p{Lu}][\p{L}\p{M}.'\-]*){0,3}:\s+/u.test(line)) break;
      narratorLines.push(line);
    }
    working = narratorLines.join(" ").trim();
  }

  if (!working) return "";
  const sentenceMatch = working.match(/^[^.!?…]+[.!?…]/);
  return (sentenceMatch ? sentenceMatch[0] : working).trim();
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

/**
 * Validator for the NARRATOR-STYLE body. Lives next to the multi-voice
 * validator above but is fully independent: it must never share gates
 * with isValidMultiVoiceJourneyBody.
 *
 * Rules:
 *  - Same HTML ban as multivoice (we are not bringing back blockquote markup).
 *  - The body must NOT look like multi-voice: if the model emits 3+ `Speaker: line`
 *    blocks it slipped into the wrong style and we reject.
 *  - The first block must be a real prose paragraph, not a speaker tag.
 */
function isValidNarratorJourneyBody(text: string): { ok: boolean; reason?: string } {
  if (hasLegacyHtmlStoryMarkup(text)) {
    return { ok: false, reason: "Body used legacy HTML markup; must be plain text prose." };
  }

  const speakerLines = countSpeakerLines(text);
  if (speakerLines >= 3) {
    return {
      ok: false,
      reason: `Body looks like multi-voice (${speakerLines} 'Speaker: line' blocks). Narrator style must keep dialogue embedded inside prose with quotation marks; do not label lines with character names.`,
    };
  }

  if (!hasNarratorOpeningParagraph(text)) {
    return { ok: false, reason: "Body must open with a prose paragraph (not a 'Speaker: line' block)." };
  }

  return { ok: true };
}

// ──────────────────────────────────────────────────────────────────────────
// STYLE BLOCKS — body-format and style-specific Requirements bullets.
//
// These two constants are kept INDEPENDENT on purpose. The studio pipeline
// ships multi-voice by default; the narrator variant exists for experiments
// (and for languages where free multi-voice TTS is not viable). Touching
// one MUST NOT touch the other. Do not factor them through a shared helper.
// ──────────────────────────────────────────────────────────────────────────

// Multi-voice body format. Byte-identical to the historical prompt block.
const MULTIVOICE_BODY_FORMAT_BLOCK = `Body format is REQUIRED:
- Plain text only. NO HTML. Do NOT use <blockquote>, <p>, <span>, or any tags.
- Open with one short narrator paragraph in close third person.
- After that, use multi-voice dialogue blocks in the exact form: Speaker: line
- Separate paragraphs/turns with blank lines.
- Use at least 2 distinct named speakers.
- Use at least 4 total speaker lines.
- The narrator may return briefly between dialogue sections, but the story must clearly read as multi-voice, not as single-voice prose with a few quoted lines.`;

// Multi-voice pacing bullets (the two bullets in the Requirements section that
// are style-specific). Byte-identical to the historical prompt.
const MULTIVOICE_PACING_BULLETS = `- Include frequent dialogue beats and immediate reactions to keep pacing lively.
- Do NOT let the body collapse into a single-character internal monologue. The reader should hear distinct people talking.`;

// Narrator body format. Used ONLY when params.storyStyle === "narrator".
const NARRATOR_BODY_FORMAT_BLOCK = `Body format is REQUIRED:
- Plain text only. NO HTML. Do NOT use <blockquote>, <p>, <span>, or any tags.
- Continuous prose carried by a close third-person narrator with strong internal focalization. A single TTS voice will read the whole body, so do NOT split lines by speaker.
- Do NOT use the multi-voice "Speaker: line" format. Do NOT prefix any paragraph with a character name followed by a colon.
- Dialogue is allowed and welcome, but it MUST stay embedded inside narrative paragraphs, using standard quotation marks native to the target language («», "", or curly quotes). Never use em-dashes as dialogue delimiters (em-dashes are banned project-wide).
- Split the body into 4 or more prose paragraphs separated by blank lines.
- Quoted speech is a beat inside the prose, never the structural skeleton of the story.
- A single-character contemplative arc is fully valid in this style; the narrator can carry the whole story without a second speaker.`;

// Narrator pacing bullets. Replace the multi-voice cluster bullet-for-bullet.
const NARRATOR_PACING_BULLETS = `- Maintain pacing through swift scene cuts, concrete sensory beats, and short paragraphs; embedded dialogue is welcome but never required.
- A single-protagonist arc is fully valid; the narrator can carry the entire story without a second speaker. Internal monologue and contemplative scenes are explicitly allowed.`;

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
    existingOpenings = [],
    storyStyle = "multivoice",
  } = params;

  const learnerProfile = cefrPromptLabel(cefrLevel, level);
  const cefrCode = resolveCefrLevel(cefrLevel, level);
  const cefrLabel = cefrCode ? cefrCode.toUpperCase() : "";

  // Note (not enforced): the 2026-05-14 narrator-A1 experiment with
  // `Pellkartoffeln am Abend` (DE) showed that continuous prose narration
  // tends to pull grammar (Präteritum, declined-preposition relatives,
  // zu-infinitives) toward A2+ even when the lexicon stays A1. The
  // multivoice format constrains grammar mechanically via speaker turns;
  // narrator prose does not. Worth knowing when choosing the style, but
  // the caller decides — generator does not gate on level.

  // Select the style-specific blocks/validator once per call. The branches
  // are intentionally fully separate; see the comment above the constants.
  const bodyFormatBlock =
    storyStyle === "narrator" ? NARRATOR_BODY_FORMAT_BLOCK : MULTIVOICE_BODY_FORMAT_BLOCK;
  const pacingBullets =
    storyStyle === "narrator" ? NARRATOR_PACING_BULLETS : MULTIVOICE_PACING_BULLETS;
  const validateBody =
    storyStyle === "narrator" ? isValidNarratorJourneyBody : isValidMultiVoiceJourneyBody;
  const resolvedProvidedTitle = typeof providedTitle === "string" ? providedTitle.trim() : "";
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
  // Opening-variety constraint. The model has a strong tendency at A1 to
  // default to "Es ist [time] [place]." or some other safe formula it
  // memorized from training. Prescriptive rotation menus ("rotate among
  // 5 strategies") just become the new fallback. Instead, we list the
  // ACTUAL first sentences already in the journey and require the new
  // opening to be syntactically distinct from every one of them — no
  // prescribed correct shape, just a forbidden set that grows with each
  // saved story.
  const existingOpeningsClause = existingOpenings.length
    ? `\n\nOPENING VARIETY (HARD CONSTRAINT, read carefully):
These are the first sentences of every story already in this journey:
${existingOpenings.slice(0, 24).map((o, i) => `[${i + 1}] ${o}`).join("\n")}
Your story's first sentence MUST be syntactically distinct from every one of these. Do not echo their word order, their grammatical shape, their setup pattern, or their lead element. Specifically:
- If many of them start with "Es ist [time-marker] ...", yours must NOT start with "Es ist" — not as a softer variant, not at all.
- If many of them lead with a time-marker followed by a place-marker, yours must lead with something else entirely.
- Vary verb position, sentence type (declarative / fragment / line of dialogue), subject placement, and the kind of detail you front-load (action, sensory, internal, environmental, object, character gesture).
There is NO prescribed correct opening shape. Invent the opening you think serves THIS story best, with the only rule that it must not echo any of the openings above. The set of forbidden patterns grows with every saved story — variety is enforced cumulatively, not by a fixed rotation menu.`
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
Return 26-30 vocabulary items. After post-processing filters transparent cognates and invalid multi-word fragments, this must still yield at least 20 keeper items (the app's hard minimum; ideal final list is 20-25).
Vocabulary serves TWO jobs and the list must cover both:
1. Comprehension — gloss the words that would BLOCK this reader if unknown. At A1/A2 these are the rare, concrete, scene-specific nouns (e.g. cod, apron, lemon). Include them BECAUSE they are unfamiliar; that is the point of an in-story gloss. Do NOT skip a word just because it is low-frequency or only appears in this scene.
2. Acquisition — high-frequency, transferable verbs/adjectives/connectors the learner reuses everywhere (to need, to take, important, nice, to pay).
Aim for roughly one third concrete comprehension-blockers and two thirds transferable words. The only thing to exclude is "rare AND irrelevant": proper nouns (names, cities, neighborhoods, brands) are recognized without a gloss — never teach them. A rare common noun that is central to the scene IS taught.
All vocabulary definitions must be written in clear English, regardless of the story language.
HARD LIMIT: each definition must be 3-7 English words AND no more than 50 characters total (counting spaces). Both bounds are mandatory; do not exceed either. Treat this as a UI constraint: the definition must fit on a small mobile chip without wrapping.
Style: a concise gloss in the spirit of a translation app (Linguee/Reverso/DeepL). Lead with the noun/concept, with an infinitive verb ("To join..."), or with a descriptive adjective phrase. Two senses joined by ";" or "," are fine if they stay under the limit.
Never use em-dashes (—); use semicolons, colons, commas, or parentheses instead.
Never return a single word with no qualifier (e.g. "Idea", "Stir"). Add at least one clarifying word or sense ("An idea or concept", "To stir gently").
Never write long descriptive paraphrases ("An idea or concept about something abstract"); compress to the essential gloss.
${bodyFormatBlock}

CRITICAL — no non-vocalized sounds, ever. The narrator voice is a real TTS (ElevenLabs) that CANNOT render laughs, sighs, hums, or stage directions. Any of these in the body breaks the audio and the story has to be re-written:
- NO laughter spelled out: "haha", "jaja", "jeje", "Hahaha", "ja ja", "hehe", "kkk", etc.
- NO hesitation/filler sounds: "hmm", "hmmm", "uhm", "ehm", "uh", "eh", "mh", "ahh".
- NO reaction sounds: "mmm" (as a sound), "oh!", "ohh", "aww", "ay", "uy", "ugh", "wow", "ay dios", "Mein Gott".
- NO stage directions inside dialogue: "(laughs)", "(sighs)", "[ríe]", "*pause*".
Render reactions as REAL WORDS instead: instead of "Hahaha! Ich auch, fast." write "Ich auch, fast." — the laugh is implied. Instead of "Mmm! Wieso ist roher Teig so lecker?" write "Wieso ist roher Teig so lecker?". If a character needs to express surprise, joy, or disgust, use complete words ("Was für ein Glück", "Ich war ungeduldig", "Das schmeckt seltsam") — never paralinguistic spelling.

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
${pacingBullets}
- The opening must feel authored, not templated. The hard constraint on opening variety is enforced separately below (see "OPENING VARIETY") — that section, NOT a fixed rotation menu, is the source of truth on what your first sentence can look like.
- Do NOT default to this scene-setup formula in the first few sentences: time-marker, place-marker, smell/weather sentence, then "X enters/walks/sees a small local place", then a short inventory of tables / counter / window. Even if your first sentence is not literally "Es ist [time] [place]", front-loading all scene metadata in the same predictable order makes every story feel templated. Delay at least one of these on purpose: the exact place, the exact time of day, the food item, or the full visual layout of the venue.
- If you mention sensory detail early, vary the sense; do not rely mostly on smell. Sound, texture, heat, light, crowd pressure, body tension, or an overheard fragment are equally valid.
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
- Hard maximum: ${HARD_STORY_WORDS_MAX} words.${existingTitlesClause}${usedNamesClause}${tonalVarietyClause}${existingOpeningsClause}
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

    const formatCheck = validateBody(text);
    if (!formatCheck.ok) {
      previousFeedback =
        formatCheck.reason ??
        (storyStyle === "narrator"
          ? "Story body did not satisfy required narrator-style format."
          : "Story body did not satisfy required multi-voice format.");
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
      previousFeedback = `vocab had ${improvedVocab.length} items after filtering, need at least ${MIN_VOCAB_ITEMS}. Return more candidate items next time (aim for 28).`;
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
