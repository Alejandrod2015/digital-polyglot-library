import { NextResponse } from "next/server";
import OpenAI from "openai";
import { generateAndUploadAudio } from "@/lib/elevenlabs";
import { inferTopicFromText } from "@/lib/topicClassifier";
import { improveVocabDefinitions } from "@/lib/vocabQuality";
import { isInvalidMultiwordVocab, normalizeToken } from "@/lib/vocabSelection";
import {
  HARD_STORY_WORDS_MAX,
  MIN_STORY_WORDS,
  TARGET_STORY_WORDS_MAX,
  TARGET_STORY_WORDS_MIN,
  countStoryWords,
} from "@/lib/storyLength";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

type StoryJSON = {
  title: string;
  text: string;
  vocab: { word: string; definition: string; type?: string }[];
};

const MAX_GENERATION_ATTEMPTS = 3;

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
    let previousFeedback = "";
    let finalPayload: StoryJSON | null = null;

    for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
      const retryClause =
        attempt === 0
          ? ""
          : `\nRetry constraints: the previous story was too short. Expand the scenes, dialogue, internal reactions, and consequences. Do not end early.`;

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
- Prefer useful short fixed expressions, nuanced verbs, and culturally specific phrases.
- Single words are preferred.
- If you return more than one word, it must be a short lexicalized expression or idiom (usually 2-3 words).
- Any multi-word item MUST use type "expression".
- Good examples: "de repente", "por fin", "al menos".
- Bad examples: "con cada ensayo", "buenos momentos", "manos temblando", "sazonar correctamente", "mostrar lo que somos".
- Never include arbitrary sentence fragments or descriptive chunks like "con cada ensayo", "forma de contar historias", or "mostrar lo que somos".
- Avoid transparent international/basic cognates such as "importante", "normal", "general", "social", or their direct equivalents unless essential.
- Keep the narrative specific and vivid (concrete scenes, actions, and consequences), not generic.
- Keep paragraphs short and dynamic (usually 1-3 sentences per paragraph).
- Avoid long expository narrator blocks; reduce detached description and increase character-centered viewpoint.
- Include frequent dialogue beats and immediate reactions to keep pacing lively.
- Length target: ${TARGET_STORY_WORDS_MIN}-${TARGET_STORY_WORDS_MAX} words.
- Absolute minimum: ${MIN_STORY_WORDS} words.
- Hard maximum: ${HARD_STORY_WORDS_MAX} words.
${retryClause}

Return ONLY valid JSON:
{
  "title": "string",
  "text": "string",
  "vocab": [{ "word": "string", "definition": "string", "type": "verb|noun|adjective|adverb|expression|slang" }]
}
`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: attempt === 0 ? 0.8 : 0.6,
        messages: [
          { role: "system", content: "You are a creative story generator for language learners." },
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
      const title = raw.title.trim() || "Untitled";
      const sanitized = sanitizeGeneratedStoryText(raw.text);
      const text =
        countStoryWords(sanitized) > HARD_STORY_WORDS_MAX
          ? truncateToWordLimit(sanitized, HARD_STORY_WORDS_MAX)
          : sanitized;

      if (countStoryWords(text) < MIN_STORY_WORDS) {
        previousFeedback = "Story is below the minimum length.";
        continue;
      }

      const improvedVocab = await improveVocabDefinitions(openai, {
        items: sanitizeGeneratedVocab(raw.vocab, text),
        language,
        level,
        focus,
        topic: resolvedRequestedTopic,
        text,
      });

      finalPayload = { title, text, vocab: improvedVocab };
      break;
    }

    if (!finalPayload) {
      return NextResponse.json(
        {
          error: `Could not generate a story of at least ${MIN_STORY_WORDS} words.`,
          details: previousFeedback || "Generation did not satisfy the minimum length.",
        },
        { status: 502 }
      );
    }

    const inferredTopic = inferTopicFromText({
      title: finalPayload.title,
      text: finalPayload.text,
      existingTopic: resolvedRequestedTopic,
      fallback: "Daily life",
    });

    let audioAssetUrl: string | null = null;
    let audioAssetId: string | null = null;
    if (withAudio) {
      try {
        console.log("[api] generate-text called with", language, region);
        const audioResult = await generateAndUploadAudio(finalPayload.text, finalPayload.title, language, region);
        audioAssetUrl = audioResult ? audioResult.url : null;
        audioAssetId = audioResult ? audioResult.assetId : null;
      } catch (e) {
        console.error("[audio] generation/upload failed:", e);
      }
    }

    return NextResponse.json({
      content: JSON.stringify(finalPayload),
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
