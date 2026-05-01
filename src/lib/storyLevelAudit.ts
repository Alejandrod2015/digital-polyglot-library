import OpenAI from "openai";

export type LevelAuditOffender = {
  word: string;
  surface: string;
  estimatedLevel: string;
};

export type LevelAuditResult = {
  cefrLevel: string;
  language: string;
  totalUniqueWords: number;
  offendingCount: number;
  /** % of unique words at or below the requested CEFR level. */
  score: number;
  offenders: LevelAuditOffender[];
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function uniqueWordCount(text: string): number {
  const tokens = stripHtml(text)
    .toLowerCase()
    .replace(/[^\p{L}'\- ]+/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0);
  return new Set(tokens).size;
}

function parseAuditJson(content: string): unknown {
  const trimmed = content.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error("Auditor returned invalid JSON.");
  }
}

/**
 * LLM-as-judge: send the full story body + target CEFR level to gpt-4o-mini
 * and ask for the list of words above the requested level. Score is computed
 * in code (offenders / unique words) so the model can't fudge it.
 *
 * Multi-language by design — relies on the model's CEFR knowledge for the
 * target language rather than per-language frequency lists.
 */
export async function auditStoryVocabularyLevel(args: {
  text: string;
  language: string;
  cefrLevel: string;
}): Promise<LevelAuditResult> {
  const { text, language, cefrLevel } = args;
  const cleanText = stripHtml(text);
  const totalUniqueWords = uniqueWordCount(cleanText);
  const targetLevel = cefrLevel.trim().toUpperCase();

  const prompt = `
You are a CEFR vocabulary auditor for ${language}.

Target level: ${targetLevel}

Read the story text below. List EVERY distinct word (use the dictionary/lemma form) whose CEFR level is HIGHER than ${targetLevel} for a learner of ${language}. Ignore proper nouns (people, place, brand names) and basic numbers. Group all surface forms of the same lemma into ONE entry.

For each offender, return:
- "word": dictionary/lemma form
- "surface": the form actually used in the story (pick one representative occurrence)
- "estimatedLevel": one of "A1","A2","B1","B2","C1","C2"

Return ONLY valid JSON of this shape:
{
  "offenders": [
    { "word": "string", "surface": "string", "estimatedLevel": "B2" }
  ]
}

If every word is at or below ${targetLevel}, return { "offenders": [] }.

STORY:
${cleanText}
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.1,
    messages: [
      { role: "system", content: "You audit text for CEFR vocabulary level. Output JSON only, no prose." },
      { role: "user", content: prompt },
    ],
  });

  const content = response.choices[0]?.message?.content?.trim() ?? "";
  const parsed = parseAuditJson(content) as { offenders?: unknown };
  const rawOffenders = Array.isArray(parsed.offenders) ? parsed.offenders : [];

  const seen = new Set<string>();
  const offenders: LevelAuditOffender[] = [];
  for (const item of rawOffenders) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const word = typeof record.word === "string" ? record.word.trim() : "";
    if (!word) continue;
    const key = word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    offenders.push({
      word,
      surface: typeof record.surface === "string" ? record.surface.trim() || word : word,
      estimatedLevel: typeof record.estimatedLevel === "string" ? record.estimatedLevel.trim().toUpperCase() : "?",
    });
  }

  const score = totalUniqueWords > 0
    ? Math.round(((totalUniqueWords - offenders.length) / totalUniqueWords) * 1000) / 10
    : 100;

  return {
    cefrLevel: targetLevel,
    language,
    totalUniqueWords,
    offendingCount: offenders.length,
    score,
    offenders,
  };
}
