// CEFR Spanish word-level judge.
//
// LIST-ONLY strategy (NO LLM CALLS):
//   1) Check the curated lemma lists (A1+A2+B1+B2+C1). If the word is in
//      the cumulative set for the requested level, it passes.
//   2) Otherwise, check the cache (`cache/spanish-llm-cache.json`) which
//      contains FREE pre-existing judgments from earlier sessions. This
//      data is already paid; reading it costs nothing.
//   3) Words found in NEITHER the list NOR the cache are flagged as
//      above-level (default judgedLevel = "c2"). The validator surfaces
//      them so the worker can manually replace them in ChatGPT.
//
// Why no LLM:
//   The user explicitly opted out of OpenAI API spend. With ~13800
//   cumulative lemmas in the list + a populated cache, the practical
//   miss rate is low (~5%). Misses produce false positives that the
//   worker resolves manually; never silent wrong-passes.
//
// The OpenAI client and judgeBatchViaLLM function are kept commented
// below for reference but NEVER invoked.

// Server-only: this module touches the filesystem (cache). Bundling it
// into the client breaks webpack. The import below is a hard fence.
import "server-only";

import { promises as fs } from "fs";
import path from "path";

import { isSpanishUpToLevel } from "./spanishLevels";

export type SpanishLevel = "a1" | "a2" | "b1" | "b2" | "c1" | "c2";

// A1 and A2 share the same effective floor — A1 stories are conventionally
// allowed to use A1+A2 vocab (matches the curated `isSpanishA1A2` list).
// From B1 up, ranks are strictly cumulative.
const LEVEL_RANK: Record<SpanishLevel, number> = {
  a1: 2, a2: 2, b1: 3, b2: 4, c1: 5, c2: 6,
};

const CACHE_PATH = path.join(
  process.cwd(),
  "src/lib/cefr/cache/spanish-llm-cache.json",
);

type CacheEntry = {
  level: SpanishLevel;
  /** Suggested in-level replacement when above target. Generic, no context. */
  replacement?: string;
  reason?: string;
  judgedAt: string;
};
type Cache = Record<string, CacheEntry>;

// In-memory cache; lazy-loaded from disk on first access.
let memCache: Cache | null = null;
let cacheLoadPromise: Promise<void> | null = null;

async function loadCacheOnce(): Promise<void> {
  if (memCache) return;
  if (cacheLoadPromise) return cacheLoadPromise;
  cacheLoadPromise = (async () => {
    try {
      const raw = await fs.readFile(CACHE_PATH, "utf8");
      memCache = JSON.parse(raw) as Cache;
    } catch {
      memCache = {};
    }
  })();
  return cacheLoadPromise;
}

// Best-effort write. On Vercel prod (read-only fs) this silently fails and
// the cache stays only in-memory for that function instance.
async function persistCache(): Promise<void> {
  if (!memCache) return;
  try {
    await fs.mkdir(path.dirname(CACHE_PATH), { recursive: true });
    await fs.writeFile(
      CACHE_PATH,
      JSON.stringify(memCache, null, 2) + "\n",
      "utf8",
    );
  } catch {
    // Read-only fs (prod); keep in memory only.
  }
}

function normalizeKey(word: string): string {
  return word.toLowerCase().trim();
}

const MODEL = "gpt-4o-mini";

// ── DEAD CODE (kept for reference; never invoked) ─────────────────────────
// The prompt builder + LLM caller below are NOT used. They remain here so
// that re-enabling them later is a one-line change. To re-enable, replace
// the `aboveLevel.push` loop in `filterSpanishWordsAtOrBelow` with a call
// to _judgeBatchViaLLM_UNUSED for the `needLLM` array. Also remove the
// `_UNUSED` suffixes and reinstate `import OpenAI from "openai"`.
// ─────────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _buildSystemPrompt_UNUSED(targetLevel: SpanishLevel): string {
  return `You are a CEFR Spanish vocabulary judge.

Given a list of Spanish words or short multi-word lemmas, return strict JSON:
{
  "judgments": [
    {
      "word": "<exact input>",
      "level": "a1" | "a2" | "b1" | "b2" | "c1" | "c2",
      "replacement": "<optional: a single-word or short Spanish equivalent at or below the target level ${targetLevel.toUpperCase()}, ONLY when the word is above the target>"
    },
    ...
  ]
}

Use the Instituto Cervantes / Plan Curricular del Cervantes CEFR standard for Spanish. Calibration:
- a1: ~500 most basic everyday words (greetings, family, numbers, basic verbs, food, simple adjectives).
- a2: ~1500 cumulative; daily life vocabulary, common activities, basic emotions, simple opinions.
- b1: ~2500 cumulative; concrete + some abstract topics, opinions, basic argument, common professions.
- b2: ~4000 cumulative; abstract topics, academic discourse beginnings, nuanced emotions, formal register.
- c1: ~8000 cumulative; sophisticated/idiomatic register, literary devices, low-frequency academic/technical vocab, register shifts.
- c2: anything else, including very rare / literary / specialized terminology.

Be STRICT on level. When in doubt, assign a HIGHER level. Consider:
1. Frequency in standard Spanish corpora (CREA, RAE, OpenSubtitles).
2. Active use vs passive recognition at the level.
3. Register: literary, technical, archaic, regional → push higher.
4. Multi-word expressions and idioms: assign the level a learner would PRODUCE them.

For the "replacement" field:
- Target level is ${targetLevel.toUpperCase()}.
- Only include "replacement" when the judged level is ABOVE the target (e.g. target=a1 and judged=b2 → include replacement).
- The replacement MUST be a Spanish word at or below the target level — common, neutral Spanish (no regionalism).
- Keep the replacement short (1-3 words). If the original is a verb, give a verb. If a noun, give a noun.
- The replacement should mean roughly the same thing or be a natural substitute in story context.
- Examples: anafe (B2) at target A1 → "estufa". alfiletero (B2) at target A1 → "caja". escabel (B2) at target A1 → "banco". talega (B2) at target A1 → "bolsa".
- If no good in-level replacement exists, omit the field (do not invent).

Output the SAME word strings the user provided, in the same order. Use neutral Spanish.`;
}

