/**
 * Level test; a 10-question multiple-choice quiz that estimates the
 * user's CEFR level for a given language. Used in two places:
 *
 *   1. Onboarding step 3; after the user picks their self-reported
 *      level, we offer the test as a more accurate alternative.
 *   2. Locked-story tap; when the user taps a story above their
 *      current level, we offer the test as a way to skip ahead
 *      instead of just blocking them.
 *
 * Each question is tagged with a CEFR level (A1/A2/B1/B2). The 10
 * questions ramp up in difficulty: 2 A1 + 3 A2 + 3 B1 + 2 B2. The
 * resulting score (0–10) maps to a level via `levelFromScore`.
 *
 * This module ships hand-authored content for Spanish + German. Other
 * languages fall back to a generic placeholder set or hide the test
 * entry point until content is authored for them.
 */

export type CEFRLevel = "A1" | "A2" | "B1" | "B2" | "C1";

export type LevelTestQuestion = {
  id: string;
  /** CEFR difficulty of this question; drives the score → level
   *  mapping in `levelFromScore`. */
  level: Exclude<CEFRLevel, "C1">;
  /** Short prompt shown to the user (e.g. "Complete the sentence"
   *  or "What's the meaning of '___'?"). */
  prompt: string;
  /** The sentence with a blank or the word to translate. */
  sentence: string;
  /** Multiple-choice options. The correct one is `answer`. */
  options: [string, string, string, string];
  answer: string;
  /** Optional one-line hint shown after the user answers (correct
   *  or wrong) to give context. Keeps the test feeling like a
   *  learning experience, not just a sieve. */
  rationale?: string;
};

/**
 * 10-question test for Spanish. Mix: 2 A1, 3 A2, 3 B1, 2 B2.
 * Hand-crafted to cover common vocabulary, grammar (ser/estar,
 * tense usage, subjunctive), and idiomatic expressions at each level.
 */
const SPANISH_QUESTIONS: LevelTestQuestion[] = [
  {
    id: "es-a1-1",
    level: "A1",
    prompt: "Complete the sentence",
    sentence: "Hola, ___ Ana. ¿Y tú?",
    options: ["soy", "estoy", "es", "hay"],
    answer: "soy",
    rationale: "'Soy' (ser) for permanent identity / name.",
  },
  {
    id: "es-a1-2",
    level: "A1",
    prompt: "What's the meaning?",
    sentence: "agua",
    options: ["water", "bread", "milk", "fire"],
    answer: "water",
  },
  {
    id: "es-a2-1",
    level: "A2",
    prompt: "Complete the sentence",
    sentence: "Ayer ___ a un restaurante con mis amigos.",
    options: ["fui", "voy", "iba", "iré"],
    answer: "fui",
    rationale: "Preterite for completed past actions ('ayer' = yesterday).",
  },
  {
    id: "es-a2-2",
    level: "A2",
    prompt: "Choose the correct form",
    sentence: "Mi hermana ___ enferma hoy, no puede venir.",
    options: ["está", "es", "tiene", "hay"],
    answer: "está",
    rationale: "'Estar' for temporary states (illness today).",
  },
  {
    id: "es-a2-3",
    level: "A2",
    prompt: "What's the meaning?",
    sentence: "tener prisa",
    options: ["to be in a hurry", "to be hungry", "to be afraid", "to be cold"],
    answer: "to be in a hurry",
  },
  {
    id: "es-b1-1",
    level: "B1",
    prompt: "Complete the sentence",
    sentence: "Si tuviera tiempo, ___ contigo al cine.",
    options: ["iría", "voy", "iré", "iba"],
    answer: "iría",
    rationale: "Conditional in the result clause of an unreal 'si' clause.",
  },
  {
    id: "es-b1-2",
    level: "B1",
    prompt: "Choose the correct form",
    sentence: "Espero que ___ pronto, te echo de menos.",
    options: ["vuelvas", "vuelves", "volverás", "volviste"],
    answer: "vuelvas",
    rationale: "Subjunctive after 'espero que' (expression of desire).",
  },
  {
    id: "es-b1-3",
    level: "B1",
    prompt: "What's the meaning?",
    sentence: "echar de menos",
    options: ["to miss someone", "to throw out", "to need less", "to underestimate"],
    answer: "to miss someone",
  },
  {
    id: "es-b2-1",
    level: "B2",
    prompt: "Complete the sentence",
    sentence: "Por más que ___, no conseguí convencerlo.",
    options: ["intenté", "intentaba", "intente", "intentara"],
    answer: "intenté",
    rationale: "Indicative preterite; the action actually happened.",
  },
  {
    id: "es-b2-2",
    level: "B2",
    prompt: "Choose the correct form",
    sentence: "De haberlo sabido, ___ actuado de otra manera.",
    options: ["habría", "habrá", "haría", "hubiese"],
    answer: "habría",
    rationale: "Conditional perfect in the result of a past unreal condition.",
  },
];

