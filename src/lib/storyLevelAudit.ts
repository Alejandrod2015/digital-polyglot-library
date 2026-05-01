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

  // Two-level tolerance: a word is an offender only if its CEFR level is
  // at least TWO steps above the target. A learner is naturally exposed
  // to one-level-up vocabulary in any normal text — only larger gaps
  // signal "this story isn't really at level X".
  const LEVEL_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"];
  const targetIdx = LEVEL_ORDER.indexOf(targetLevel);
  const flagFromIdx = targetIdx >= 0 ? targetIdx + 2 : -1;
  const flagFromLevel = flagFromIdx >= 0 && flagFromIdx < LEVEL_ORDER.length ? LEVEL_ORDER[flagFromIdx] : null;
  const flagLevels = flagFromLevel ? LEVEL_ORDER.slice(flagFromIdx).join(", ") : "(none — target is at the top)";

  const prompt = `
You are a CEFR vocabulary auditor for ${language}.

Target level: ${targetLevel}

# What to flag
A word is an OFFENDER only if its CEFR level is TWO OR MORE levels above the target. With target ${targetLevel}, flag ONLY words at: ${flagLevels}. Do NOT flag words one level above the target — being one level up is normal exposure for any learner and a story at the right level naturally contains some.

# Hard rules to keep classification consistent
1. High-frequency everyday words (top ~500 lemmas of ${language}) are A1, even when used in complex sentences. Common verbs of being/having/doing/saying/moving, common nouns for time/people/places/objects, common adjectives for size/quality/age all stay A1 unless they appear in a clearly idiomatic or technical sense.
2. A transparent derivation of an A1 root is at most ONE level above the root. So an A1 root → A2 derivation (not B2 or higher).
3. Loanwords and international cognates that any educated reader recognizes at sight, regardless of L1, are at most A2.
4. When uncertain between two adjacent levels, pick the LOWER one.
5. Proper nouns (people, places, brands), numbers, and basic interjections are never offenders.

# Output
Read the story below. List every DISTINCT lemma whose level meets the "two or more above target" rule. Group all surface forms of the same lemma into one entry.

For each offender, return:
- "word": dictionary/lemma form
- "surface": the form actually used in the story (pick one representative occurrence)
- "estimatedLevel": one of "A1","A2","B1","B2","C1","C2" (must be >= ${flagFromLevel ?? "C2"})

Return ONLY valid JSON of this shape:
{
  "offenders": [
    { "word": "string", "surface": "string", "estimatedLevel": "${flagFromLevel ?? "C2"}" }
  ]
}

If every word is below the flag threshold, return { "offenders": [] }.

STORY:
${cleanText}
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    messages: [
      { role: "system", content: "You audit text for CEFR vocabulary level. You apply the rules conservatively — when in doubt, the word is fine. Output JSON only, no prose." },
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
    const estimatedLevel = typeof record.estimatedLevel === "string" ? record.estimatedLevel.trim().toUpperCase() : "?";
    // Hard threshold guard: drop anything the model labeled below the
    // 2-levels-above-target floor, even if it ignored the prompt.
    if (flagFromIdx >= 0) {
      const estIdx = LEVEL_ORDER.indexOf(estimatedLevel);
      if (estIdx < 0 || estIdx < flagFromIdx) continue;
    }
    seen.add(key);
    offenders.push({
      word,
      surface: typeof record.surface === "string" ? record.surface.trim() || word : word,
      estimatedLevel,
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