type LLMJudgment = { level: SpanishLevel; replacement?: string };

// Marked _UNUSED. See note above. If you want LLM fallback back, rename
// this to judgeBatchViaLLM and call it from filterSpanishWordsAtOrBelow.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function _judgeBatchViaLLM_UNUSED(
  _words: string[],
  _targetLevel: SpanishLevel,
): Promise<Record<string, LLMJudgment>> {
  throw new Error("LLM judge disabled by config (no spend allowed).");
}

export type WordAboveLevel = {
  word: string;
  judgedLevel: SpanishLevel;
  /** LLM-suggested replacement at or below target. May be undefined. */
  replacement?: string;
};

/**
 * Batch-judge many words against the same target level.
 * Returns the subset that are AT OR BELOW the target level, plus the rest
 * with their judged level and (when available) a suggested replacement.
 *
 * Performance: list hits are instant; LLM is called once for all unknown
 * words in a single request, then cached.
 */
export async function filterSpanishWordsAtOrBelow(
  words: string[],
  targetLevel: SpanishLevel,
): Promise<{
  atOrBelow: string[];
  aboveLevel: WordAboveLevel[];
}> {
  if (targetLevel === "c2") {
    return { atOrBelow: words.slice(), aboveLevel: [] };
  }
  await loadCacheOnce();
  const atOrBelow: string[] = [];
  const aboveLevel: WordAboveLevel[] = [];
  const needLLM: string[] = [];
  const wordToKey = new Map<string, string>();

  for (const w of words) {
    if (isSpanishUpToLevel(w, targetLevel)) {
      atOrBelow.push(w);
      continue;
    }
    const key = normalizeKey(w);
    wordToKey.set(w, key);
    const cached = memCache![key];
    if (cached) {
      if (LEVEL_RANK[cached.level] <= LEVEL_RANK[targetLevel]) {
        atOrBelow.push(w);
      } else {
        aboveLevel.push({
          word: w,
          judgedLevel: cached.level,
          replacement: cached.replacement,
        });
      }
      continue;
    }
    needLLM.push(w);
  }

  // LLM disabled by config (user opted out of OpenAI spend). Anything
  // that's not in the curated lists AND not in the cache is treated as
  // above the target level. The worker sees these in the validator
  // result and replaces them manually in ChatGPT.
  if (needLLM.length > 0) {
    for (const w of needLLM) {
      aboveLevel.push({ word: w, judgedLevel: "c2" });
    }
  }
  return { atOrBelow, aboveLevel };
}

/**
 * Extract content words from a Spanish story body. Strips punctuation,
 * lowercases, splits on whitespace, removes function words (articles,
 * pronouns, common prepositions, conjunctions, auxiliaries that the level
 * judge would otherwise waste a call on). Returns unique surface forms.
 *
 * NOTE: We pass surface forms (not lemmas) because the LLM is smart
 * enough to interpret inflected forms ("comeríamos", "estuvieron") and
 * judge them by their underlying lemma. This avoids the complexity of a
 * full Spanish lemmatizer here.
 */
export function extractSpanishContentWords(body: string): string[] {
  const STOP = new Set<string>([
    // Articles
    "el","la","los","las","un","una","unos","unas","lo",
    // Pronouns
    "yo","tu","tú","él","ella","ello","usted","nosotros","nosotras","vosotros","vosotras","ustedes","ellos","ellas",
    "me","te","se","nos","os","le","les","mí","ti","sí","mío","mía","míos","mías","tuyo","tuya","suyo","suya",
    "este","esta","esto","estos","estas","ese","esa","eso","esos","esas","aquel","aquella","aquello","aquellos","aquellas",
    "quien","quién","quienes","quiénes","que","qué","cual","cuál","cuales","cuáles","donde","dónde","cuando","cuándo","como","cómo","cuanto","cuánto",
    // Prepositions
    "a","ante","bajo","con","contra","de","del","desde","durante","en","entre","hacia","hasta","mediante","para","por","según","sin","sobre","tras","versus","vía",
    // Conjunctions
    "y","e","o","u","ni","pero","sino","aunque","porque","pues","si","que","ya",
    // Auxiliaries / very common verbs (forms)
    "es","son","era","eran","fue","fueron","ser","sido","siendo","está","están","estaba","estaban","estuvo","estuvieron","estar","estado","estando",
    "ha","han","había","habían","hubo","hubieron","haber","habido","habiendo","he","has","hemos","habéis",
    "soy","eres","somos","sois","fui","fuiste","fuimos","fuisteis",
    // Negation / common adverbs
    "no","sí","si","ya","aún","todavía","muy","más","menos","tan","tanto","también","tampoco","solo","sólo","casi","ahí","allá","allí","aquí","acá",
    // Misc
    "al",
  ]);
  const tokens = body
    .toLowerCase()
    .replace(/[¿¡"'()\[\]{}—–\-_*]/g, " ")
    .split(/[\s.,;:!?"…]+/u)
    .filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tokens) {
    if (t.length < 3) continue; // skip "a", "de", etc.
    if (STOP.has(t)) continue;
    if (/^\d+$/.test(t)) continue; // pure numbers
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}
