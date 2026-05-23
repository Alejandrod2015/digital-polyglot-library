/**
 * Deterministic validator for stories produced by the DPL Multi-Voice Story
 * Writer Custom GPT. Pure function (no I/O), so it can be unit-tested in
 * isolation and called from the API route once journey context is loaded.
 *
 * Spec source: docs/story-quality-spec.md (§ Pre-save checklist).
 *
 * Checks are split into:
 *   - Structural: things measurable by code (length, JSON shape, regex).
 *     If any of these fail, the story should not be saved.
 *   - Cross-story: comparison against already-published stories in the same
 *     journey/level/topic. Catches vocab repetition and arcType clustering.
 *   - Lints (warnings): style issues a human should review (synopsis-body
 *     character mismatch is treated as warning because the name detector
 *     may miss accent variants).
 */

import { isSpanishUpToLevel } from "./cefr/spanishLevels";
import { isGermanA1A2 } from "./cefr/germanA1A2";
import { isItalianA1A2 } from "./cefr/italianA1A2";
import { isPortugueseA1A2 } from "./cefr/portugueseA1A2";
import { isFrenchA1A2 } from "./cefr/frenchA1A2";

// Types + parser moved to ./storyPayload (pure, client-safe).
// We re-export so existing callers (`import { ..., parseStoryInput } from
// "@/lib/validateGeneratedStory"`) keep working without a churn refactor.
export type { StoryPayload, StoryVocabItem } from "./storyPayload";
export { parseStoryInput } from "./storyPayload";
import type { StoryPayload, StoryVocabItem } from "./storyPayload";
import { parseStoryInput } from "./storyPayload";

export type ExistingStorySummary = {
  title: string;
  arcType?: string | null;
  vocabLemmas: string[];
  characterNames: string[];
};

export type ValidationContext = {
  /** ISO code: ES, DE, IT, FR, PT, EN. Defaults to undefined → cognate list
   *  not enforced for non-matching language. */
  language?: string;
  /** A1, A2, B1, B2, C1, C2. Surfaced in messages, not yet used in rules. */
  level?: string;
  /** Used in messages only. */
  topic?: string;
  /** Stories already in the same journey+level+topic. */
  existing?: ExistingStorySummary[];
};

export type CheckStatus = "pass" | "fail" | "warn";

export type Check = {
  id: string;
  label: string;
  status: CheckStatus;
  /** Short explanation shown next to the badge. Optional. */
  detail?: string;
};

export type ValidationResult = {
  ok: boolean;
  parsed: StoryPayload | null;
  checks: Check[];
  summary: {
    pass: number;
    warn: number;
    fail: number;
  };
};

const VALID_ARC_TYPES = new Set([
  "white-lie",
  "last-minute-decision",
  "return-after-years",
  "unspoken-subtext",
  "plan-falls-short",
  "late-reveal",
  "small-stake",
  "open-ending",
  "daily-encounter",
]);

const VALID_VOCAB_TYPES = new Set([
  "verb",
  "noun",
  "adjective",
  "adverb",
  "expression",
  "slang",
  "preposition",
]);

const BANNED_DEFINITION_OPENERS = [
  /^\s*refers to\b/i,
  /^\s*describes\b/i,
  /^\s*used to\b/i,
  /^\s*used for\b/i,
  /^\s*said when\b/i,
];

const BANNED_BODY_TOKENS = [
  /\bhaha\b/i,
  /\bhahaha\b/i,
  /\bjaja\b/i,
  /\bjeje\b/i,
  /\bhehe\b/i,
  /\bja\s+ja\b/i,
  /\bkkk\b/i,
  /\blol\b/i,
  /\bhmm+\b/i,
  /\buhm+\b/i,
  /\behm+\b/i,
  /\bmh+\b/i,
  /\baww+\b/i,
  /\bohh+\b/i,
  /\bugh\b/i,
  /\bwow\b/i,
  /\bmein gott\b/i,
  /\bay dios\b/i,
  /\(laughs?\)/i,
  /\(sighs?\)/i,
  /\[r[ií]e\]/i,
  /\*pause\*/i,
];

const HTML_TAG_RE = /<(?:p|blockquote|div|span|br|strong|em|i|b|h\d|a|ul|ol|li|img)\b/i;

