// Cumulative CEFR vocabulary lookup for Spanish.
// Each level INCLUDES all lower levels (i+1 rule is the spec norm).
// "a1" or "a2" → A1+A2 only.
// "b1" → A1+A2+B1.
// "b2" → A1+A2+B1+B2.
// "c1" → A1+A2+B1+B2+C1.
// "c2" → no check (returns true for everything); near-native command,
//        vocab restrictions stop being useful.

import { SPANISH_A1_A2_LEMMAS, isSpanishA1A2 } from "./spanishA1A2";
import { SPANISH_B1_LEMMAS } from "./spanishB1";
import { SPANISH_B2_LEMMAS } from "./spanishB2";
import { SPANISH_C1_LEMMAS } from "./spanishC1";

type SpanishLevel = "a1" | "a2" | "b1" | "b2" | "c1" | "c2";

/** Combined set for each level (cached at module load). */
const setA1A2 = SPANISH_A1_A2_LEMMAS;
const setUpToB1: ReadonlySet<string> = new Set([
  ...setA1A2,
  ...SPANISH_B1_LEMMAS,
]);
const setUpToB2: ReadonlySet<string> = new Set([
  ...setUpToB1,
  ...SPANISH_B2_LEMMAS,
]);
const setUpToC1: ReadonlySet<string> = new Set([
  ...setUpToB2,
  ...SPANISH_C1_LEMMAS,
]);

function lookupInSet(word: string, set: ReadonlySet<string>): boolean {
  const lemma = word.toLowerCase().trim().replace(/^(la|el|los|las|un|una|unos|unas)\s+/, "");
  if (set.has(lemma)) return true;
  // Plural -s
  if (lemma.endsWith("s") && lemma.length > 3 && set.has(lemma.slice(0, -1))) return true;
  if (lemma.endsWith("es") && lemma.length > 4) {
    const stem = lemma.slice(0, -2);
    if (set.has(stem)) return true;
    if (set.has(stem + "z")) return true;
  }
  // Reflexivo -se
  if (lemma.endsWith("se") && lemma.length > 4) {
    const root = lemma.slice(0, -2);
    if (set.has(root + "r")) return true;
    if (set.has(root)) return true;
  }
  // Diminutivos
  for (const suf of ["ito", "ita", "illo", "illa", "cito", "cita"]) {
    if (lemma.endsWith(suf) && lemma.length > suf.length + 2) {
      const base = lemma.slice(0, -suf.length);
      if (set.has(base)) return true;
      if (set.has(base + "o")) return true;
      if (set.has(base + "a")) return true;
    }
  }
  // Femenino → masculino
  if (lemma.endsWith("a") && lemma.length > 2 && set.has(lemma.slice(0, -1) + "o")) return true;
  // Participio → infinitivo
  if (lemma.endsWith("ado") && lemma.length > 4 && set.has(lemma.slice(0, -3) + "ar")) return true;
  if (lemma.endsWith("ido") && lemma.length > 4) {
    const root = lemma.slice(0, -3);
    if (set.has(root + "er") || set.has(root + "ir")) return true;
  }
  if (lemma.endsWith("ada") && lemma.length > 4 && set.has(lemma.slice(0, -3) + "ar")) return true;
  if (lemma.endsWith("ida") && lemma.length > 4) {
    const root = lemma.slice(0, -3);
    if (set.has(root + "er") || set.has(root + "ir")) return true;
  }
  return false;
}

/**
 * Returns true if the Spanish word is "appropriate or below" for the
 * target CEFR level. Used by the validator to check vocab fits the
 * story's declared level.
 *
 * @param word    The vocab lemma (any case; normalized internally).
 * @param level   Target CEFR level for the story.
 */
export function isSpanishUpToLevel(word: string, level: SpanishLevel): boolean {
  if (level === "c2") return true; // no restriction at near-native
  if (level === "c1") return lookupInSet(word, setUpToC1);
  if (level === "b2") return lookupInSet(word, setUpToB2);
  if (level === "b1") return lookupInSet(word, setUpToB1);
  // A1 or A2: use the dedicated helper (has the same normalizations
  // but exposed standalone for legacy callers).
  return isSpanishA1A2(word);
}
