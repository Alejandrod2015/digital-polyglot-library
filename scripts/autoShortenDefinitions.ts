/**
 * Auto-shortener: lee `data/vocab-shorten/input.json` (dump de defs
 * largas) y genera `data/vocab-shorten/output.json` con la misma
 * estructura pero la "definition" recortada determinísticamente:
 *
 *   - Strip de bloat común al inicio ("This verb describes...",
 *     "An adjective indicating...", "The act of...", "Refers to...").
 *   - Si la oración tiene varias frases, conservamos la primera.
 *   - Si la primera cláusula (split por coma o punto-y-coma) ya cumple
 *     3-7 palabras y ≤50 chars, ése es el output.
 *   - Si la primera cláusula sigue larga, recortamos en la última
 *     palabra dentro del tope.
 *   - Si tras todo seguimos > 50 chars o < 3 palabras, marcamos el
 *     item como "pending" en `data/vocab-shorten/pending.json` para
 *     revisión manual; NO se aplica al DB ese registro.
 *
 * Uso:
 *   npx tsx scripts/autoShortenDefinitions.ts
 *
 * Después correr:
 *   npx tsx scripts/shortenJourneyDefinitions.ts --apply-rewrites
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";
import {
  DEFINITION_MAX_CHARS,
  DEFINITION_MAX_WORDS,
  DEFINITION_MIN_WORDS,
  wordCount,
} from "../src/lib/vocabValidation";

const ROOT = path.resolve(__dirname, "..");
const DIR = path.join(ROOT, "data", "vocab-shorten");
const INPUT_PATH = path.join(DIR, "input.json");
const OUTPUT_PATH = path.join(DIR, "output.json");
const PENDING_PATH = path.join(DIR, "pending.json");

type StoryDump = {
  storyId: string;
  slug: string | null;
  title: string | null;
  language: string | null;
  longDefs: Array<{ word: string; definition: string; chars: number; words: number }>;
};

const LEADING_BLOAT_PATTERNS: RegExp[] = [
  /^this\s+(verb|adjective|adverb|noun|term|word|phrase|expression)\s+(describes|refers to|means|indicates|expresses|captures|conveys|signals|denotes)\s+(?:that\s+|the\s+|a\s+|an\s+|how\s+|to\s+)?/i,
  /^this\s+(?:respectful\s+)?(?:noun|term|word|title|phrase|expression|adjective|verb|adverb)\s+(?:is\s+)?(?:used\s+)?(?:for\s+|to\s+)?/i,
  /^an?\s+(adjective|adverb|noun|verb|term|phrase|expression)\s+(describing|indicating|referring to|that\s+(?:means|describes|refers to|indicates)|meaning|for|of|used\s+(?:for|to|when))\s+/i,
  /^the\s+act\s+of\s+/i,
  /^the\s+process\s+of\s+/i,
  /^the\s+(state|quality|feeling|sense|way)\s+of\s+/i,
  /^used\s+(when|for|as|in|to)\s+/i,
  /^refers\s+to\s+/i,
  /^describes\s+/i,
  /^means\s+(?:to\s+|that\s+)?/i,
  /^conveys\s+/i,
  /^expresses\s+/i,
  /^captures\s+/i,
  /^signals\s+/i,
  /^indicates\s+/i,
  /^denotes\s+/i,
  /^genuinely\s+/i,
  /^very\s+/i,
  /^especially\s+/i,
];

const TRAILING_BLOAT_PATTERNS: RegExp[] = [
  /\s+(here|in this story|in this context|in this scene)\.?$/i,
  /[,;]?\s+(reflecting|representing|expressing|capturing|signaling|signalling|denoting|conveying|carrying)\s+.*$/i,
  /[,;]?\s+(often\s+(?:linked\s+to|tied\s+to|used\s+for|seen\s+in|associated\s+with)|especially\s+when|particularly\s+(?:in|when)).*$/i,
  /[,;]?\s+typical(?:ly)?\s+.*$/i,
  /[,;]?\s+such\s+as\s+.*$/i,
  /[,;]?\s+for\s+example.*$/i,
  /[,;]?\s+used\s+(?:in|when|to|for)\s+.*$/i,
  /[,;]?\s+like\s+a\s+.*$/i,
  /[,;]?\s+also\s+(?:means|known\s+as).*$/i,
  /[,;]?\s+stronger\s+than\s+.*$/i,
  /[,;]?\s+warmer\s+(?:in\s+)?tone\s+than\s+.*$/i,
];

function capitalize(s: string): string {
  if (!s) return s;
  const first = s.charAt(0);
  const upper = first.toLocaleUpperCase();
  return first !== upper ? upper + s.slice(1) : s;
}

function clean(s: string): string {
  return s.replace(/\s+/g, " ").trim().replace(/[\s.,;:]+$/g, "");
}

// Conectores y palabras "abiertas" que NUNCA pueden terminar una def
// — quedan sonando incompletas ("Salt, the basic seasoning on almost",
// "Pipe tobacco whose lingering smell can saturate"). Si el trim cae
// sobre uno de estos, bajamos una palabra atrás hasta tocar contenido.
const TRAILING_CONNECTORS = new Set<string>([
  "a", "an", "the",
  "and", "or", "but", "nor", "yet", "so",
  "of", "in", "on", "at", "by", "for", "to", "with", "from",
  "into", "onto", "upon", "than", "then", "as", "is", "are", "was", "were",
  "be", "been", "being",
  "that", "which", "who", "whom", "whose",
  "if", "when", "while", "where", "after", "before", "until",
  "between", "among", "across", "during", "without", "within",
  "this", "these", "those",
  "also", "still", "very", "often", "sometimes", "always", "never",
  "almost", "nearly", "just", "only", "even",
  "another", "any", "some", "each", "many", "few", "more", "less",
  "common", "typical", "usual",
  "their", "your", "our", "its", "his", "her",
]);

function stripTrailingConnectors(s: string): string {
  let tokens = s.split(/\s+/).filter(Boolean);
  while (tokens.length > DEFINITION_MIN_WORDS) {
    const last = tokens[tokens.length - 1].toLowerCase().replace(/[.,;:!?]+$/, "");
    if (!TRAILING_CONNECTORS.has(last)) break;
    tokens.pop();
  }
  return clean(tokens.join(" "));
}

function withinLimit(s: string): boolean {
  const t = clean(s);
  if (t.length > DEFINITION_MAX_CHARS) return false;
  const wc = wordCount(t);
  return wc >= DEFINITION_MIN_WORDS && wc <= DEFINITION_MAX_WORDS;
}

function tryFirstClause(s: string): string | null {
  // Split por punto-final, ! o ? seguidos de espacio o fin.
  const sentences = s
    .split(/(?<=[.!?])\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  for (const sentence of sentences) {
    const trimmed = clean(sentence);
    if (!trimmed) continue;
    // Probar primera cláusula por commas/semicolons/dash.
    const clauses = trimmed
      .split(/[,;]\s+|\s[-–—]\s+/)
      .map((p) => p.trim())
      .filter(Boolean);
    for (const clause of clauses) {
      const c = stripTrailingConnectors(clean(clause));
      if (withinLimit(c)) return c;
    }
    const fullStripped = stripTrailingConnectors(trimmed);
    if (withinLimit(fullStripped)) return fullStripped;
  }
  return null;
}

function trimToWindow(s: string): string {
  const trimmed = clean(s);
  const words = trimmed.split(/\s+/).filter(Boolean);
  // Recorta a max 7 palabras manteniendo límite de chars.
  let out = "";
  for (const w of words) {
    const next = out ? `${out} ${w}` : w;
    if (next.length > DEFINITION_MAX_CHARS) break;
    if (wordCount(next) > DEFINITION_MAX_WORDS) break;
    out = next;
  }
  return stripTrailingConnectors(clean(out));
}

function autoShorten(original: string): string {
  let s = original.trim();
  // 1) Strip bloat al inicio en cascada.
  let changed = true;
  while (changed) {
    changed = false;
    for (const re of LEADING_BLOAT_PATTERNS) {
      const before = s;
      s = s.replace(re, "");
      if (s !== before) {
        changed = true;
        s = s.trim();
      }
    }
  }
  // 2) Strip bloat trailing en cascada.
  changed = true;
  while (changed) {
    changed = false;
    for (const re of TRAILING_BLOAT_PATTERNS) {
      const before = s;
      s = s.replace(re, "");
      if (s !== before) {
        changed = true;
        s = s.trim();
      }
    }
  }
  s = stripTrailingConnectors(clean(s));
  // 3) Ya cabe (y no termina en conector) → ready.
  if (withinLimit(s)) return capitalize(s);
  // 4) Probar primera cláusula.
  const clause = tryFirstClause(s);
  if (clause) return capitalize(clause);
  // 5) Recortar a ventana de palabras dentro del tope.
  const windowed = trimToWindow(s);
  if (withinLimit(windowed)) return capitalize(windowed);
  // 6) Sin solución determinística.
  return "";
}

function run() {
  const raw = readFileSync(INPUT_PATH, "utf8");
  const dump = JSON.parse(raw) as StoryDump[];
  console.log(`[auto-shorten] processing ${dump.length} stories...`);

  const output: StoryDump[] = [];
  const pending: StoryDump[] = [];
  let resolved = 0;
  let dropped = 0;

  for (const story of dump) {
    const resolvedDefs: StoryDump["longDefs"] = [];
    const pendingDefs: StoryDump["longDefs"] = [];
    for (const item of story.longDefs) {
      const next = autoShorten(item.definition);
      if (next) {
        resolved += 1;
        resolvedDefs.push({
          word: item.word,
          definition: next,
          chars: next.length,
          words: wordCount(next),
        });
      } else {
        dropped += 1;
        pendingDefs.push(item);
      }
    }
    if (resolvedDefs.length > 0) {
      output.push({ ...story, longDefs: resolvedDefs });
    }
    if (pendingDefs.length > 0) {
      pending.push({ ...story, longDefs: pendingDefs });
    }
  }

  mkdirSync(DIR, { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
  writeFileSync(PENDING_PATH, JSON.stringify(pending, null, 2));

  console.log(`\n[auto-shorten] done.`);
  console.log(`   resolved: ${resolved} → ${OUTPUT_PATH}`);
  console.log(`   pending:  ${dropped} → ${PENDING_PATH}`);
  console.log(`\nNext: npx tsx scripts/shortenJourneyDefinitions.ts --apply-rewrites`);
}

run();