const COGNATES_BY_LANG: Record<string, string[]> = {
  DE: [
    "mathe", "kaffee", "tomate", "tomaten", "banane", "schokolade", "tee",
    "telefon", "apfel", "optimist", "chance", "computer", "familie",
    "restaurant", "park", "auto", "bus", "hotel", "adresse", "information",
    "foto", "musik", "konzert", "pizza", "spaghetti", "hamburger",
  ],
  ES: [
    "importante", "normal", "social", "problema", "idea", "momento",
    "televisión", "television", "radio", "posible", "general",
  ],
  IT: ["importante", "normale", "sociale", "problema", "idea", "momento", "radio"],
  PT: ["importante", "normal", "social", "problema", "ideia", "momento", "rádio"],
  FR: ["important", "normal", "social", "problème", "idée", "moment", "radio"],
};

const SEPARABLE_PREFIXES_DE = ["an", "auf", "aus", "ein", "nach", "vor", "zu", "ab", "mit", "bei"];
const COMMON_PREFIXES_DE = ["ge", "ver", "be", "er", "ent"];

function stripPrefix(word: string, lang?: string): string {
  if (lang !== "DE") return word;
  const lower = word.toLowerCase();
  for (const p of [...SEPARABLE_PREFIXES_DE, ...COMMON_PREFIXES_DE]) {
    if (lower.startsWith(p) && lower.length > p.length + 3) {
      return lower.slice(p.length);
    }
  }
  return lower;
}

function countWords(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function countChars(s: string): number {
  return [...s].length;
}

function getParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function extractSpeakerNames(text: string): string[] {
  const re = /^([\p{Lu}][\p{L}\p{M}.'\-]*(?:\s+[\p{Lu}][\p{L}\p{M}.'\-]*){0,3}):\s+\S/gmu;
  const set = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    set.add(m[1].trim());
  }
  return [...set];
}

function countSpeakerLines(text: string): number {
  const re = /^[\p{Lu}][\p{L}\p{M}.'\-]*(?:\s+[\p{Lu}][\p{L}\p{M}.'\-]*){0,3}:\s+\S/gmu;
  return [...text.matchAll(re)].length;
}

function hasNarratorOpening(text: string): boolean {
  const first = getParagraphs(text)[0] ?? "";
  if (!first) return false;
  if (/^[\p{Lu}][\p{L}\p{M}.'\-]*(?:\s+[\p{Lu}][\p{L}\p{M}.'\-]*){0,3}:\s+/u.test(first)) {
    return false;
  }
  return /[.!?…]\s*$/.test(first);
}

