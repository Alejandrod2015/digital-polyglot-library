// CEFR Spanish word-level judge.
//
// Hybrid strategy:
//   1) Fast path: check the curated lemma lists (A1+A2+B1+B2+C1). If the word
//      is in the cumulative set for the requested level, return true instantly.
//   2) Long tail: words NOT in the lists (rare vocab, technical terms,
//      sophisticated B2/C1/C2 lemmas) get judged by an LLM and cached
//      forever in `cache/spanish-llm-cache.json`.
//
// The cache file lives in src/ so it ships with the bundle. On Vercel
// (read-only fs) we still read the bundled cache; new judgments stay in
// process memory for the lifetime of the serverless instance. Locally
// (dev) writes are persisted to disk so the committed cache grows over
// time and seeds future deployments.
//
// Cost: ~$0.0001 per new word judged via gpt-4o-mini. After warm-up the
// cache covers almost everything.

// Server-only: this module touches the filesystem (cache) and uses the
// OpenAI client. Bundling it into the client breaks webpack and would
// also leak the API key path. The import below is a hard fence.
import "server-only";

import { promises as fs } from "fs";
import path from "path";
import OpenAI from "openai";

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

type CacheEntry = { level: SpanishLevel; reason?: string; judgedAt: string };
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

const SYSTEM_PROMPT = `You are a CEFR Spanish vocabulary judge.

Given a list of Spanish words or short multi-word lemmas, return strict JSON:
{ "judgments": [{ "word": "<exact input>", "level": "a1" | "a2" | "b1" | "b2" | "c1" | "c2" }, ...] }

Use the Instituto Cervantes / Plan Curricular del Cervantes CEFR standard for Spanish. Calibration:
- a1: ~500 most basic everyday words (greetings, family, numbers, basic verbs, food, simple adjectives).
- a2: ~1500 cumulative; daily life vocabulary, common activities, basic emotions, simple opinions.
- b1: ~2500 cumulative; concrete + some abstract topics, opinions, basic argument, common professions.
- b2: ~4000 cumulative; abstract topics, academic discourse beginnings, nuanced emotions, formal register.
- c1: ~8000 cumulative; sophisticated/idiomatic register, literary devices, low-frequency academic/technical vocab, register shifts.
- c2: anything else, including very rare / literary / specialized terminology.

Be STRICT. When in doubt, assign a HIGHER level. Consider:
1. Frequency in standard Spanish corpora (CREA, RAE, OpenSubtitles).
2. Active use vs passive recognition at the level.
3. Register: literary, technical, archaic, regional → push higher.
4. Multi-word expressions and idioms: assign the level a learner would PRODUCE them.

Output the SAME word strings the user provided, in the same order. Use neutral Spanish (no regionalism preference).`;

async function judgeBatchViaLLM(words: string[]): Promise<Record<string, SpanishLevel>> {
  if (words.length === 0) return {};
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // No API key (e.g. tests). Default to c2 so they get flagged as
    // "fuera de nivel" rather than silently passing.
    const out: Record<string, SpanishLevel> = {};
    for (const w of words) out[w] = "c2";
    return out;
  }
  const client = new OpenAI({ apiKey });
  const resp = await client.chat.completions.create({
    model: MODEL,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify({ words }) },
    ],
  });
  const content = resp.choices[0]?.message?.content || "{}";
  let parsed: { judgments?: { word: string; level: string }[] };
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = { judgments: [] };
  }
  const out: Record<string, SpanishLevel> = {};
  for (const j of parsed.judgments ?? []) {
    const w = String(j.word ?? "").trim();
    if (!w) continue;
    const lv = String(j.level ?? "c2").toLowerCase() as SpanishLevel;
    out[w] = (LEVEL_RANK[lv] ? lv : "c2");
  }
  // Backfill any words the LLM omitted as c2 (safer default).
  for (const w of words) if (!(w in out)) out[w] = "c2";
  return out;
}

/**
 * Judge a single Spanish word against a target CEFR level.
 * Returns true if the word is at or below the target level.
 * List hit = instant. Otherwise consults the LLM (cached).
 */
export async function isSpanishUpToLevelHybrid(
  word: string,
  targetLevel: SpanishLevel,
): Promise<boolean> {
  if (targetLevel === "c2") return true; // no restriction at near-native
  // Fast path: curated list
  if (isSpanishUpToLevel(word, targetLevel)) return true;

  await loadCacheOnce();
  const key = normalizeKey(word);
  const cached = memCache![key];
  if (cached) return LEVEL_RANK[cached.level] <= LEVEL_RANK[targetLevel];

  // Slow path: LLM judgment
  const judged = await judgeBatchViaLLM([word]);
  const level = judged[word] ?? "c2";
  memCache![key] = { level, judgedAt: new Date().toISOString() };
  void persistCache();
  return LEVEL_RANK[level] <= LEVEL_RANK[targetLevel];
}

/**
 * Batch-judge many words against the same target level.
 * Returns the subset that are AT OR BELOW the target level.
 *
 * Performance: list hits are instant; LLM is called once for all unknown
 * words in a single request, then cached.
 */
export async function filterSpanishWordsAtOrBelow(
  words: string[],
  targetLevel: SpanishLevel,
): Promise<{
  atOrBelow: string[];
  aboveLevel: { word: string; judgedLevel: SpanishLevel }[];
}> {
  if (targetLevel === "c2") {
    return { atOrBelow: words.slice(), aboveLevel: [] };
  }
  await loadCacheOnce();
  const atOrBelow: string[] = [];
  const aboveLevel: { word: string; judgedLevel: SpanishLevel }[] = [];
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
      if (LEVEL_RANK[cached.level] <= LEVEL_RANK[targetLevel]) atOrBelow.push(w);
      else aboveLevel.push({ word: w, judgedLevel: cached.level });
      continue;
    }
    needLLM.push(w);
  }

  if (needLLM.length > 0) {
    const judged = await judgeBatchViaLLM(needLLM);
    const now = new Date().toISOString();
    for (const w of needLLM) {
      const level = judged[w] ?? "c2";
      const key = wordToKey.get(w) ?? normalizeKey(w);
      memCache![key] = { level, judgedAt: now };
      if (LEVEL_RANK[level] <= LEVEL_RANK[targetLevel]) atOrBelow.push(w);
      else aboveLevel.push({ word: w, judgedLevel: level });
    }
    void persistCache();
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
