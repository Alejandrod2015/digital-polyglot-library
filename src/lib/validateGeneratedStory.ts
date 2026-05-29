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
  /** Titles of every other story in the same journey (across all topics
   *  and levels). Used by the anchor-repetition and title-template-
   *  monotony checks. Pass `[]` or omit to skip those checks. */
  journeyTitles?: string[];
  /** Journey variant (LATAM, iberian, etc.). Used by the region check
   *  to decide which whitelist of accepted anchors to apply. When
   *  omitted, no region check runs. */
  variant?: string;
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
    // Transparent cognates that English-native learners decode at sight.
    // Listing them in vocab wastes a slot. Be conservative: only words
    // that are LITERALLY identical or near-identical to their English
    // equivalent and add zero learning value. Borderline cases (color,
    // minuto, día, animal) stay teachable.
    "foto", "fotografía", "fotografia", "teléfono", "telefono",
    "café", "cafe", "hotel", "restaurante", "pizza", "taxi",
    "música", "musica", "computadora", "computador", "internet",
    "doctor", "doctora", "hospital", "chocolate", "banana",
    "piano", "guitarra", "violín", "violin", "familia",
    "automóvil", "automovil", "metro", "actor", "actriz", "artista",
    "fantástico", "fantastico", "perfecto", "especial",
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

  // Title × topic semantic match. For topics whose meaning is sharply
  // defined (airport vs hotel vs hospital), the title MUST reference
  // the topic semantically — otherwise the cover image, audio voice
  // cast, and learner expectation drift apart from the actual content.
  // We catch the obvious case ("Praça Mauá" titled in `airport-transit`
  // because there's no airport at Praça Mauá) without needing an LLM.
  //
  // Only enforced for topics where the constraint is sharp; broader
  // topics (food-everyday-life, home-family, city-getting-around) have
  // no strict keyword requirement because any plausible cultural
  // anchor is acceptable.
  const TOPIC_TITLE_KEYWORDS: Record<string, RegExp[]> = {
    "airport-transit": [
      /aeropuert|terminal|embarqu|vuelo|aviÃ³n|avión|check[\s-]?in|despegu|aterrizaj|chegad|partid|gate|sala\s+vip/i,
      // common Spanish-speaking + nearby airports learners recognize
      /\b(galeão|galeao|barajas|ezeiza|aeroparque|jorge\s+chávez|jorge\s+chavez|el\s+dorado|tocumen|santos\s+dumont|guarulhos|congonhas|charles\s+de\s+gaulle|orly|fiumicino|malpensa|jfk|laguardia|heathrow|gatwick|narita|haneda|tegel|brandenburg)\b/i,
    ],
    "accommodation-stays": [
      /hotel|hostal|hostel|pensiÃ³n|pensión|albergu|alojamient|posad|habitaciÃ³n|habitación|recepciÃ³n|recepción|chalet|cabaÃ±a|cabaña|airbnb|hospedaj|residencial|departament|apartament|alquil|portal/i,
    ],
    "health-wellbeing": [
      /hospital|clÃ­nic|clínic|farmaci|mÃ©dic|médic|doctor|consultori|urgenci|emergenci|enfermerÃ­a|enfermería|paramedic|salud|chequeo|consulta|jugo|infusiÃ³n|infusión|mate|tÃ©|té|hierba|spa|masaje|yoga|ejercicio|gimnasio|descanso|siesta|respiraciÃ³n|respiración|quinua|ceviche|caldo|sopa/i,
    ],
  };
  const topicForTitleCheck = (context.topic ?? "").toLowerCase();
  const titleTopicRegexes = TOPIC_TITLE_KEYWORDS[topicForTitleCheck];
  if (titleTopicRegexes) {
    const matched = titleTopicRegexes.some((re) => re.test(parsed.title));
    checks.push({
      id: "title-topic-match",
      label: `Title semantically matches topic "${topicForTitleCheck}"`,
      status: matched ? "pass" : "fail",
      detail: matched
        ? undefined
        : `Title "${parsed.title}" doesn't reference the topic. Add a venue/event keyword that matches "${topicForTitleCheck}" (e.g. for airport-transit: aeropuerto, terminal, embarque, vuelo, or a real airport name like Galeão, Ezeiza, Barajas).`,
    });
  }

  // Title × journey region. When variant=latam, every proper noun in the
  // title must be a recognized LATAM place. We use a whitelist (not a
  // blacklist of global non-LATAM cities) so the rule is bounded and
  // explicit: the world of LATAM anchors grows curated, not by chasing
  // every new global city. The list deliberately covers all Spanish-
  // speaking LATAM countries plus Brazil cities that Spanish learners
  // legitimately transit through (Rio, Galeão, São Paulo).
  //
  // Anchor IN whitelist → pass region check. Anchor NOT in whitelist
  // (and variant=latam) → fail.
  const LATAM_PLACES = LATAM_PLACES_SET;
  const variantLower = (context.variant ?? "").toLowerCase();
  const titleRegionLang = (context.language ?? "").toUpperCase();
  if (titleRegionLang === "ES" && variantLower === "latam") {
    // Direct title scan — we cannot reuse extractProperNouns here
    // because its STOP list strips well-known city names (Madrid,
    // Roma, Lima, etc.) so the names-match check stays focused on
    // character names. For region detection we *want* to catch those.
    const norm = (s: string) =>
      s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const titleNorm = " " + norm(parsed.title).replace(/[^a-z0-9]+/g, " ") + " ";
    // For each whitelist/blacklist entry, check if it appears in the
    // title as a whole word (surrounded by non-letter). This avoids
    // false positives like "santiago" matching "santiago de chile" or
    // "san josé" splitting into matching tokens.
    const isHit = (entry: string) =>
      titleNorm.includes(" " + norm(entry).replace(/\s+/g, " ") + " ");
    const hits = {
      latam: [...LATAM_PLACES].filter(isHit),
      nonLatam: [...NON_LATAM_PLACES_SET].filter(isHit),
    };
    const anchors = extractProperNouns(parsed.title);
    if (anchors.length > 0 || hits.latam.length > 0 || hits.nonLatam.length > 0) {
      // Hybrid: positive whitelist + negative blacklist.
      //   - Any anchor in NON_LATAM_PLACES (Sevilla, Madrid, Tokyo, Roma,
      //     Trastevere, …) → FAIL (egregious wrong-region).
      //   - At least one anchor in LATAM whitelist → PASS.
      //   - Neither → WARN. The title might be a generic venue type
      //     (Pulpería, Costanera, Estancia) where the LATAM-ness is
      //     implicit; flag for worker review without auto-demoting.
      // LATAM check first: if any anchor is in the LATAM whitelist the
      // title is rooted in the region, no matter what other proper
      // nouns appear. This handles ambiguous words (Palermo BA vs
      // Italy, Colonia UY vs Germany, Córdoba AR vs Spain) by letting
      // the LATAM context win.
      const hasLatamAnchor = hits.latam.length > 0;
      if (!hasLatamAnchor) {
        const nonLatamHit = hits.nonLatam[0];
        if (nonLatamHit) {
          checks.push({
            id: "title-region-mismatch",
            label: "Title anchor outside the journey's region (LATAM Spanish)",
            status: "fail",
            detail: `Anchor "${nonLatamHit}" is not Latin-American. Spanish Traveler · LATAM journeys must anchor on a Latin-American place; Spain (Madrid, Barcelona, Sevilla, Valencia, Bilbao…) is Iberian, not LATAM.`,
          });
        } else {
          checks.push({
            id: "title-region-mismatch",
            label: "Title anchor not confirmed LATAM",
            status: "warn",
            detail: `Title proper nouns ${anchors
              .map((a) => `"${a}"`)
              .join(", ")} are not in the LATAM whitelist. If the story is set in Latin America, prefer adding a recognizable LATAM city or neighborhood to the title (Buenos Aires, Lima, La Paz, Cartagena, etc.).`,
          });
        }
      }
    }
  }

  // Title language consistency. Stories tagged language=spanish should
  // not use Portuguese-only characters (ç, ã) in the title, German β,
  // etc. Warn (not fail) because rare cases like proper toponyms can
  // legitimately carry foreign diacritics ("São Paulo" en historia ES
  // sigue siendo razonable). The warn surfaces the suspicion so the
  // worker checks before publishing.
  const LANG_FOREIGN_CHARS: Record<string, RegExp> = {
    ES: /[çÇãÃõÕß]/,
    DE: /[çÇãÃõÕñÑ]/,
    IT: /[çÇãÃõÕñÑß]/,
    FR: /[ãÃõÕñÑß]/,
  };
  const titleLangCode = (context.language ?? "").toUpperCase();
  const foreignCharRegex = LANG_FOREIGN_CHARS[titleLangCode];
  if (foreignCharRegex) {
    const hit = parsed.title.match(foreignCharRegex);
    if (hit) {
      checks.push({
        id: "title-language-consistency",
        label: "Title uses characters foreign to the target language",
        status: "warn",
        detail: `Found "${hit[0]}" in title. ${titleLangCode} stories normally don't use this character; verify the anchor is correct (toponyms like "São Paulo" are OK if intentional).`,
      });
    }
  }

  // Title anchor repetition across the journey. If the same proper noun
  // already appears in 2+ other titles of this journey, the journey
  // feels like a single neighborhood instead of a varied LATAM tour.
  // Warn at 2 repeats; fail at 3+ (genuine overuse).
  const journeyTitles = context.journeyTitles ?? [];
  if (journeyTitles.length > 0) {
    const myAnchors = extractProperNouns(parsed.title);
    if (myAnchors.length > 0) {
      const otherAnchorCounts: Record<string, number> = {};
      for (const t of journeyTitles) {
        if (t === parsed.title) continue;
        for (const a of extractProperNouns(t)) {
          const key = a.toLowerCase();
          otherAnchorCounts[key] = (otherAnchorCounts[key] ?? 0) + 1;
        }
      }
      const repeatedAnchors = myAnchors
        .map((a) => ({ anchor: a, count: otherAnchorCounts[a.toLowerCase()] ?? 0 }))
        .filter((x) => x.count >= 2);
      if (repeatedAnchors.length > 0) {
        const worst = repeatedAnchors.reduce((a, b) => (a.count > b.count ? a : b));
        const status: CheckStatus = worst.count >= 3 ? "fail" : "warn";
        checks.push({
          id: "title-anchor-repetition",
          label: "Title anchor already used in multiple stories of this journey",
          status,
          detail: `Anchor "${worst.anchor}" appears in ${worst.count} other title${worst.count === 1 ? "" : "s"} of this journey. ${
            status === "fail"
              ? "Pick a different LATAM city to keep the journey from feeling like one neighborhood."
              : "Consider rotating to a different city if this isn't intentional."
          }`,
        });
      }
    }
  }

  // Matches "X en|de|del|al|a la|por|junto a|frente a|cerca de|bajo|sobre Y".
  // Hoisted because used by both monotony (with journey context) and
  // formula-default (standalone, no context required).
  const TITLE_FORMULA_RE =
    /^[\p{L}\p{N}\s'.¡!¿?,]+?\s+(en|de|del|al|a\s+la|por|junto\s+al?|frente\s+al?|cerca\s+del?|bajo\s+(?:el|la|los|las)?|sobre\s+(?:el|la|los|las)?)\s+[\p{L}\p{N}\s'.,]+$/iu;
  // Exempt openings that are clearly NOT the "Noun + en/de + Place"
  // formula even though they share the connector token. Time
  // fragments, days of the week, verb-initial titles, etc. should
  // pass the formula-default check.
  const TITLE_NON_FORMULA_STARTERS = [
    /^antes\s+(de|del)\b/i,
    /^despu[ée]s\s+(de|del)\b/i,
    /^mientras\b/i,
    /^cuando\b/i,
    /^durante\b/i,
    /^hoy\b/i,
    /^ayer\b/i,
    /^ma[ñn]ana\b/i,
    /^(lunes|martes|mi[ée]rcoles|jueves|viernes|s[áa]bado|domingo)\b/i,
    /^esta\s+(noche|tarde|ma[ñn]ana|semana|vez)\b/i,
    /^(ya|no)\b/i, // mini-sentence starters: "Ya no quedan velas", "No abre hoy"
  ];
  const isExemptStarter = TITLE_NON_FORMULA_STARTERS.some((re) =>
    re.test(parsed.title)
  );
  const titleMatchesFormula =
    TITLE_FORMULA_RE.test(parsed.title) && !isExemptStarter;

  // Title template monotony. Most stories in the LATAM Spanish journey
  // follow a "Noun en/de/del Place" pattern. Past ~60% of titles in the
  // same journey using one template = formulaic feel. Suggest varied
  // structures (time fragment, day+person, progressive verb, "para X").
  if (journeyTitles.length >= 6) {
    const formulaTotal = journeyTitles.filter((t) => TITLE_FORMULA_RE.test(t)).length;
    const formulaRatio = formulaTotal / journeyTitles.length;
    if (titleMatchesFormula && formulaRatio > 0.55) {
      checks.push({
        id: "title-template-monotony",
        label: "Title follows a template already overused in this journey",
        status: "warn",
        detail: `${Math.round(formulaRatio * 100)}% of titles in this journey already use the "X en/de/del Y" pattern. Try a different structure: time fragment ("Antes de las dos"), day + person ("Jueves con doña Luz"), progressive verb ("Mientras gira el trompo"), "para X" ("Pan de yuca para Ana"), or a full mini-sentence ("Ya no quedan velas").`,
      });
    }
  }

  // Title formula default. Fires whenever the title matches "X en/de/
  // del/al Y" regardless of journey context. The pattern is the LLM
  // default — most stories slip into it without a journey to compare
  // against. We warn standalone too so the worker sees the formula and
  // gets the alternative-structure menu before staging.
  if (titleMatchesFormula) {
    checks.push({
      id: "title-formula-default",
      label: "Title uses the default \"X en/de/del Y\" formula",
      status: "warn",
      detail: `Title "${parsed.title}" follows the default "X en/de/del Y" formula. ChatGPT defaults to this template; try a different structure to keep variety: time fragment ("Antes de las dos"), day + person ("Jueves con doña Luz"), progressive verb ("Mientras gira el trompo"), "para X" ("Pan de yuca para Ana"), or a full mini-sentence ("Ya no quedan velas"). Acceptable if the journey deliberately schedules a formulaic title, but reject otherwise.`,
    });
  }

  // Title anchor recognizability (A1/A2 ES only). For beginner Spanish
  // learners, a title anchored on Tungurahua/Sopocachi/Yanahuara is
  // noise — they can't pronounce it or place it on a map. Prefer
  // widely-known cities and famous neighborhoods. Warn (not fail)
  // because some specific anchors are legitimate if the story builds
  // recognition around them.
  const recognizabilityLevel = (context.level ?? "").toLowerCase();
  if (
    titleLangCode === "ES" &&
    (recognizabilityLevel === "a1" || recognizabilityLevel === "a2")
  ) {
    const A1_LATAM_ANCHORS = new Set([
      // Mexico
      "ciudad de méxico", "ciudad de mexico", "méxico", "mexico",
      "coyoacán", "coyoacan", "xochimilco", "chapultepec", "san ángel",
      "san angel", "polanco", "condesa", "roma norte", "oaxaca",
      "puebla", "mérida", "merida", "cancún", "cancun", "tulum",
      "tijuana", "guadalajara", "monterrey", "veracruz", "mazatlán",
      "mazatlan", "san cristóbal",
      // Argentina
      "buenos aires", "palermo", "san telmo", "la boca", "caminito",
      "recoleta", "belgrano", "puerto madero", "mendoza", "córdoba",
      "cordoba", "rosario", "bariloche", "ushuaia", "mar del plata",
      "aeroparque", "ezeiza", "mataderos",
      // Peru
      "lima", "miraflores", "barranco", "cusco", "cuzco", "arequipa",
      "san isidro", "surquillo", "chorrillos", "callao",
      "jorge chávez", "jorge chavez", "lúcuma", "ceviche",
      // Colombia
      "bogotá", "bogota", "medellín", "medellin", "cartagena", "cali",
      "santa marta", "la candelaria", "candelaria", "chapinero",
      "el poblado", "getsemaní", "getsemani", "el dorado", "laureles",
      // Chile
      "santiago", "valparaíso", "valparaiso", "viña del mar",
      "vina del mar", "providencia", "lastarria", "bellavista",
      "chiloé", "chiloe", "atacama",
      // Venezuela
      "caracas", "altamira",
      // Uruguay
      "montevideo", "colonia", "punta del este", "carrasco",
      "tres cruces",
      // Ecuador
      "quito", "guayaquil", "cuenca", "baños", "banos", "salinas",
      "otavalo",
      // Bolivia
      "la paz", "santa cruz", "sucre", "cochabamba", "potosí", "potosi",
      // Paraguay
      "asunción", "asuncion",
      // Other capitals
      "managua", "tegucigalpa", "san josé", "san jose", "panamá",
      "panama", "panama city", "san salvador", "santo domingo",
      "la habana", "havana",
      // Brazil (Spanish-learner travels through)
      "rio", "rio de janeiro", "são paulo", "sao paulo", "galeão",
      "galeao",
    ]);
    const titleAnchors = extractProperNouns(parsed.title);
    if (titleAnchors.length > 0) {
      const unknown = titleAnchors.filter(
        (a) => !A1_LATAM_ANCHORS.has(a.toLowerCase())
      );
      if (unknown.length > 0) {
        checks.push({
          id: "title-anchor-recognizability",
          label: "Title anchor may be too obscure for A1/A2 learners",
          status: "warn",
          detail: `Anchor(s) "${unknown.join(", ")}" might be unrecognizable for English-native A1/A2 Spanish learners. Prefer well-known LATAM cities/neighborhoods (Coyoacán, La Candelaria, Miraflores, San Telmo, Palermo, Mérida, Oaxaca, Valparaíso, La Paz, Cartagena, Bogotá, Buenos Aires). If the obscure anchor is intentional, the story should make it discoverable through context.`,
        });
      }
    }
  }

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

  // Consecutive narrator paragraphs. Two narrator beats back-to-back
  // (without a dialogue line between them) fragment the prose and read
  // as a generation artifact. Combine into one paragraph or move the
  // second beat after the next dialogue turn. Warn after the opening
  // (we expect the opening to be one narrator block, possibly split
  // into 2-3 short paragraphs for vocab distribution; the check fires
  // when consecutive narrators appear MID-STORY between dialogue).
  {
    const paragraphs = parsed.text
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);
    const isDialogueLine = (p: string) => /^[\p{Lu}][\p{L}\s'-]*:\s/u.test(p);
    let consecutiveNarrators = 0;
    let sawDialogue = false;
    for (const p of paragraphs) {
      const dialogue = isDialogueLine(p);
      if (dialogue) {
        sawDialogue = true;
        consecutiveNarrators = 0;
      } else if (sawDialogue) {
        // We only count consecutive narrators AFTER the first dialogue
        // line so the opening cluster (1-3 narrator paragraphs) is
        // exempted.
        consecutiveNarrators++;
        if (consecutiveNarrators >= 2) break;
      }
    }
    checks.push({
      id: "body-consecutive-narrators",
      label: "Narrator paragraphs not stacked between dialogue turns",
      status: consecutiveNarrators >= 2 ? "warn" : "pass",
      detail:
        consecutiveNarrators >= 2
          ? "Two narrator beats back-to-back without a dialogue line between. Combine into one paragraph or insert a dialogue turn between them."
          : undefined,
    });

    // ── Narrative-quality heuristics (no LLM, all deterministic) ──
    //
    // Opening ficha técnica. ChatGPT often produces openings like
    // "Elena es la madre de María. María estudia en la universidad.
    //  Pablo trabaja en una tienda." — biography-as-list rather than
    // scene. We detect this by counting copular/descriptive sentences
    // at the start: ProperNoun + (es | tiene | estudia | trabaja |
    // vive | viste | usa | lleva). Two or more in the opening = warn.
    {
      const firstPara = paragraphs[0] ?? "";
      const sentences = firstPara.match(/[^.!?]+[.!?]/g) ?? [firstPara];
      const FICHA_RE =
        /\b[\p{Lu}][\p{Ll}]+(?:\s+[\p{Lu}][\p{Ll}]+)?\s+(?:es|son|era|eran|fue|fueron|tiene|tienen|tenía|tenían|estudia|estudian|estudiaba|trabaja|trabajan|trabajaba|vive|viven|vivía|usa|lleva|llevaba)\b/u;
      const fichaCount = sentences.filter((s) => FICHA_RE.test(s)).length;
      if (fichaCount >= 2) {
        checks.push({
          id: "opening-ficha-tecnica",
          label: "Opening reads like a character profile, not a scene",
          status: "warn",
          detail: `Opening paragraph has ${fichaCount} biography-style sentences ("X es / X estudia / X trabaja"). Show the relationships through actions and gestures instead of declaring them. Example fix: "X sirve café a sus dos hijos" instead of "X es la madre de Y y Z".`,
        });
      }
    }

    // Sensory overload. The spec asks for ONE sensory anchor per
    // story; multiple senses dilute the atmosphere. We count distinct
    // sensory CATEGORIES (smell, sight-light, sound, temperature,
    // touch, taste) in the body. 3+ categories = warn.
    {
      const SENSE_CATEGORIES: Record<string, RegExp> = {
        smell: /\b(olor|aroma|perfume|huele|huelen|olía|olor[eo]s|olfato)\b/i,
        light: /\b(luz|luces|iluminac|brilla|brilló|brillan|sombra|sombras|claroscuro|oscur[oa]|deslumbra)\b/i,
        sound: /\b(sonido|sonidos|ruido|ruidos|silencio|suena|sonaba|sonaron|tronaba|trueno|ladrido|grito|murmullo|silbido|escuch[oóa]|oye|oyó)\b/i,
        temperature: /\b(frío|fría|frio|caliente|calor|cálid[oa]|fresca|fresco|helad[oa]|hierve|tibi[oa]|gélid[oa]|templad[oa])\b/i,
        touch: /\b(suave|áspero|aspero|rugoso|liso|húmedo|humedo|seco|seca|blando|duro|firme|pegajos[oa])\b/i,
        taste: /\b(dulce|amargo|salado|ácido|acido|picante|sabor|saborea|gusta\s+a)\b/i,
      };
      const presentCategories = Object.entries(SENSE_CATEGORIES)
        .filter(([, re]) => re.test(parsed.text))
        .map(([cat]) => cat);
      if (presentCategories.length >= 3) {
        checks.push({
          id: "body-sensory-overload",
          label: "Body uses too many sensory categories",
          status: "warn",
          detail: `Found ${presentCategories.length} sensory categories (${presentCategories.join(", ")}). The spec asks for ONE clean sensory anchor per story (only smell, or only sound, etc.). Trim the extras so the chosen sense lands harder.`,
        });
      }
    }

    // Synopsis ↔ opening duplication. The synopsis is internal
    // metadata; the reader never sees it. When the synopsis describes
    // the scene (props, props, action) and the body opens with the
    // same scene in different words, the body wastes its opening
    // duplicating metadata instead of starting the story. We measure
    // lexical overlap on content nouns/verbs between the synopsis and
    // the first paragraph of the body. High overlap → warn the worker
    // to make the synopsis a HOOK (conflict/tension) and reserve scene
    // description for the body only.
    {
      const stopwords = new Set([
        "el","la","los","las","un","una","unos","unas","de","del","y","o","a",
        "al","en","con","por","para","que","se","su","sus","es","son","era",
        "fue","ser","estar","está","están","esta","este","ese","esa","esos",
        "esas","aquel","aquella","tu","tú","te","mi","yo","él","ella","ellos",
        "no","sí","si","muy","más","menos","pero","como","cuando","donde",
        "sobre","entre","desde","hasta","sin","todo","todos","toda","todas",
        "uno","una","ya","aún","aun","hay","tiene","tienen","mientras",
      ]);
      const tokenize = (s: string) =>
        new Set(
          s
            .toLowerCase()
            .normalize("NFD")
            .replace(/[̀-ͯ]/g, "")
            .replace(/[^a-z0-9\s]/g, " ")
            .split(/\s+/)
            .filter((w) => w.length >= 4 && !stopwords.has(w))
        );
      const synTokens = tokenize(parsed.synopsis);
      const openingPara = paragraphs[0] ?? "";
      const openingTokens = tokenize(openingPara);
      if (synTokens.size >= 8 && openingTokens.size >= 8) {
        let shared = 0;
        for (const t of synTokens) if (openingTokens.has(t)) shared++;
        const overlap = shared / Math.min(synTokens.size, openingTokens.size);
        if (overlap >= 0.5) {
          checks.push({
            id: "synopsis-opening-duplicate",
            label: "Synopsis and body opening describe the same scene",
            status: "warn",
            detail: `${shared} content words overlap (${Math.round(overlap * 100)}% of the smaller set). The synopsis is internal metadata and shouldn't duplicate the body opening. Rewrite the synopsis as a HOOK: the conflict, tension, or question the story explores — not a re-description of props and actions. The body opens the scene; the synopsis explains the arc.`,
          });
        }
      }
    }

    // Treasure-hunt opening dialogue. The first three speaker turns
    // should set stakes, not locate objects. We count location words
    // ("aquí", "allá", "cerca de", "junto a", "encima de", "debajo
    // de", "sobre", "detrás de") in the first three speaker lines.
    // If 2+ of the 3 contain such words, the opening dialogue is
    // probably a treasure hunt.
    {
      const dialogueLines = paragraphs.filter((p) =>
        /^[\p{Lu}][\p{L}\s'-]*:\s/u.test(p)
      );
      const firstThree = dialogueLines.slice(0, 3);
      const LOCATION_RE =
        /\b(aquí|aqui|allá|alla|allí|alli|cerca\s+de|junto\s+a|al\s+lado\s+de|encima\s+de|debajo\s+de|detrás\s+de|detras\s+de|delante\s+de|dentro\s+de|sobre\s+(?:el|la|los|las)|en\s+(?:el|la|los|las)\s+(?:mesa|silla|ventana|puerta|repisa|cajón|cajon|estante|piso|suelo|pared))\b/i;
      const locationHits = firstThree.filter((line) => LOCATION_RE.test(line));
      if (firstThree.length >= 3 && locationHits.length >= 2) {
        checks.push({
          id: "dialogue-treasure-hunt-opening",
          label: "Opening dialogue is locating objects, not setting stakes",
          status: "warn",
          detail: `${locationHits.length} of the first 3 dialogue turns are about WHERE things are ("aquí", "cerca de", "junto a"). The opening dialogue should establish stakes (a question, a refusal, a hidden tension), not inventory the room. Move the object logistics to narrator and start the dialogue with something at stake.`,
        });
      }
    }

    // Bare imperative ending a dialogue turn (ES only). ElevenLabs
    // renders short imperative sentences with rising/question
    // intonation when they end a turn without a follow-up sentence,
    // regardless of voice, model, stability, or punctuation
    // (confirmed empirically in 2026-05-29 audition tests A–L on
    // Horacio v2/v3). The only fix that survived all tests was a
    // second complete sentence after the imperative (e.g. "Trae los
    // vasos. Gracias.") or rephrasing as a question / declarative.
    // Spec rule lives in docs/story-quality-spec.md §3 "Bare
    // imperatives (HARD BAN in dialogue)". This check enforces it.
    if (titleLangCode === "ES") {
      // Optional subject pronoun prefix ("Tú", "Usted") + imperative verb.
      // Spanish frequently fronts the subject pronoun for emphasis ("Tú
      // siéntate.", "Usted espere."); without (Tú|Usted)?\s* the regex
      // misses those even though TTS treats them as bare imperatives.
      const SPANISH_IMPERATIVE_HEAD_RE =
        /^(?:(?:Tú|Tu|Usted|Ustedes|Vosotros|Vosotras)\s+)?(Trae|Tráe|Pon|Pón|Mira|Mire|Espera|Espere|Ven|Venga|Dame|Deme|Toma|Tome|Saca|Saque|Abre|Abra|Cierra|Cierre|Lee|Lea|Habla|Hable|Ayuda|Ayúdame|Ayúdeme|Llama|Llame|Come|Coma|Bebe|Beba|Sigue|Siga|Para|Pare|Sube|Suba|Baja|Baje|Entra|Entre|Sal|Salga|Dale|Hazlo|Hazme|Dime|Anda|Ándale|Vete|Váyase|Pasa|Pase|Cuelga|Cuelgue|Coge|Coja|Agarra|Agarre|Busca|Busque|Lleva|Lleve|Deja|Deje|Quita|Quite|Apaga|Apague|Prende|Prenda|Enciende|Encienda|Cuenta|Cuente|Siéntate|Siéntese|Levántate|Levántese)\b/u;
      const SPEAKER_LINE_RE = /^[\p{Lu}][\p{L}\s'-]*:\s+(.*)$/u;
      const dialogueLines = paragraphs.filter((p) => SPEAKER_LINE_RE.test(p));
      const offenders: string[] = [];
      for (const line of dialogueLines) {
        const m = line.match(SPEAKER_LINE_RE);
        if (!m) continue;
        const speech = m[1].trim();
        const sentences = speech
          .split(/(?<=[.!?…])\s+/)
          .map((s) => s.trim())
          .filter(Boolean);
        if (sentences.length === 0) continue;
        const last = sentences[sentences.length - 1];
        if (!last.endsWith(".")) continue; // questions and `!` are fine
        const words = last.replace(/[.…]+$/, "").split(/\s+/).filter(Boolean);
        if (words.length > 4) continue;
        if (!SPANISH_IMPERATIVE_HEAD_RE.test(last)) continue;
        offenders.push(line);
      }
      if (offenders.length > 0) {
        checks.push({
          id: "dialogue-bare-imperative",
          label: "Bare imperative ends a dialogue turn (ElevenLabs uptalk)",
          status: "fail",
          detail:
            `${offenders.length} dialogue turn(s) end with a short imperative + period and no follow-up sentence. ` +
            `ElevenLabs renders these with rising/question intonation regardless of voice or model. ` +
            `Fix by adding a short closing sentence ("Trae los vasos. Gracias."), a vocative + closer ("Come, mija. El caldo se enfría."), ` +
            `or rephrasing as a polite request question ("¿Me traes los vasos?") or declarative ("Necesito los vasos."). ` +
            `Offending turn(s): ${offenders.slice(0, 3).map((l) => `"${l}"`).join("; ")}` +
            (offenders.length > 3 ? ` (+${offenders.length - 3} more)` : ""),
        });
      }
    }

    // City-without-country in the opening (A1 ES only). An English-
    // native A1 learner doesn't know that Coyoacán is in Mexico,
    // Barranco in Peru, San Telmo in Argentina. The opening narrator
    // should pair the first LATAM city it names with its country so
    // the learner has a frame: "En Lima, capital de Perú,..." or "Es
    // martes en Bogotá, Colombia,...". Without the country, the place
    // is just a noise word.
    if (titleLangCode === "ES" && recognizabilityLevel === "a1") {
      // city → list of acceptable country markers. All entries are
      // stored deburred + lowercased for accent-insensitive matching;
      // the helper below deburrs the body the same way before lookup.
      const CITY_COUNTRY_MAP: Array<{ cities: string[]; countries: string[] }> = [
        // Mexico
        { cities: ["ciudad de mexico", "cdmx", "coyoacan", "xochimilco", "chapultepec", "san angel", "polanco", "condesa", "tepoztlan", "jalatlaco", "nativitas", "puebla", "oaxaca", "merida", "cancun", "tulum", "tijuana", "guadalajara", "monterrey", "veracruz", "mazatlan", "san cristobal", "queretaro", "guanajuato", "morelia"], countries: ["mexico", "mejico"] },
        // Argentina
        { cities: ["buenos aires", "palermo", "san telmo", "la boca", "caminito", "recoleta", "belgrano", "once", "mataderos", "aeroparque", "ezeiza", "paseo colon", "parque rodo", "mendoza", "cordoba", "rosario", "bariloche", "ushuaia", "mar del plata", "salta", "jujuy", "tucuman"], countries: ["argentina"] },
        // Peru
        { cities: ["lima", "miraflores", "barranco", "cusco", "cuzco", "arequipa", "san isidro", "surquillo", "chorrillos", "callao", "trujillo", "iquitos", "puno", "chiclayo", "piura", "yanahuara", "jorge chavez"], countries: ["peru"] },
        // Colombia
        { cities: ["bogota", "medellin", "cartagena", "cali", "santa marta", "la candelaria", "chapinero", "el poblado", "getsemani", "laureles", "el dorado", "villa de leyva", "barranquilla", "manizales", "pereira", "chorro de quevedo", "parque 93"], countries: ["colombia"] },
        // Chile
        { cities: ["santiago", "valparaiso", "vina del mar", "providencia", "lastarria", "bellavista", "chiloe", "atacama", "punta arenas", "sopocachi"], countries: ["chile"] },
        // Venezuela
        { cities: ["caracas", "altamira", "maracaibo"], countries: ["venezuela"] },
        // Uruguay
        { cities: ["montevideo", "colonia", "punta del este", "carrasco", "tres cruces", "pocitos", "ciudad vieja", "la rambla"], countries: ["uruguay"] },
        // Ecuador
        { cities: ["quito", "guayaquil", "cuenca", "banos", "salinas", "otavalo", "tungurahua"], countries: ["ecuador"] },
        // Bolivia
        { cities: ["la paz", "santa cruz", "sucre", "cochabamba", "potosi", "oruro", "el alto"], countries: ["bolivia"] },
        // Paraguay
        { cities: ["asuncion", "mercado 4", "ciudad del este"], countries: ["paraguay"] },
        // Central America
        { cities: ["managua", "granada", "masaya", "leon"], countries: ["nicaragua"] },
        { cities: ["tegucigalpa", "san pedro sula"], countries: ["honduras"] },
        { cities: ["san jose", "monteverde", "jaco", "tortuguero", "puerto limon"], countries: ["costa rica"] },
        { cities: ["panama"], countries: ["panama"] },
        { cities: ["san salvador"], countries: ["el salvador"] },
        { cities: ["antigua"], countries: ["guatemala"] },
        // Caribbean
        { cities: ["santo domingo", "punta cana", "puerto plata"], countries: ["republica dominicana", "dominicana"] },
        { cities: ["la habana", "havana"], countries: ["cuba"] },
        { cities: ["san juan", "ponce", "mayaguez"], countries: ["puerto rico"] },
        // Brazil (Spanish-learner transit)
        { cities: ["rio", "rio de janeiro", "sao paulo", "galeao", "santos dumont", "lapa", "praca maua"], countries: ["brasil", "brazil"] },
      ];
      const norm = (s: string) =>
        s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
      // Helper: does `text` contain `word` as a whole token (Unicode-
      // safe boundary check that handles accented letters in word
      // characters)? We pad the text with spaces and use char-class
      // checks instead of \b.
      const containsWord = (text: string, word: string): boolean => {
        const idx = text.indexOf(word);
        if (idx === -1) return false;
        const before = idx === 0 ? " " : text[idx - 1];
        const after = idx + word.length >= text.length ? " " : text[idx + word.length];
        return !/[a-z0-9]/i.test(before) && !/[a-z0-9]/i.test(after);
      };
      // Scope to opening narrator. We use the first non-dialogue
      // paragraph (or the first two if the opening was split for vocab
      // distribution). After the first speaker line the worker can
      // mention the country once and call it a day.
      const isDialogue = (p: string) => /^[\p{Lu}][\p{L}\s'-]*:\s/u.test(p);
      const openingNarratorParas: string[] = [];
      for (const p of paragraphs) {
        if (isDialogue(p)) break;
        openingNarratorParas.push(p);
        if (openingNarratorParas.length >= 3) break;
      }
      const openingNorm = norm(openingNarratorParas.join(" "));
      const orphanCities: string[] = [];
      for (const { cities, countries } of CITY_COUNTRY_MAP) {
        const matchedCity = cities.find((c) => containsWord(openingNorm, c));
        if (!matchedCity) continue;
        const hasCountry = countries.some((c) => containsWord(openingNorm, c));
        if (!hasCountry) orphanCities.push(matchedCity);
      }
      if (orphanCities.length > 0) {
        const unique = [...new Set(orphanCities)];
        checks.push({
          id: "opening-city-without-country",
          label: "Opening names a LATAM city without its country",
          status: "warn",
          detail: `The opening narrator names ${unique.length === 1 ? "this city" : "these cities"} (${unique.join(", ")}) without the country. At A1, an English-native learner can't place LATAM cities geographically. Add the country in the first or second sentence: "En Coyoacán, Ciudad de México," or "Es martes en Bogotá, Colombia,".`,
        });
      }
    }

    // Spanish idiomatic / colloquial expressions in A1/A2 body. The
    // learner can't deduce the meaning from the literal sense: "X
    // manda" looks like "X sends" but means "X rules"; "está padre"
    // looks like "is father" but means "it's cool". If the worker
    // leaves these untaught, the learner gets the wrong meaning. Rule:
    // every idiomatic expression in an A1/A2 body MUST be in the vocab
    // list with type=expression OR removed. We detect a curated set
    // and warn when it appears without a matching vocab entry.
    if (
      titleLangCode === "ES" &&
      (recognizabilityLevel === "a1" || recognizabilityLevel === "a2")
    ) {
      const COLLOQUIAL_ES_PATTERNS: Array<{ re: RegExp; phrase: string; meaning: string }> = [
        // "X manda(n)" — colloquial "X rules"; matches when manda(n)
        // follows a food / object noun (not literal "send").
        {
          re: /\b(carnitas?|tacos?|tortillas?|salsa|chiles?|frijoles?|arepas?|empanadas?|cebiche|asado|mole|guacamole|tamales?)\s+manda(?:n)?\b/i,
          phrase: "X manda(n)",
          meaning: "X rules / X is the best (colloquial). Literal sense \"X sends\" misleads the learner.",
        },
        { re: /\b(está|qué)\s+padre\b/i, phrase: "está padre / qué padre", meaning: "It's cool / how cool (MX colloquial). Literal sense \"father\" misleads." },
        { re: /\b(está|qué)\s+padr[íi]sim[oa]\b/i, phrase: "padrísimo", meaning: "Super cool (MX colloquial)." },
        { re: /\bno\s+manches\b/i, phrase: "no manches", meaning: "No way / get out (MX colloquial). Literal \"don't stain\" misleads." },
        { re: /\bvale\s+madre\b/i, phrase: "vale madre", meaning: "It doesn't matter (vulgar MX). Literal \"costs mother\" misleads." },
        { re: /\ba\s+toda\s+madre\b/i, phrase: "a toda madre", meaning: "Great / awesome (MX colloquial)." },
        { re: /\bhasta\s+la\s+madre\b/i, phrase: "hasta la madre", meaning: "Fed up (MX colloquial)." },
        { re: /\b[áa]ndale\b/i, phrase: "ándale", meaning: "Come on / go on (MX colloquial interjection)." },
        { re: /\b[óo]rale\b/i, phrase: "órale", meaning: "Wow / OK (MX colloquial interjection)." },
        { re: /\b[óo]rale\s+pues\b/i, phrase: "órale pues", meaning: "All right then (MX colloquial)." },
        { re: /\becharle\s+ganas\b/i, phrase: "echarle ganas", meaning: "Give it your all (MX colloquial). Literal \"throw it desires\" misleads." },
        { re: /\bno\s+hay\s+bronca\b/i, phrase: "no hay bronca", meaning: "No problem (MX colloquial). Literal \"there's no quarrel\" misleads." },
        { re: /\bcost[oóa]?r?\s+un\s+ojo\s+de\s+la\s+cara\b/i, phrase: "costar un ojo de la cara", meaning: "To cost an arm and a leg. Literal \"cost an eye of the face\" misleads." },
        { re: /\becha?r(?:le)?\s+un\s+ojo\b/i, phrase: "echar un ojo", meaning: "To take a look (idiom). Literal \"throw an eye\" misleads." },
        { re: /\btom[áa]r(?:le)?\s+el\s+pelo\b/i, phrase: "tomar el pelo", meaning: "To tease / make fun (idiom). Literal \"take the hair\" misleads." },
        { re: /\bestar\s+en\s+las\s+nubes\b/i, phrase: "estar en las nubes", meaning: "To daydream (idiom)." },
        { re: /\bse\s+me\s+hace\s+agua\s+la\s+boca\b/i, phrase: "se me hace agua la boca", meaning: "Makes my mouth water (idiom)." },
        { re: /\bagarr[áa]r\s+la\s+onda\b/i, phrase: "agarrar la onda", meaning: "To catch on / get it (LATAM colloquial)." },
        { re: /\btener\s+buena\s+onda\b/i, phrase: "tener buena onda", meaning: "To be cool / friendly (LATAM colloquial)." },
        { re: /\bdar\s+lata\b/i, phrase: "dar lata", meaning: "To bother / be annoying (idiom). Literal \"give can\" misleads." },
        { re: /\bbárbaro\b|\bb[áa]rbaro\b/i, phrase: "bárbaro", meaning: "Great / awesome (AR colloquial). Literal \"barbarian\" misleads." },
        { re: /\bestar\s+al\s+pedo\b/i, phrase: "estar al pedo", meaning: "To be idle / doing nothing (AR vulgar)." },
        { re: /\bmandar\s+fruta\b/i, phrase: "mandar fruta", meaning: "To talk nonsense (AR colloquial)." },
      ];

      // Vocab items typed as expression that already teach an idiom.
      const taughtExpressions = new Set(
        parsed.vocab
          .filter((v) => (v.type ?? "").toLowerCase() === "expression")
          .map((v) => (v.surface ?? v.word).toLowerCase().trim())
      );

      const hitsList: string[] = [];
      for (const { re, phrase } of COLLOQUIAL_ES_PATTERNS) {
        const match = parsed.text.match(re);
        if (!match) continue;
        const matched = match[0].toLowerCase().trim();
        // If the literal matched phrase (or the phrase key) is taught
        // as an expression in vocab, skip — the worker chose to teach it.
        if (taughtExpressions.has(matched) || taughtExpressions.has(phrase.toLowerCase())) continue;
        // Also skip if any taught expression is a substring of the match.
        if ([...taughtExpressions].some((e) => matched.includes(e))) continue;
        hitsList.push(`"${match[0]}" → ${phrase}`);
      }
      if (hitsList.length > 0) {
        checks.push({
          id: "body-idiomatic-untaught",
          label: "Body uses colloquial idioms not in the vocab list",
          status: "warn",
          detail: `Found ${hitsList.length} colloquial expression(s) whose meaning the learner can't deduce from the literal sense: ${hitsList.join("; ")}. Add them to vocab as type=expression, OR rewrite with a literal equivalent.`,
        });
      }
    }
  }

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

  // Pedagogical redundancy: A0 universals that occupy a vocab slot
  // without teaching anything new. Spanish English-native A1 learners
  // know body parts, basic pronouns, numbers, primary colors, common
  // greetings from any first-50-hours course. If the vocab list
  // includes them, warn — that slot would be better spent on a
  // multi-word expression, a regional noun, or a non-obvious verb
  // construction. Scope to ES + A1 (where slot scarcity matters most).
  const A0_UNIVERSALS_ES = new Set([
    // Body parts (super basic)
    "ojo", "ojos", "mano", "manos", "pie", "pies", "cabeza", "cara",
    "boca", "nariz", "oreja", "orejas", "brazo", "brazos", "pierna",
    "piernas", "dedo", "dedos",
    // Pronouns
    "yo", "tú", "tu", "él", "ella", "nosotros", "nosotras", "ustedes",
    "ellos", "ellas",
    // Numbers 1-10
    "uno", "una", "dos", "tres", "cuatro", "cinco", "seis", "siete",
    "ocho", "nueve", "diez",
    // Primary colors (the abstract sense; bandera roja in title is OK)
    "rojo", "azul", "verde", "amarillo", "blanco", "negro",
    // Greetings / interjections
    "hola", "adiós", "adios", "gracias", "por favor",
    // Basics
    "sí", "si", "no",
  ]);
  if (lang === "ES" && (context.level ?? "").toLowerCase() === "a1") {
    const redundant = parsed.vocab.filter((v) =>
      A0_UNIVERSALS_ES.has(v.word.toLowerCase().trim())
    );
    if (redundant.length > 0) {
      checks.push({
        id: "vocab-pedagogical-redundancy",
        label: "Vocab includes A0-universal items that waste teaching slots",
        status: "warn",
        detail: `Found ${redundant.length} A0-universal item(s): ${redundant
          .map((v) => v.word)
          .join(
            ", "
          )}. English-native learners already have these from any first-50-hours course. Swap for a higher-yield item: a multi-word expression ("con prisa", "al fin", "otra vez"), a topic-specific noun (carnitas, trompo, mole), or a non-obvious verb construction (ponerse a, hacer falta).`,
      });
    }
  }

  // Minimum multi-word expressions. A vocab list of 18-22 items with
  // zero expressions is structurally lopsided — only atomic nouns get
  // taught, the learner never sees the lexicalized phrases that carry
  // everyday speech ("con prisa", "al fin", "otra vez", "que le vaya
  // bien"). Require ≥2 items typed as expression for A1/A2 ES.
  if (
    lang === "ES" &&
    ((context.level ?? "").toLowerCase() === "a1" ||
      (context.level ?? "").toLowerCase() === "a2")
  ) {
    const expressionCount = parsed.vocab.filter(
      (v) => (v.type ?? "").toLowerCase() === "expression"
    ).length;
    if (expressionCount < 2) {
      checks.push({
        id: "vocab-min-expressions",
        label: "Vocab list has too few multi-word expressions",
        status: "warn",
        detail: `Found ${expressionCount} item(s) typed as "expression"; minimum is 2. Multi-word lexicalized expressions ("con prisa", "al fin", "otra vez", "dar vuelta", "que le vaya bien", "echar un ojo") teach structures of everyday speech that single nouns can't. Replace 2-3 atomic items with expressions the body already uses.`,
      });
    }
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
    // Threshold: ANY palabra fuera de nivel = fail. El vocab array es
    // curado (18-22 items elegidos por la worker); cada item DEBE estar
    // al nivel target. No hay margen "1-2 palabras OK" — eso dejaba
    // pasar casos como "anafe" en un A1 con qa_pass. La regla es
    // estricta: cero tolerancia en vocab curado.
    const status: CheckStatus =
      aboveLevel.length === 0 ? "pass" : "fail";
    // Detail includes suggested replacements when available so the worker
    // can paste them into ChatGPT verbatim.
    const detailParts: string[] = [];
    if (aboveLevel.length > 0) {
      detailParts.push(
        `${aboveLevel.length} fuera de ${levelKey.toUpperCase()}: ${aboveLevel
          .map((a) =>
            a.replacement
              ? `${a.word} (${a.judgedLevel.toUpperCase()}) → ${a.replacement}`
              : `${a.word} (${a.judgedLevel.toUpperCase()})`,
          )
          .join(", ")}`,
      );
    }
    checks.push({
      id: "vocab-level-frequency",
      label: `Vocab matches ${levelKey.toUpperCase()} lexical frequency (ES, list+LLM)`,
      status,
      detail: detailParts.length > 0 ? detailParts.join(" ") : undefined,
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
      // Body thresholds are permissive: natural prose pulls from a wider
      // register than the curated vocab + the conjugation table will
      // never be 100% complete. Real failures (high % off-level) still
      // trip the fail bucket; minor noise becomes "warn" not "fail".
      const status: CheckStatus =
        pct < 25 ? "pass" : pct < 40 ? "warn" : "fail";
      const bodyDetail =
        aboveLevel.length > 0
          ? `${aboveLevel.length}/${contentWords.length} (${pct.toFixed(1)}%) del body fuera de ${levelKey.toUpperCase()}: ${aboveLevel
              .map((a) =>
                a.replacement
                  ? `${a.word} (${a.judgedLevel.toUpperCase()}) → ${a.replacement}`
                  : `${a.word} (${a.judgedLevel.toUpperCase()})`,
              )
              .join(", ")}`
          : `${contentWords.length} content words analizadas, todas ≤${levelKey.toUpperCase()}`;
      checks.push({
        id: "body-level-frequency",
        label: `Body register matches ${levelKey.toUpperCase()} (ES, list+LLM)`,
        status,
        detail: bodyDetail,
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

// Whitelist of LATAM places accepted as title anchors when
// variant=latam. Includes capitals, major cities, famous neighborhoods,
// recognized tourist destinations, key airports, and Brazil cities a
// Spanish-speaking traveler commonly transits through. Add curated
// entries as new approved anchors emerge; do NOT add Spanish (Iberian)
// cities here — those belong to variant=iberian once we wire it up.
const LATAM_PLACES_SET = new Set<string>([
  // Mexico
  "méxico","mexico","ciudad de méxico","ciudad de mexico","cdmx","df",
  "coyoacán","coyoacan","xochimilco","chapultepec","san ángel","san angel",
  "polanco","condesa","roma","roma norte","tlalpan","tepoztlán","tepoztlan",
  "puebla","oaxaca","mérida","merida","cancún","cancun","tulum","tijuana",
  "guadalajara","monterrey","veracruz","mazatlán","mazatlan","san cristóbal",
  "playa del carmen","san luis potosí","san luis potosi","querétaro","queretaro",
  "guanajuato","morelia","puerto vallarta","cozumel","aguascalientes",
  "jalatlaco","san josé del cabo","nativitas",
  // Argentina
  "argentina","buenos aires","palermo","san telmo","la boca","caminito",
  "recoleta","belgrano","puerto madero","once","villa crespo","mataderos",
  "almagro","barracas","caballito","núñez","nunez","mendoza","córdoba","cordoba",
  "rosario","bariloche","ushuaia","mar del plata","salta","jujuy","tucumán",
  "tucuman","aeroparque","ezeiza","paseo colón","paseo colon","parque rodó",
  "parque rodo",
  // Peru
  "perú","peru","lima","miraflores","barranco","cusco","cuzco","arequipa",
  "san isidro","surquillo","chorrillos","callao","trujillo","iquitos",
  "puno","chiclayo","piura","yanahuara","tucume","túcume","ayacucho",
  "lambayeque","jorge chávez","jorge chavez","malecón de miraflores",
  "malecon de miraflores",
  // Colombia
  "colombia","bogotá","bogota","medellín","medellin","cartagena","cali",
  "santa marta","la candelaria","candelaria","chapinero","el poblado",
  "getsemaní","getsemani","laureles","el dorado","villa de leyva",
  "barranquilla","manizales","pereira","san agustín","san agustin",
  "chorro de quevedo","parque 93",
  // Chile
  "chile","santiago","valparaíso","valparaiso","viña del mar","vina del mar",
  "providencia","lastarria","bellavista","chiloé","chiloe","atacama",
  "punta arenas","puerto montt","la serena","arica","iquique","sopocachi",
  "ascensor reina","cerro artillería","cerro artilleria","ascensor",
  // Venezuela
  "venezuela","caracas","altamira","mérida","maracaibo","valencia",
  "edificio altamira",
  // Uruguay
  "uruguay","montevideo","colonia","punta del este","carrasco",
  "tres cruces","pocitos","ciudad vieja","la rambla","rambla",
  // Ecuador
  "ecuador","quito","guayaquil","cuenca","baños","banos","salinas",
  "otavalo","cotopaxi","tungurahua",
  // Bolivia
  "bolivia","la paz","santa cruz","sucre","cochabamba","potosí","potosi",
  "oruro","sopocachi","el alto",
  // Paraguay
  "paraguay","asunción","asuncion","mercado 4","ciudad del este",
  // Central America
  "managua","tegucigalpa","san josé","san jose","panamá","panama",
  "panama city","san salvador","santo domingo","la habana","havana","cuba",
  "antigua","san pedro sula","granada","masaya","leon","león",
  "puerto limón","puerto limon","monteverde","jaco","tortuguero",
  // Dominican Republic, Puerto Rico
  "puerto plata","punta cana","puerto rico","san juan","ponce","mayagüez",
  "mayaguez",
  // Brazil (Spanish-speaker transit hubs)
  "rio","rio de janeiro","são paulo","sao paulo","galeão","galeao",
  "santos dumont","lapa","praça mauá","praca maua",
]);

// Egregious non-LATAM anchors. Stories tagged variant=latam with these
// in the title fail outright (no judgment call needed). Covers Spain
// (Iberian, not LATAM), major European/Asian/African capitals, and
// non-LATAM Spanish-speaking adjacent places.
const NON_LATAM_PLACES_SET = new Set<string>([
  // Iberian Spain
  "madrid","barcelona","sevilla","valencia","bilbao","granada","málaga",
  "malaga","zaragoza","santander","san sebastián","san sebastian","toledo",
  "córdoba", // NOTE: there's an Argentine Córdoba in LATAM whitelist; we
              // accept the false-positive risk because the much more
              // commonly-anchored Spanish Córdoba is what learners think
              // of by default.
  "salamanca","valladolid","gijón","gijon","oviedo","burgos","alicante",
  "murcia","palma","mallorca","ibiza","menorca","tenerife",
  // Italian
  "roma","trastevere","milán","milan","milano","venecia","venezia",
  "florencia","firenze","nápoles","napoles","napoli","turín","turin","torino",
  "bolonia","bologna","palermo", // NOTE: Buenos Aires Palermo collides; LATAM
                                  // whitelist wins via the order of checks.
  "génova","genova","verona",
  // Portuguese
  "lisboa","lisbon","oporto","porto","coimbra","faro",
  // German / Central European
  "berlín","berlin","múnich","munich","hamburgo","colonia",
  "frankfurt","viena","vienna","praga","prague","budapest",
  "varsovia","warsaw","amsterdam","ámsterdam","bruselas","brussels",
  // British / French / Northern
  "londres","london","mánchester","manchester","liverpool","edimburgo",
  "edinburgh","dublín","dublin","parís","paris","marsella","marseille",
  "niza","nice","lyon","burdeos","bordeaux",
  "estocolmo","stockholm","copenhague","copenhagen","oslo","helsinki",
  // Eastern Europe / Russia
  "moscú","moscow","san petersburgo","st petersburg","kiev","kyiv",
  // Asia
  "tokio","tokyo","kioto","kyoto","osaka","seul","seúl","seoul",
  "pekín","beijing","shanghái","shanghai","hong kong","singapur","singapore",
  "bangkok","mumbai","nueva delhi","delhi","bangalore",
  // Middle East / Africa
  "estambul","estanbul","istanbul","jerusalén","jerusalem","tel aviv",
  "el cairo","cairo","casablanca","marrakech","ciudad del cabo","cape town",
  // North America (non-LATAM)
  "nueva york","new york","los ángeles","los angeles","san francisco",
  "chicago","boston","filadelfia","philadelphia","miami","houston",
  "atlanta","seattle","denver","las vegas","washington","toronto",
  "montréal","montreal","vancouver","ottawa",
  // Oceania
  "sídney","sydney","melbourne","auckland","wellington",
]);

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