/**
 * 10-question test for German. Mix: 2 A1, 3 A2, 3 B1, 2 B2.
 * Covers articles, cases (Akkusativ/Dativ), modal verbs, separable
 * verbs, subjunctive (Konjunktiv II), and Wechselpräpositionen.
 */
const GERMAN_QUESTIONS: LevelTestQuestion[] = [
  {
    id: "de-a1-1",
    level: "A1",
    prompt: "Complete the sentence",
    sentence: "Ich ___ Anna. Wie heißt du?",
    options: ["heiße", "heißt", "heißen", "hieß"],
    answer: "heiße",
    rationale: "First-person singular of 'heißen'.",
  },
  {
    id: "de-a1-2",
    level: "A1",
    prompt: "What's the meaning?",
    sentence: "Brot",
    options: ["bread", "water", "house", "book"],
    answer: "bread",
  },
  {
    id: "de-a2-1",
    level: "A2",
    prompt: "Complete the sentence",
    sentence: "Gestern ___ ich ins Kino gegangen.",
    options: ["bin", "habe", "war", "hatte"],
    answer: "bin",
    rationale: "'Gehen' takes 'sein' as auxiliary in Perfekt.",
  },
  {
    id: "de-a2-2",
    level: "A2",
    prompt: "Choose the correct article",
    sentence: "Ich gebe ___ Mann das Buch.",
    options: ["dem", "den", "der", "das"],
    answer: "dem",
    rationale: "Dative for indirect object; 'dem Mann' (to the man).",
  },
  {
    id: "de-a2-3",
    level: "A2",
    prompt: "What's the meaning?",
    sentence: "es tut mir leid",
    options: ["I'm sorry", "I'm hungry", "I'm tired", "I'm sure"],
    answer: "I'm sorry",
  },
  {
    id: "de-b1-1",
    level: "B1",
    prompt: "Complete the sentence",
    sentence: "Wenn ich Zeit ___, würde ich mehr lesen.",
    options: ["hätte", "habe", "hatte", "haben"],
    answer: "hätte",
    rationale: "Konjunktiv II for hypothetical conditions.",
  },
  {
    id: "de-b1-2",
    level: "B1",
    prompt: "Choose the correct preposition",
    sentence: "Das Buch liegt ___ dem Tisch.",
    options: ["auf", "an", "in", "bei"],
    answer: "auf",
    rationale: "'Auf' + Dativ for resting on top of a flat surface.",
  },
  {
    id: "de-b1-3",
    level: "B1",
    prompt: "What's the meaning?",
    sentence: "sich auf etwas freuen",
    options: ["to look forward to something", "to be free", "to forget", "to give up"],
    answer: "to look forward to something",
  },
  {
    id: "de-b2-1",
    level: "B2",
    prompt: "Complete the sentence",
    sentence: "Er behauptet, er ___ den Schlüssel verloren.",
    options: ["habe", "hat", "hätte", "haben"],
    answer: "habe",
    rationale: "Konjunktiv I for indirect speech (formal report).",
  },
  {
    id: "de-b2-2",
    level: "B2",
    prompt: "Choose the correct form",
    sentence: "Anstatt zu Hause zu bleiben, ___ wir spazieren.",
    options: ["gingen", "ging", "gehen", "gegangen"],
    answer: "gingen",
    rationale: "Past tense plural of 'gehen' for narrative past.",
  },
];

/**
 * 10-question test for Italian. Mix: 2 A1, 3 A2, 3 B1, 2 B2.
 * Covers articles + agreement, passato prossimo, congiuntivo,
 * pronouns, and common idiomatic expressions.
 */
