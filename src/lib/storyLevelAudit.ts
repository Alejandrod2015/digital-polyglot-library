import OpenAI from "openai";

export type LevelAuditHighlight = {
  word: string;
  surface: string;
  estimatedLevel: string;
};

export type LevelAuditResult = {
  cefrLevel: string;
  language: string;
  /** 0-100 holistic fit score: how well the text reads as the target level. */
  score: number;
  /** One-sentence human-readable verdict from the judge. */
  summary: string;
  /**
   * A short, illustrative list of words/phrases that most stand out as
   * above the target level. NOT an exhaustive offender list — the judge
   * picks the most representative examples (typically 0-8). The lexical
   * adjuster uses these as `wordsToAvoid` seeds.
   */
  highlights: LevelAuditHighlight[];
};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
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

function clampScore(n: unknown): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return Math.round(n * 10) / 10;
}

/**
 * Holistic CEFR-fit auditor. Asks gpt-4o-mini to read the whole story and
 * give:
 *   - a single 0-100 score reflecting how well the text reads as the
 *     target level (gestalt judgment, not a count);
 *   - a one-sentence summary the editor can read at a glance;
 *   - a short illustrative list of words that most stand out as above
 *     the level (NOT an exhaustive offender catalog).
 *
 * Why holistic: classifying every lemma atomically (A1 vs A2 vs B1...)
 * is exactly the task LLMs are unreliable at, even with rules. They are
 * much better at gestalt verdicts ("this feels A2-ish, mainly because of
 * <handful of words>"). The lexical adjuster still gets actionable
 * seeds via `highlights`, just no longer pretends the list is complete.
 *
 * Multi-language by design — relies on the model's general CEFR sense
 * rather than per-language frequency lists.
 */
export async function auditStoryVocabularyLevel(args: {
  text: string;
  language: string;
  cefrLevel: string;
}): Promise<LevelAuditResult> {
  const { text, language, cefrLevel } = args;
  const cleanText = stripHtml(text);
  const targetLevel = cefrLevel.trim().toUpperCase();

  // Two-level tolerance: highlights are reserved for words that are at
  // least TWO CEFR steps above the target. One-level-up vocabulary is
  // normal exposure and not worth surfacing in the panel.
  const LEVEL_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"];
  const targetIdx = LEVEL_ORDER.indexOf(targetLevel);
  const flagFromIdx = targetIdx >= 0 ? targetIdx + 2 : LEVEL_ORDER.length;
  const flagFromLevel = flagFromIdx < LEVEL_ORDER.length ? LEVEL_ORDER[flagFromIdx] : null;
  const flagLevels = flagFromLevel ? LEVEL_ORDER.slice(flagFromIdx).join(", ") : "(none — target is at the top)";

  const prompt = `
You are a CEFR ${language} editor evaluating whether a story reads at the right level.

Target level: ${targetLevel}

# Your task
Give a HOLISTIC verdict, not a word-by-word audit.

1. Score (0-100): how well does the text read as ${targetLevel}? Anchors:
   - 95-100: feels solidly ${targetLevel}, fully appropriate.
   - 80-94: mostly ${targetLevel}, a few words/turns that lean above but not jarring.
   - 60-79: noticeably above target — clearly ${targetLevel === "A1" ? "A2/B1" : "one to two notches up"} in places.
   - Below 60: doesn't read as ${targetLevel} at all.
   Be willing to give 95-100 when it really fits — don't manufacture imperfection.

2. Summary: one sentence in English describing the verdict in plain terms ("Reads cleanly as ${targetLevel} except for X.").

3. Highlights: 0 to 8 illustrative words that MOST stand out as above target. NOT an exhaustive list. Pick the ones a teacher would actually circle. Skip if score >= 95.
   STRICT RULE: only include words whose CEFR level is at least TWO steps above the target. With target ${targetLevel}, only include words at: ${flagLevels}. Do NOT include words one level up — that is normal exposure for any learner. If no word meets this threshold, return an empty highlights array.
   For each, give the lemma, the surface form used, and your CEFR estimate (must be in {${flagLevels}}).

# Calibration rules
- Words two or more CEFR levels above target are the only ones that should drive a low score. Words one level up are normal exposure for any learner.
- High-frequency everyday words stay at A1 even in complex sentences.
- A transparent derivation of an A1 root is at most one level above the root.
- Loanwords and international cognates that any educated reader recognizes at sight are at most A2.
- When uncertain between two adjacent levels, pick the lower one. Treat the score as "how well it FITS", not "how rare the rarest word is".

# Output
Return ONLY valid JSON of this shape:
{
  "score": <0-100 number>,
  "summary": "<one sentence>",
  "highlights": [
    { "word": "<lemma>", "surface": "<as in story>", "estimatedLevel": "A1|A2|B1|B2|C1|C2" }
  ]
}

STORY:
${cleanText}
`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "You are a CEFR-level editor. You judge the holistic fit of a text to a target level. You output JSON only." },
      { role: "user", content: prompt },
    ],
  });

  const content = response.choices[0]?.message?.content?.trim() ?? "";
  const parsed = parseAuditJson(content) as { score?: unknown; summary?: unknown; highlights?: unknown };

  const score = clampScore(parsed.score);
  const summary = typeof parsed.summary === "string" ? parsed.summary.trim() : "";
  const rawHighlights = Array.isArray(parsed.highlights) ? parsed.highlights : [];

  const seen = new Set<string>();
  const highlights: LevelAuditHighlight[] = [];
  for (const item of rawHighlights) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const word = typeof record.word === "string" ? record.word.trim() : "";
    if (!word) continue;
    const key = word.toLowerCase();
    if (seen.has(key)) continue;
    const estimatedLevel = typeof record.estimatedLevel === "string" ? record.estimatedLevel.trim().toUpperCase() : "?";
    // Hard threshold guard: drop anything below the 2-levels-above-target
    // floor, even if the LLM ignored the prompt rule.
    if (flagFromIdx < LEVEL_ORDER.length) {
      const estIdx = LEVEL_ORDER.indexOf(estimatedLevel);
      if (estIdx < 0 || estIdx < flagFromIdx) continue;
    } else {
      // Target has no two-up level (C1/C2): nothing should be flagged.
      continue;
    }
    seen.add(key);
    highlights.push({
      word,
      surface: typeof record.surface === "string" ? record.surface.trim() || word : word,
      estimatedLevel,
    });
    if (highlights.length >= 8) break;
  }

  return {
    cefrLevel: targetLevel,
    language,
    score,
    summary,
    highlights,
  };
}
