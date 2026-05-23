// Pure types + JSON parser for the story payload shape. Lives in its own
// file with ZERO dependencies on Node fs / server-only modules so it can
// be imported safely from Client Components (e.g. ValidarPageClient).
//
// The heavy `validateGeneratedStory` lives in `validateGeneratedStory.ts`
// and depends on the LLM CEFR judge (server-only). Client code that just
// needs to parse a payload should import from THIS file.

export type StoryVocabItem = {
  word: string;
  definition: string;
  surface?: string;
  type?: string;
};

export type StoryPayload = {
  title: string;
  synopsis: string;
  arcType: string;
  text: string;
  vocab: StoryVocabItem[];
};

function isStoryPayload(x: unknown): x is StoryPayload {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.title === "string" &&
    typeof o.synopsis === "string" &&
    typeof o.arcType === "string" &&
    typeof o.text === "string" &&
    Array.isArray(o.vocab)
  );
}

/** Parse raw input string into a StoryPayload, tolerating leading code fences
 *  and stray whitespace. Returns null if it cannot be parsed. */
export function parseStoryInput(input: string): StoryPayload | null {
  if (!input || typeof input !== "string") return null;
  let cleaned = input.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  try {
    const parsed = JSON.parse(cleaned) as unknown;
    if (isStoryPayload(parsed)) return parsed;
    return null;
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      const parsed = JSON.parse(m[0]) as unknown;
      if (isStoryPayload(parsed)) return parsed;
    } catch {
      // ignore
    }
    return null;
  }
}