const ITALIAN_QUESTIONS: LevelTestQuestion[] = [
  {
    id: "it-a1-1",
    level: "A1",
    prompt: "Complete the sentence",
    sentence: "Ciao, ___ Marco. E tu?",
    options: ["sono", "sei", "è", "ho"],
    answer: "sono",
    rationale: "First-person singular of 'essere' to introduce yourself.",
  },
  {
    id: "it-a1-2",
    level: "A1",
    prompt: "What's the meaning?",
    sentence: "acqua",
    options: ["water", "bread", "milk", "wine"],
    answer: "water",
  },
  {
    id: "it-a2-1",
    level: "A2",
    prompt: "Complete the sentence",
    sentence: "Ieri ___ andato al cinema con Luca.",
    options: ["sono", "ho", "ero", "sarò"],
    answer: "sono",
    rationale: "'Andare' takes 'essere' as auxiliary in passato prossimo.",
  },
  {
    id: "it-a2-2",
    level: "A2",
    prompt: "Choose the correct article",
    sentence: "Mi piace ___ pizza italiana.",
    options: ["la", "il", "lo", "una"],
    answer: "la",
    rationale: "Definite article for feminine singular nouns ('pizza').",
  },
  {
    id: "it-a2-3",
    level: "A2",
    prompt: "What's the meaning?",
    sentence: "avere fretta",
    options: ["to be in a hurry", "to be hungry", "to be afraid", "to be cold"],
    answer: "to be in a hurry",
  },
  {
    id: "it-b1-1",
    level: "B1",
    prompt: "Complete the sentence",
    sentence: "Se avessi tempo, ___ con te al concerto.",
    options: ["verrei", "vengo", "verrò", "venivo"],
    answer: "verrei",
    rationale: "Conditional in the result of an unreal 'se' clause.",
  },
  {
    id: "it-b1-2",
    level: "B1",
    prompt: "Choose the correct form",
    sentence: "Spero che tu ___ presto, mi manchi.",
    options: ["torni", "torna", "tornerai", "tornavi"],
    answer: "torni",
    rationale: "Subjunctive after 'spero che' (expression of hope).",
  },
  {
    id: "it-b1-3",
    level: "B1",
    prompt: "What's the meaning?",
    sentence: "mi manchi",
    options: ["I miss you", "I see you", "you owe me", "you're missing"],
    answer: "I miss you",
  },
  {
    id: "it-b2-1",
    level: "B2",
    prompt: "Complete the sentence",
    sentence: "Per quanto ___ provato, non sono riuscito a convincerlo.",
    options: ["abbia", "ho", "avrei", "avessi"],
    answer: "abbia",
    rationale: "Subjunctive after 'per quanto' (concessive clause).",
  },
  {
    id: "it-b2-2",
    level: "B2",
    prompt: "Choose the correct form",
    sentence: "Se l'avessi saputo, ___ agito diversamente.",
    options: ["avrei", "avrò", "avevo", "abbia"],
    answer: "avrei",
    rationale: "Conditional perfect in the result of a past unreal condition.",
  },
];

/**
 * Map a 10-question score to the highest level the user can
 * comfortably access. The mapping is intentionally conservative -
 * a perfect score lands the user at C1, but missing one B2
 * question still places them at B2 (we don't want to gate users
 * out of content they're nearly at).
 */
export function levelFromScore(correct: number): CEFRLevel {
  if (correct >= 10) return "C1";
  if (correct >= 8) return "B2";
  if (correct >= 6) return "B1";
  if (correct >= 3) return "A2";
  return "A1";
}

/**
 * Resolve the question set for a (language, variant) pair. Returns
 * null when we don't have content authored yet; callers should
 * gracefully hide the test entry point in that case.
 *
 * Variant currently doesn't affect the question set: a Mexican-
 * Spanish learner and a Castilian-Spanish learner answer the same
 * grammar. Future iterations may diverge per variant if regional
 * vocabulary/grammar matters.
 */
export function getLevelTestQuestions(
  language: string,
  _variant?: string | null
): LevelTestQuestion[] | null {
  if (language === "Spanish") return SPANISH_QUESTIONS;
  if (language === "German") return GERMAN_QUESTIONS;
  if (language === "Italian") return ITALIAN_QUESTIONS;
  return null;
}

/**
 * Whether a level test is available for this language. Cheap shortcut
 * for UI gating ("Take a level test" button visibility).
 */
export function hasLevelTest(language: string | null | undefined): boolean {
  if (!language) return false;
  return getLevelTestQuestions(language) !== null;
}

/**
 * Map our coarse legacy `preferredLevel` ("Beginner" / "Intermediate"
 * / "Advanced") to a CEFR level so we can compare against the test
 * result and decide whether to offer the test in the first place.
 */
export function cefrFromLegacyLevel(
  preferredLevel: string | null | undefined
): CEFRLevel | null {
  if (!preferredLevel) return null;
  const key = preferredLevel.trim().toLowerCase();
  if (key === "beginner") return "A1";
  if (key === "intermediate") return "B1";
  if (key === "advanced") return "C1";
  return null;
}

/**
 * Order CEFR levels for comparison: A1 < A2 < B1 < B2 < C1. Used by
 * the locked-story modal to decide whether the story is "above" the
 * user's current level.
 */
const LEVEL_ORDER: Record<CEFRLevel, number> = {
  A1: 0,
  A2: 1,
  B1: 2,
  B2: 3,
  C1: 4,
};

export function compareLevels(a: CEFRLevel, b: CEFRLevel): number {
  return LEVEL_ORDER[a] - LEVEL_ORDER[b];
}
