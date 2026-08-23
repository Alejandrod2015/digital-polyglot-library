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
  /**
   * Palabra ANCLADA a su escena (`truffade`, `accordéon`, `cheville`): abre esa
   * historia y no se le promete reuso. Las demás son PORTABLES y tienen que
   * reencontrarse por el journey ([[project_vocab_recirculation_ladder]]).
   *
   * Lo marca quien escribe, al elegir el vocab, porque es una decisión de
   * diseño y ningún detector la acierta: `la glace` es anclada en la historia
   * del tobillo y portable en cualquier otra. Sin la marca, la escalera mide
   * juntas dos cosas distintas y exige que el acordeón vuelva tres veces.
   */
  anchor?: boolean;
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
