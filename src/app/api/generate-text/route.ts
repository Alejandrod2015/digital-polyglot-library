import { NextResponse } from "next/server";
import OpenAI from "openai";
import { generateAndUploadAudio } from "@/lib/elevenlabs";
import { inferTopicFromText } from "@/lib/topicClassifier";
import { improveVocabDefinitions } from "@/lib/vocabQuality";
import { isInvalidMultiwordVocab, normalizeToken } from "@/lib/vocabSelection";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

type StoryJSON = {
  title: string;
  text: string;
  vocab: { word: string; definition: string; type?: string }[];
};

const TARGET_WORDS_MIN = 340;
const TARGET_WORDS_MAX = 460;
const HARD_WORDS_MAX = 500;

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

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
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
  storyText: string
): StoryJSON["vocab"] {
  const seen = new Set<string>();
  const out: StoryJSON["vocab"] = [];

  for (const item of items) {
    const word = typeof item.word === "string" ? item.word.trim() : "";
    const definition = typeof item.definition === "string" ? item.definition.trim() : "";
    const type = typeof item.type === "string" ? item.type.trim() : undefined;
    if (!word || !definition) continue;
    if (isInvalidMultiwordVocab(word, { type, storyText })) continue;
    const key = normalizeToken(word);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(type ? { word, definition, type } : { word, definition });
  }

  return out;
}

function parseStoryPayload(content: string): unknown {
  const trimmed = content.trim();
  const maybeFence = trimmed.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  const parsed = JSON.parse(maybeFence) as unknown;
  return typeof parsed === "string" ? (JSON.parse(parsed) as unknown) : parsed;
}

export async function POST(req: Request) {
  try {
    let body = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid or missing JSON body" }, { status: 400 });
    }

    const withAudio = new URL(req.url).searchParams.get("withAudio") === "true";

    const {
      language = "Spanish",
      region,
      level = "intermediate",
      focus = "verbs",
      topic = "",
      synopsis = "",
    } = body as {
      language?: string;
      region?: string;
      level?: string;
      focus?: string;
      topic?: string;
      synopsis?: string;
    };

    const regionClause = region ? `, specifically from ${region}` : "";

    const resolvedRequestedTopic = typeof topic === "string" ? topic.trim() : "";
    const resolvedSynopsis = typeof synopsis === "string" ? synopsis.trim() : "";
    const prompt = `
You are an expert language teacher and long story writer.
Write a long engaging story for a ${level} student learning ${language}${regionClause}.
${resolvedRequestedTopic ? `The topic of the story is "${resolvedRequestedTopic}".` : "Choose a clear, concrete topic that fits the level."}
${resolvedSynopsis ? `Use this synopsis as the main narrative foundation and keep all key beats coherent: "${resolvedSynopsis}".` : "If no synopsis is provided, invent a coherent narrative arc with clear beginning, development, and payoff."}
All vocabulary definitions must be written in clear English, regardless of the story language.
Each vocabulary definition must be a pedagogical explanation (8-18 words), with usage nuance in context.
Never return one-word literal translations.
Never begin a definition with a direct gloss plus comma/colon (for example: "To change, ..." or "Important, ...").
Wrap each paragraph inside <blockquote> ... </blockquote>.

Requirements:
Use a close third-person narrator with strong internal focalization.
- The narrator is NOT a character.
- Most of the story should be experienced from inside the characters' perspective (thoughts, sensations, doubts, intentions, quick judgments).
- Keep the prose mainly in third person, but use first-person phrasing only inside dialogue or brief inner-thought moments when natural.
- Prioritize ${focus.toLowerCase()} in lexical choices and situations.
- Prefer useful multi-word expressions, discourse markers, nuanced verbs, and culturally specific phrases.
- Single words are preferred.
- If you return more than one word, it must be a short lexicalized expression, discourse marker, or idiom (usually 2-3 words).
- Good examples: "de repente", "por fin", "al menos".
- Bad examples: "con cada ensayo", "buenos momentos", "manos temblando", "sazonar correctamente", "mostrar lo que somos".
- Never include arbitrary sentence fragments or descriptive chunks like "con cada ensayo", "forma de contar historias", or "mostrar lo que somos".
- Avoid transparent international/basic cognates such as "importante", "normal", "general", "social", or their direct equivalents unless essential.
- Keep the narrative specific and vivid (concrete scenes, actions, and consequences), not generic.
- Keep paragraphs short and dynamic (usually 1-3 sentences per paragraph).
- Avoid long expository narrator blocks; reduce detached description and increase character-centered viewpoint.
- Include frequent dialogue beats and immediate reactions to keep pacing lively.
- Length target: ${TARGET_WORDS_MIN}-${TARGET_WORDS_MAX} words, hard maximum ${HARD_WORDS_MAX} words.

Return ONLY valid JSON:
{
  "title": "string",
  "text": "string",
  "vocab": [{ "word": "string", "definition": "string", "type": "verb|noun|adjective|adverb|expression" }]
}
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.8,
      messages: [
        { role: "system", content: "You are a creative story generator for language learners." },
        { role: "user", content: prompt },
      ],
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      return NextResponse.json({ error: "No content returned from OpenAI" }, { status: 502 });
    }

    let parsed: unknown;
    try {
      parsed = parseStoryPayload(content);
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON format returned from model", raw: content },
        { status: 500 }
      );
    }

    if (!isValidStoryJSON(parsed)) {
      return NextResponse.json(
        { error: "Invalid structure in model output", raw: parsed },
        { status: 500 }
      );
    }

    const raw = parsed as StoryJSON;
    const title = raw.title.trim() || "Untitled";
    const sanitized = sanitizeGeneratedStoryText(raw.text);
    const text =
      countWords(sanitized) > HARD_WORDS_MAX
        ? truncateToWordLimit(sanitized, HARD_WORDS_MAX)
        : sanitized;

    const improvedVocab = await improveVocabDefinitions(openai, {
      items: sanitizeGeneratedVocab(raw.vocab, text),
      language,
      level,
      focus,
      topic: resolvedRequestedTopic,
      text,
    });

    const inferredTopic = inferTopicFromText({
      title,
      text,
      existingTopic: resolvedRequestedTopic,
      fallback: "Daily life",
    });

    const normalizedPayload: StoryJSON = { title, text, vocab: improvedVocab };

    let audioAssetUrl: string | null = null;
    let audioAssetId: string | null = null;
    if (withAudio) {
      try {
        console.log("[api] generate-text called with", language, region);
        const audioResult = await generateAndUploadAudio(text, title, language, region);
        audioAssetUrl = audioResult ? audioResult.url : null;
        audioAssetId = audioResult ? audioResult.assetId : null;
      } catch (e) {
        console.error("[audio] generation/upload failed:", e);
      }
    }

    return NextResponse.json({
      content: JSON.stringify(normalizedPayload),
      audioAssetUrl,
      audioAssetId,
      topic: inferredTopic,
    });
  } catch (error) {
    console.error("Error generating text:", error);
    const err = error as Error;
    return NextResponse.json(
      { error: "Failed to generate story", details: err.message },
      { status: 500 }
    );
  }
}
