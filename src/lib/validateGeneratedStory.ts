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

export type StoryVocabItem = {
  word: string;
  surface?: string;
  definition: string;
  type?: string;
};

export type StoryPayload = {
  title: string;
  synopsis: string;
  arcType: string;
  text: string;
  vocab: StoryVocabItem[];
};

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
    // Fallback: try to find the first {…} block
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

export function validateGeneratedStory(
  input: string | StoryPayload,
  context: ValidationContext = {}
): ValidationResult {
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

  // Definition rules
  const badDefs: string[] = [];
  for (const v of parsed.vocab) {
    const w = countWords(v.definition);
    const c = countChars(v.definition);
    if (w < 3 || w > 7) badDefs.push(`"${v.word}": ${w}w`);
    else if (c > 50) badDefs.push(`"${v.word}": ${c}ch`);
    else if (BANNED_DEFINITION_OPENERS.some((re) => re.test(v.definition))) {
      badDefs.push(`"${v.word}": banned opener`);
    } else if (/—/.test(v.definition)) {
      badDefs.push(`"${v.word}": em-dash`);
    }
  }
  checks.push({
    id: "vocab-definitions",
    label: "Definitions: 3-7 words, ≤50 chars, no banned openers, no em-dash",
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

  // Vocab distribution per paragraph
  const perPara = vocabPerParagraph(parsed.text, parsed.vocab);
  const zeroParaCount = perPara.filter((n) => n === 0).length;
  const sixPlusParaCount = perPara.filter((n) => n >= 6).length;
  const clusterIssue = zeroParaCount > 0 && sixPlusParaCount > 0;
  checks.push({
    id: "vocab-distribution",
    label: "Vocab distributed across paragraphs (no cluster)",
    status: clusterIssue ? "fail" : zeroParaCount > 2 ? "warn" : "pass",
    detail: `per ¶: [${perPara.join(", ")}]`,
  });

  // Synopsis ↔ body character match
  const synProperNouns = extractProperNouns(parsed.synopsis);
  const bodySpeakerSet = new Set(speakerNames.map((n) => n.toLowerCase()));
  const missingFromBody = synProperNouns.filter(
    (n) => !bodySpeakerSet.has(n.toLowerCase())
  );
  if (synProperNouns.length > 0) {
    checks.push({
      id: "names-match",
      label: "Named characters in synopsis appear in body",
      status: missingFromBody.length === 0 ? "pass" : "warn",
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

    // arcType rotation
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
      status: consecutiveDaily ? "fail" : isRepeat ? "warn" : "pass",
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