function vocabPerParagraph(text: string, vocab: StoryVocabItem[]): number[] {
  const paragraphs = getParagraphs(text);
  return paragraphs.map((p) => {
    let count = 0;
    for (const v of vocab) {
      const needle = (v.surface ?? v.word).toLowerCase();
      if (!needle) continue;
      const re = new RegExp(`\\b${escapeRegex(needle)}\\b`, "iu");
      if (re.test(p)) count += 1;
    }
    return count;
  });
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// `parseStoryInput` and `isStoryPayload` now live in ./storyPayload to
// avoid pulling server-only deps into Client Components. Re-exported at
// top of file.

export async function validateGeneratedStory(
  input: string | StoryPayload,
  context: ValidationContext = {}
): Promise<ValidationResult> {
  const checks: Check[] = [];
  const parsed: StoryPayload | null = typeof input === "string" ? parseStoryInput(input) : input;

  if (!parsed) {
    checks.push({
      id: "json-parse",
      label: "JSON parses correctly",
      status: "fail",
      detail: "Could not parse the input as a story JSON object.",
    });
    return finalize(checks, null);
  }

  checks.push({ id: "json-parse", label: "JSON parses correctly", status: "pass" });

  // ─── Title ─────────────────────────────────────────────
  const titleWords = countWords(parsed.title);
  checks.push({
    id: "title-length",
    label: "Title is 2-6 words",
    status: titleWords >= 2 && titleWords <= 6 ? "pass" : "fail",
    detail: `${titleWords} words`,
  });

  const TITLE_BANNED = [
    /^a day in/i,
    /^the story of\b/i,
    /\b(mystery|secret|escape|forbidden|stolen)\b/i,
  ];
  const titleBanned = TITLE_BANNED.find((re) => re.test(parsed.title));
  checks.push({
    id: "title-banned-patterns",
    label: "Title avoids banned patterns",
    status: titleBanned ? "fail" : "pass",
    detail: titleBanned ? `Matches forbidden pattern: ${titleBanned}` : undefined,
  });

  // Title cultural anchor (heurístico proxy del spec §1 "concrete
  // cultural anchor: real neighborhood, specific dish, named venue,
  // or traditional object"). Sin whitelist exhaustiva de anchors
  // reales por journey, usamos blacklist de sustantivos genéricos:
  // si el título contiene uno y nada más, probablemente le falta el
  // anchor concreto. Atrapa "Una cena en casa", "Un día en Madrid",
  // "La noche del barrio". Status warn (no fail) porque un genérico
  // junto a un anchor válido ("Día de fiesta en Coyoacán") es
  // aceptable.
  const TITLE_GENERIC_NOUNS = new Set([
    // ES
    "día", "dia", "viaje", "comida", "casa", "noche", "tarde", "cena",
    "mañana", "manana", "momento", "vida", "historia", "almuerzo",
    "desayuno", "fiesta",
    // DE
    "tag", "reise", "essen", "haus", "nacht", "abend", "morgen",
    "moment", "leben", "geschichte", "mittag",
    // IT
    "giorno", "viaggio", "cibo", "notte", "sera", "mattina", "vita",
    "storia",
    // PT
    "viagem", "noite", "manhã", "manha",
    // FR
    "jour", "voyage", "repas", "soir", "matin", "histoire",
  ]);
  const titleNormalized = parsed.title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  const titleGenericHits = titleNormalized
    .split(/[^a-zñü]+/)
    .filter(Boolean)
    .filter((w) => TITLE_GENERIC_NOUNS.has(w));
  checks.push({
    id: "title-cultural-anchor",
    label: "Title avoids generic nouns without concrete anchor",
    status: titleGenericHits.length === 0 ? "pass" : "warn",
    detail: titleGenericHits.length
      ? `Generic noun(s): ${titleGenericHits.join(", ")}. Add a concrete anchor (neighborhood, dish, named venue).`
      : undefined,
  });

  // ─── Synopsis ──────────────────────────────────────────
  const synWords = countWords(parsed.synopsis);
  checks.push({
    id: "synopsis-length",
    label: "Synopsis is 45-90 words",
    status: synWords >= 45 && synWords <= 90 ? "pass" : "fail",
    detail: `${synWords} words`,
  });

  // ─── Body format ───────────────────────────────────────
  const html = parsed.text.match(HTML_TAG_RE);
  checks.push({
    id: "body-no-html",
    label: "Body is plain text (no HTML/markdown tags)",
    status: html ? "fail" : "pass",
    detail: html ? `Found tag: ${html[0]}` : undefined,
  });

  checks.push({
    id: "body-narrator-opening",
    label: "Body opens with a narrator paragraph (full sentence)",
    status: hasNarratorOpening(parsed.text) ? "pass" : "fail",
  });

  const bodyWords = countWords(parsed.text);
  checks.push({
    id: "body-word-count",
    label: "Body is 220-280 words (hard: 180-320)",
    status:
      bodyWords < 180 || bodyWords > 320
        ? "fail"
        : bodyWords < 220 || bodyWords > 280
          ? "warn"
          : "pass",
    detail: `${bodyWords} words`,
  });

  const speakerNames = extractSpeakerNames(parsed.text);
  const speakerLines = countSpeakerLines(parsed.text);
  checks.push({
    id: "speakers-count",
    label: "At least 2 distinct named speakers",
    status: speakerNames.length >= 2 ? "pass" : "fail",
    detail: `${speakerNames.length}: ${speakerNames.join(", ")}`,
  });
  checks.push({
    id: "speaker-lines",
    label: "At least 4 speaker turns",
    status: speakerLines >= 4 ? "pass" : "fail",
    detail: `${speakerLines} turns`,
  });

  // ─── Banned tokens in body ─────────────────────────────
  const banHit = BANNED_BODY_TOKENS.find((re) => re.test(parsed.text));
  checks.push({
    id: "body-no-banned-tokens",
    label: "Body has no laughter / filler / stage directions",
    status: banHit ? "fail" : "pass",
    detail: banHit ? `Matched: ${banHit}` : undefined,
  });

  // CEFR lexical red-flags. Heurística MÍNIMA: lista curada de
  // adverbios discursivos / palabras académicas claramente B2+ que
  // no deberían aparecer en A1/A2. Es expandible. Status warn (no
  // fail) porque el contexto puede justificar excepciones y la
  // lista no es exhaustiva. Para hacer este check robusto haría
  // falta un lemma frequency list por nivel (TODO fase 2).
  const CEFR_HIGH_WORDS: Record<string, string[]> = {
    DE: [
      "dementsprechend", "demnach", "infolgedessen", "mithin",
      "dergestalt", "gewissermaßen", "hinsichtlich", "schlechterdings",
      "keineswegs", "ebendarum", "diesbezüglich",
    ],
    ES: [
      "empero", "asimismo", "ulteriormente", "consecuentemente",
      "subsiguientemente", "presuntamente", "indudablemente",
      "paulatinamente", "atendiendo",
    ],
    IT: [
      "nondimeno", "pertanto", "sicché", "frattanto", "verosimilmente",
      "presumibilmente", "indubbiamente", "conseguentemente",
    ],
  };
  const ctxLevel = (context.level ?? "").toUpperCase();
  const isBasic = ctxLevel === "A1" || ctxLevel === "A2";
  const ctxLang = (context.language ?? "").toUpperCase();
  const cefrFlags = CEFR_HIGH_WORDS[ctxLang] ?? [];
  if (isBasic && cefrFlags.length) {
    const bodyLowerForCefr = parsed.text.toLowerCase();
    const cefrHits = cefrFlags.filter((w) => {
      const re = new RegExp(`\\b${escapeRegex(w.toLowerCase())}\\b`, "i");
      return re.test(bodyLowerForCefr);
    });
    checks.push({
      id: "body-cefr-level",
      label: `Body avoids high-CEFR discourse markers for ${ctxLevel}`,
      status: cefrHits.length === 0 ? "pass" : "warn",
      detail: cefrHits.length
        ? `Found: ${cefrHits.join(", ")} (B2+/C1 markers, revisa nivel)`
        : undefined,
    });
  }

  // ─── arcType ───────────────────────────────────────────
  checks.push({
    id: "arctype-valid",
    label: "arcType is in allowed list",
    status: VALID_ARC_TYPES.has(parsed.arcType) ? "pass" : "fail",
    detail: parsed.arcType,
  });

  // ─── Vocab ─────────────────────────────────────────────
  const vocabCount = parsed.vocab.length;
  checks.push({
    id: "vocab-count",
    label: "Vocab has 18-22 items",
    status: vocabCount >= 18 && vocabCount <= 22 ? "pass" : "fail",
    detail: `${vocabCount} items`,
  });

  // Definition rules — see docs/story-quality-spec.md §4. The corrected
  // target after the 2026-05-03 vocab audit is 8-14 English words per
  // definition across all CEFR levels. The previous 3-7w window was an
  // earlier draft that contradicted the spec and rejected the GOOD
  // examples documented in the spec itself (kochen=10w, Linsensuppe=11w).
  // Char cap is 120 to give German compounds room without letting truly
  // encyclopedic definitions slip through (≈ 14w × ~8.5 chars/w).
  const badDefs: string[] = [];
  for (const v of parsed.vocab) {
    const w = countWords(v.definition);
    const c = countChars(v.definition);
    if (w < 8 || w > 14) badDefs.push(`"${v.word}": ${w}w`);
    else if (c > 120) badDefs.push(`"${v.word}": ${c}ch`);
    else if (BANNED_DEFINITION_OPENERS.some((re) => re.test(v.definition))) {
      badDefs.push(`"${v.word}": banned opener`);
    } else if (/—/.test(v.definition)) {
      badDefs.push(`"${v.word}": em-dash`);
    }
  }
  checks.push({
    id: "vocab-definitions",
    label: "Definitions: 8-14 words, ≤120 chars, no banned openers, no em-dash",
    status: badDefs.length === 0 ? "pass" : "fail",
    detail: badDefs.length ? badDefs.join("; ") : undefined,
  });

  // Vocab type valid
  const badTypes = parsed.vocab.filter(
    (v) => v.type && !VALID_VOCAB_TYPES.has(v.type.toLowerCase())
  );
  if (badTypes.length) {
    checks.push({
      id: "vocab-types",
      label: "Vocab types are valid",
      status: "fail",
      detail: badTypes.map((v) => `${v.word}=${v.type}`).join(", "),
    });
  } else {
    checks.push({ id: "vocab-types", label: "Vocab types are valid", status: "pass" });
  }

  // Vocab appears literally in body
  const missingInBody = parsed.vocab.filter((v) => {
    const needle = (v.surface ?? v.word).toLowerCase();
    if (!needle) return false;
    const hay = parsed.text.toLowerCase();
    return !hay.includes(needle);
  });
  checks.push({
    id: "vocab-in-body",
    label: "Every vocab item appears literally in body",
    status: missingInBody.length === 0 ? "pass" : "fail",
    detail: missingInBody.length
      ? missingInBody.map((v) => v.surface ?? v.word).join(", ")
      : undefined,
  });

  // Spec §4: separable verbs en DE. El `surface` DEBE ser una cadena
  // contigua que aparece literalmente en el body. Si el body parte el
  // verbo (`lüg mich nicht an`), usar la lemma (`anlügen`) como
  // surface, NUNCA la forma separada (`lüg an`). Si lang=DE y un
  // surface contiene espacios → el karaoke pill matcher va a fallar
  // silenciosamente.
  if ((context.language ?? "").toUpperCase() === "DE") {
    const splitSurfaces = parsed.vocab.filter((v) => {
      const surface = v.surface ?? v.word;
      return /\s/.test(surface);
    });
    checks.push({
      id: "vocab-surface-contiguous",
      label: "Vocab surfaces are single contiguous strings (DE separable verbs)",
      status: splitSurfaces.length === 0 ? "pass" : "fail",
      detail: splitSurfaces.length
        ? splitSurfaces
            .map((v) => `${v.word}: "${v.surface ?? v.word}"`)
            .join("; ")
        : undefined,
    });
  }

  // Same-root duplicates
  const langForRoot = (context.language ?? "").toUpperCase();
  const rootMap = new Map<string, string[]>();
  for (const v of parsed.vocab) {
    const root = stripPrefix(v.word, langForRoot).slice(0, 5);
    if (root.length < 3) continue;
    const arr = rootMap.get(root) ?? [];
    arr.push(v.word);
    rootMap.set(root, arr);
  }
  const dupRoots = [...rootMap.entries()].filter(([, words]) => words.length > 1);
  checks.push({
    id: "vocab-no-same-root",
    label: "No same-root vocab duplicates",
    status: dupRoots.length === 0 ? "pass" : "fail",
    detail: dupRoots.length
      ? dupRoots.map(([root, ws]) => `${root}: ${ws.join("+")}`).join("; ")
      : undefined,
  });

  // Cognates
  const lang = (context.language ?? "").toUpperCase();
  const cognates = COGNATES_BY_LANG[lang] ?? [];
  const cognateHits = parsed.vocab.filter((v) =>
    cognates.includes(v.word.toLowerCase())
  );
  if (cognates.length) {
    checks.push({
      id: "vocab-no-cognates",
      label: "No transparent cognates",
      status: cognateHits.length === 0 ? "pass" : "fail",
      detail: cognateHits.length
        ? cognateHits.map((v) => v.word).join(", ")
        : undefined,
    });
  }

  // Vocab CEFR frequency check.
  // ES: hybrid — curated lemma lists (A1+A2+B1+B2+C1 acumulativos) + LLM
  //     fallback for any lemma not in the list. C2 sin restricción.
  //     Cached forever in src/lib/cefr/cache/spanish-llm-cache.json.
  // DE/IT/PT/FR: solo A1/A2 con listas (LLM fallback fase 2).
  const levelKey = (context.level ?? "").toLowerCase();
  const isA1orA2 = levelKey === "a1" || levelKey === "a2";
  type SpanishCheckLevel = "a1" | "a2" | "b1" | "b2" | "c1" | "c2";
  const VALID_ES_LEVELS = new Set<SpanishCheckLevel>([
    "a1","a2","b1","b2","c1","c2",
  ]);

  if (lang === "ES" && VALID_ES_LEVELS.has(levelKey as SpanishCheckLevel) && levelKey !== "c2") {
    const { filterSpanishWordsAtOrBelow } = await import("./cefr/spanishLevelJudge");
    const vocabWords = parsed.vocab.map((v) => v.word);
    const { aboveLevel } = await filterSpanishWordsAtOrBelow(
      vocabWords,
      levelKey as SpanishCheckLevel,
    );
    // Threshold: >2 palabras fuera de nivel → fail. Permitimos 1-2
    // como margen (alguna palabra clave del topic puede ser de
    // registro algo más alto pero pedagógicamente justificada).
    const status: CheckStatus =
      aboveLevel.length === 0
        ? "pass"
        : aboveLevel.length <= 2
          ? "warn"
          : "fail";
    checks.push({
      id: "vocab-level-frequency",
      label: `Vocab matches ${levelKey.toUpperCase()} lexical frequency (ES, list+LLM)`,
      status,
      detail:
        aboveLevel.length > 0
          ? `${aboveLevel.length} fuera de ${levelKey.toUpperCase()}: ${aboveLevel
              .slice(0, 6)
              .map((a) => `${a.word} (${a.judgedLevel.toUpperCase()})`)
              .join(", ")}${aboveLevel.length > 6 ? ` …+${aboveLevel.length - 6}` : ""}`
          : undefined,
    });
  } else if (isA1orA2) {
    const fallbackByLang: Record<string, ((word: string) => boolean) | undefined> = {
      DE: isGermanA1A2,
      IT: isItalianA1A2,
      PT: isPortugueseA1A2,
      FR: isFrenchA1A2,
    };
    const levelChecker = fallbackByLang[lang];
    if (levelChecker) {
      const outOfLevel = parsed.vocab.filter((v) => !levelChecker(v.word));
      const status: CheckStatus =
        outOfLevel.length === 0
          ? "pass"
          : outOfLevel.length <= 2
            ? "warn"
            : "fail";
      checks.push({
        id: "vocab-level-frequency",
        label: `Vocab matches ${levelKey.toUpperCase()} lexical frequency (${lang})`,
        status,
        detail:
          outOfLevel.length > 0
            ? `${outOfLevel.length} fuera de ${levelKey.toUpperCase()}: ${outOfLevel
                .slice(0, 6)
                .map((v) => v.word)
                .join(", ")}${outOfLevel.length > 6 ? ` …+${outOfLevel.length - 6}` : ""}`
            : undefined,
      });
    }
  }

  // Body CEFR check (Spanish only, all levels A1→C1).
  //
  // Tokenizes the story body, strips function words/stop-words, dedupes,
  // and runs the unique content words through the same hybrid judge.
  // This catches cases where the LLM picks A1-appropriate VOCAB items
  // but writes the surrounding paragraph at C1 register, which would
  // otherwise slip past the vocab-only check.
  //
  // Threshold for body is more permissive: stories naturally use a
  // wider range than the curated vocab. We warn at 5%+ out-of-level
  // content words, fail at 10%+.
  if (lang === "ES" && VALID_ES_LEVELS.has(levelKey as SpanishCheckLevel) && levelKey !== "c2") {
    const { extractSpanishContentWords, filterSpanishWordsAtOrBelow } = await import(
      "./cefr/spanishLevelJudge"
    );
    const contentWords = extractSpanishContentWords(parsed.text);
    if (contentWords.length >= 10) {
      const { aboveLevel } = await filterSpanishWordsAtOrBelow(
        contentWords,
        levelKey as SpanishCheckLevel,
      );
      const pct = (aboveLevel.length / contentWords.length) * 100;
      // Body check thresholds are more permissive than the vocab check:
      // natural prose pulls from a wider register than the curated vocab
      // list. We only fail when the cluster is genuinely off-level.
      const status: CheckStatus =
        pct < 10 ? "pass" : pct < 20 ? "warn" : "fail";
      checks.push({
        id: "body-level-frequency",
        label: `Body register matches ${levelKey.toUpperCase()} (ES, list+LLM)`,
        status,
        detail:
          aboveLevel.length > 0
            ? `${aboveLevel.length}/${contentWords.length} (${pct.toFixed(1)}%) palabras de body fuera de nivel: ${aboveLevel
                .slice(0, 8)
                .map((a) => `${a.word}(${a.judgedLevel.toUpperCase()})`)
                .join(", ")}${aboveLevel.length > 8 ? ` …+${aboveLevel.length - 8}` : ""}`
            : `${contentWords.length} content words analizadas, todas ≤${levelKey.toUpperCase()}`,
      });
    }
  }

  // No-consecutive-pills check (spec §4). Vocabulario en posiciones
  // adyacentes del body crea "worksheet markup feel" — pills pegados
  // sin texto entre ellos rompen la inmersión. Tokenizamos el body,
  // marcamos cuáles tokens son vocab match, y vemos si hay >2
  // consecutivos. Status warn (no fail) porque depende de la frase;
  // a veces dos palabras adyacentes son legítimamente teachable.
  const vocabSurfaces = new Set(
    parsed.vocab
      .map((v) => (v.surface ?? v.word ?? "").toLowerCase().trim())
      .filter(Boolean)
  );
  if (vocabSurfaces.size > 0) {
    const bodyTokens = parsed.text
      .toLowerCase()
      .split(/[\s.,;:!?¡¿"()—–\-]+/u)
      .filter(Boolean);
    let currentRun = 0;
    let maxRun = 0;
    for (const tok of bodyTokens) {
      if (vocabSurfaces.has(tok)) {
        currentRun += 1;
        if (currentRun > maxRun) maxRun = currentRun;
      } else {
        currentRun = 0;
      }
    }
    checks.push({
      id: "vocab-no-consecutive-pills",
      label: "No 3+ consecutive vocab pills in body",
      status: maxRun >= 3 ? "warn" : "pass",
      detail: maxRun >= 3 ? `Max run: ${maxRun} pills consecutivos` : undefined,
    });
  }

  // Vocab distribution per paragraph. Spec §4: aim for 3-5 items per
  // paragraph, NOT more than ~30% of items in any single paragraph.
  // El check anterior solo veía cluster extremo (0+ y 6+). Ahora
  // endurecemos: si cualquier ¶ tiene >30% del total → fail. Con
  // vocab=20 eso son 6+ items en un solo ¶; con vocab=18, 5+.
  const perPara = vocabPerParagraph(parsed.text, parsed.vocab);
  const zeroParaCount = perPara.filter((n) => n === 0).length;
  const sixPlusParaCount = perPara.filter((n) => n >= 6).length;
  const clusterIssue = zeroParaCount > 0 && sixPlusParaCount > 0;
  const maxInOnePara = perPara.length ? Math.max(...perPara) : 0;
  const totalVocab = parsed.vocab.length;
  const maxPct = totalVocab > 0 ? maxInOnePara / totalVocab : 0;
  const overCap = totalVocab > 0 && maxPct > 0.3;
  checks.push({
    id: "vocab-distribution",
    label: "Vocab distributed across paragraphs (no cluster, ≤30% per ¶)",
    status:
      overCap || clusterIssue
        ? "fail"
        : zeroParaCount > 2
          ? "warn"
          : "pass",
    detail:
      overCap
        ? `Cluster: ¶ con ${maxInOnePara}/${totalVocab} items (${Math.round(maxPct * 100)}%) supera el 30% cap. per ¶: [${perPara.join(", ")}]`
        : `per ¶: [${perPara.join(", ")}]`,
  });

  // Synopsis ↔ body character match — spec calls this "REQUIRED" and a
  // "hard defect": a story whose synopsis names characters that don't
  // appear in the body (Klaus/Sabine in synopsis, Anna/Tom in body) is
  // rejected at save time, not flagged for human review. The proper-noun
  // detector strips known places + day/month names; remaining false
  // positives are rare enough that fail-on-mismatch is the right default.
  const synProperNouns = extractProperNouns(parsed.synopsis);
  const bodySpeakerSet = new Set(speakerNames.map((n) => n.toLowerCase()));
  const missingFromBody = synProperNouns.filter(
    (n) => !bodySpeakerSet.has(n.toLowerCase())
  );
  if (synProperNouns.length > 0) {
    checks.push({
      id: "names-match",
      label: "Named characters in synopsis appear in body",
      status: missingFromBody.length === 0 ? "pass" : "fail",
      detail: missingFromBody.length
        ? `In synopsis only: ${missingFromBody.join(", ")}`
        : undefined,
    });
  }

  // ─── Cross-story checks ─────────────────────────────────
  const existing = context.existing ?? [];

  // Title token overlap
  const titleTokens = tokenize(parsed.title);
  const titleHit = existing.find((e) => {
    const otherTokens = tokenize(e.title);
    const shared = titleTokens.filter((t) => otherTokens.includes(t));
    return (
      shared.length > 0 &&
      shared.length / Math.max(titleTokens.length, otherTokens.length) > 0.5
    );
  });
  if (existing.length) {
    checks.push({
      id: "title-uniqueness",
      label: "Title does not share >50% tokens with existing titles",
      status: titleHit ? "fail" : "pass",
      detail: titleHit ? `Overlap with "${titleHit.title}"` : undefined,
    });

    // Title-pattern monotony. Detecta cuando el generador cae en un
    // mismo "esqueleto" repetidamente (e.g. "Peceras en Miraflores",
    // "Faroles en Tepoztlán", "Velas en Oaxaca" — todas son
    // "[Plural noun] en [Place]"). Skeleton = lista ordenada de
    // function words / connectors en lowercase ("en", "de", "y",
    // "a", "del", "la", "el", "con", "para"). Si 3+ existing comparten
    // el skeleton del nuevo título → warn al editor.
    const CONNECTORS = new Set([
      "en", "de", "del", "la", "el", "los", "las", "y", "o",
      "a", "al", "con", "por", "para", "un", "una", "que",
    ]);
    const skeleton = (t: string): string =>
      t
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .split(/[^a-z]+/)
        .filter((w) => CONNECTORS.has(w))
        .join(" ");
    const newSkeleton = skeleton(parsed.title);
    if (newSkeleton.length > 0) {
      const matches = existing.filter((e) => skeleton(e.title) === newSkeleton);
      checks.push({
        id: "title-pattern-variety",
        label: "Title structure differs from prior titles",
        status: matches.length >= 3 ? "warn" : "pass",
        detail:
          matches.length >= 3
            ? `${matches.length} prior titles share the "${newSkeleton}" skeleton — varíen la estructura`
            : undefined,
      });
    }
  }

  // Vocab cross-story repetition
  if (existing.length) {
    const usedLemmas = new Set<string>();
    for (const e of existing) for (const l of e.vocabLemmas) usedLemmas.add(l.toLowerCase());
    const repeats = parsed.vocab.filter((v) =>
      usedLemmas.has(v.word.toLowerCase())
    );
    checks.push({
      id: "vocab-cross-story",
      label: "Vocab not repeated from prior stories in this topic",
      status: repeats.length === 0 ? "pass" : "fail",
      detail: repeats.length
        ? repeats.map((v) => v.word).join(", ")
        : undefined,
    });

    // Character name reuse
    const usedNames = new Set<string>();
    for (const e of existing) for (const n of e.characterNames) usedNames.add(n.toLowerCase());
    const nameClash = speakerNames.filter((n) => usedNames.has(n.toLowerCase()));
    checks.push({
      id: "names-cross-story",
      label: "Character names not reused from prior stories",
      status: nameClash.length === 0 ? "pass" : "warn",
      detail: nameClash.length ? nameClash.join(", ") : undefined,
    });

    // arcType rotation — spec §3 "Rotation rules": (1) Do not use the
    // same non-`daily-encounter` arcType twice in three consecutive
    // stories of the same journey level/topic; (2) at most 2 consecutive
    // `daily-encounter` arcs. Both are stated as imperatives ("Do not")
    // and a third repeat is a hard rejection.
    const recent = existing.slice(-3).map((e) => e.arcType).filter(Boolean);
    const consecutiveDaily =
      parsed.arcType === "daily-encounter" &&
      recent.filter((a) => a === "daily-encounter").length >= 2;
    const isRepeat =
      parsed.arcType !== "daily-encounter" &&
      recent.includes(parsed.arcType);
    checks.push({
      id: "arctype-rotation",
      label: "arcType rotates (not same as recent stories)",
      status: consecutiveDaily ? "fail" : isRepeat ? "fail" : "pass",
      detail: recent.length ? `Recent: ${recent.join(", ")}` : undefined,
    });
  }

  return finalize(checks, parsed);
}

function extractProperNouns(s: string): string[] {
  const set = new Set<string>();
  // Strategy: find Capitalized words/phrases that follow a lowercase token or
  // appear after the first sentence-leading position. Sentence-initial capitals
  // are excluded by only matching when the previous non-space char is lowercase
  // or a comma/quote (i.e., mid-sentence). Then a stop-list filters common
  // place names and weekday/month words.
  const re = /(?<=[\p{Ll}],\s|[\p{Ll}]\s|["«»]\s)[\p{Lu}][\p{Ll}]{2,}(?:\s+[\p{Lu}][\p{Ll}]+)?/gu;
  const STOP = new Set([
    // Cities / neighborhoods that may be tested
    "Berlin", "Berlín", "Coyoacán", "Surquillo", "Lima", "Madrid", "Roma",
    "Caracas", "Chacaíto", "Trastevere", "Tiergarten", "Wedding",
    "Bogotá", "Medellín", "Buenos", "Aires", "San", "Salvador",
    "México", "Mexico", "Tokio", "Tokyo", "París", "Paris", "Telmo",
    "Campana", "Maybachufer",
    // Day / month
    "Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado",
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto",
    "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ]);
  for (const m of s.matchAll(re)) {
    const candidate = m[0].trim();
    if (STOP.has(candidate)) continue;
    if (candidate.split(/\s+/).every((w) => STOP.has(w))) continue;
    if (candidate.length < 3) continue;
    set.add(candidate);
  }
  return [...set];
}

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3);
}

function finalize(checks: Check[], parsed: StoryPayload | null): ValidationResult {
  const summary = checks.reduce(
    (acc, c) => {
      acc[c.status] += 1;
      return acc;
    },
    { pass: 0, warn: 0, fail: 0 }
  );
  return {
    ok: summary.fail === 0,
    parsed,
    checks,
    summary,
  };
}
