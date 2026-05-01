import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function parseJsonLoose(content: string): unknown {
  const trimmed = content.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = Math.max(trimmed.indexOf("{"), trimmed.indexOf("["));
    const end = Math.max(trimmed.lastIndexOf("}"), trimmed.lastIndexOf("]"));
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error("Model returned invalid JSON.");
  }
}

/**
 * LLM extractor for real PERSON names across a journey's prior story texts.
 * Replaces the previous regex (`/\b[A-Z][a-zà-ü]+/`) which captured every
 * capitalized token — including places (Trastevere, Roma), days (Lunedì),
 * brands, and food names — and produced false positives that polluted the
 * "do not reuse these names" prompt.
 *
 * Returns deduped lemma names (e.g. ["Marco", "Anna", "Luca"]). Empty when
 * `texts` is empty so callers don't pay for the LLM round-trip in that case.
 */
export async function extractCharacterNames(args: {
  texts: string[];
  language: string;
  limit?: number;
}): Promise<string[]> {
  const { texts, language, limit = 30 } = args;
  const cleaned = texts.map(stripHtml).filter((t) => t.length > 0);
  if (cleaned.length === 0) return [];

  // Concatenate with a separator so the model sees one input but can still
  // tell stories apart. We trim each excerpt to keep the request bounded.
  const joined = cleaned.map((t, i) => `--- Story ${i + 1} ---\n${t.slice(0, 1500)}`).join("\n\n");

  const prompt = `
You are extracting PERSON names from ${language} story texts.

Read the texts below and return a JSON array of every distinct first name OR full name of a HUMAN CHARACTER mentioned. Use the form actually used in the text.

DO NOT include:
- place names (cities, neighborhoods, countries, streets, venues)
- food, drink, or dish names
- brand or product names
- days of the week, months, holidays
- titles or roles without a personal name (e.g. "El camarero", "La signora")
- any token that is just a generic capitalized word

If a name appears in multiple stories, include it once.

Return ONLY: { "names": ["Marco", "Anna", ...] }

TEXTS:
${joined}
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.1,
      messages: [
        { role: "system", content: "You extract person names from fiction. Output JSON only." },
        { role: "user", content: prompt },
      ],
    });
    const content = response.choices[0]?.message?.content?.trim() ?? "";
    const parsed = parseJsonLoose(content) as { names?: unknown };
    const raw = Array.isArray(parsed.names) ? parsed.names : [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of raw) {
      if (typeof item !== "string") continue;
      const name = item.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(name);
      if (out.length >= limit) break;
    }
    return out;
  } catch (err) {
    console.warn("[storyDedupe] extractCharacterNames failed:", err);
    return [];
  }
}

export type SynopsisSimilarityResult = {
  isSimilar: boolean;
  conflictingTitle?: string;
  reason?: string;
};

/**
 * LLM-as-judge: does the new synopsis tell substantially the same story as
 * any of the existing synopses? "Same story" means: same core situation,
 * same conflict shape, or same payoff — not just sharing setting/cuisine.
 *
 * Returns `{ isSimilar: false }` when there are no existing synopses (no
 * round-trip).
 */
export async function findSimilarSynopsis(args: {
  newSynopsis: string;
  existingSynopses: { title: string; synopsis: string }[];
  language: string;
}): Promise<SynopsisSimilarityResult> {
  const { newSynopsis, existingSynopses, language } = args;
  const valid = existingSynopses.filter((s) => s.synopsis && s.synopsis.trim().length > 0);
  if (valid.length === 0 || !newSynopsis.trim()) return { isSimilar: false };

  const numbered = valid
    .map((s, i) => `[${i + 1}] "${s.title}" — ${s.synopsis.trim()}`)
    .join("\n");

  const prompt = `
You are checking if a new story synopsis duplicates the narrative arc of any existing synopsis from the same journey.

Two synopses are "the same story" when they share the CORE situation, conflict, OR payoff — for example: both are "character orders food, gets the wrong dish, stays polite", or both are "character meets old friend by chance and reminisces". Sharing only the SETTING (same neighborhood, same cuisine) is NOT enough — say NOT similar in that case.

Existing synopses:
${numbered}

New synopsis:
"${newSynopsis.trim()}"

Return ONLY: { "isSimilar": true|false, "conflictingIndex": <number or null>, "reason": "<one short sentence in English>" }

If isSimilar is true, conflictingIndex is the [N] of the existing synopsis that matches.
`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.1,
      messages: [
        { role: "system", content: `You are a strict but fair narrative-overlap judge for ${language} stories. Output JSON only.` },
        { role: "user", content: prompt },
      ],
    });
    const content = response.choices[0]?.message?.content?.trim() ?? "";
    const parsed = parseJsonLoose(content) as {
      isSimilar?: unknown;
      conflictingIndex?: unknown;
      reason?: unknown;
    };
    const isSimilar = parsed.isSimilar === true;
    if (!isSimilar) return { isSimilar: false };
    const idx = typeof parsed.conflictingIndex === "number" ? parsed.conflictingIndex - 1 : -1;
    const conflicting = idx >= 0 && idx < valid.length ? valid[idx] : undefined;
    const reason = typeof parsed.reason === "string" ? parsed.reason.trim() : undefined;
    return {
      isSimilar: true,
      conflictingTitle: conflicting?.title,
      reason,
    };
  } catch (err) {
    console.warn("[storyDedupe] findSimilarSynopsis failed:", err);
    return { isSimilar: false };
  }
}
