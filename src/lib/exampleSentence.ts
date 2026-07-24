/**
 * Reduce a captured reader chunk to the SINGLE sentence that contains the saved
 * word.
 *
 * WHY (2026-07-24): the mobile reader saved a favorite's `exampleSentence` as the
 * whole tapped PARAGRAPH (`onWordPress(item, paragraph.text)`), a ~3-sentence
 * rechunked block. ~45% of favorites ended up with multi-sentence chunks (and
 * legit in-story labels like a "B 247" queue number leaking in as a prefix),
 * which then drove incoherent practice exercises. This trims the chunk to the
 * one sentence that holds the word.
 *
 * CONSERVATIVE by design: the splitter is dialogue-aware (it does NOT break
 * inside quoted speech + attribution: „…!", sagte er.), and if the reduced
 * candidate looks broken (starts with stray punctuation, drops the word, or is
 * too short) the ORIGINAL text is returned unchanged — we never swap in a worse
 * value.
 */

// Split at the whitespace BETWEEN sentences: a terminator (. ! ? …) plus any
// closing quotes/brackets (incl. the German closing quote “ and »), then space,
// then the start of a NEW sentence (opening quote, ¿ ¡, uppercase, or digit).
// A comma or lowercase after the terminator means it continues (dialogue
// attribution: „…!", sagte er.) → no split.
const SENTENCE_BOUNDARY =
  /(?<=[.!?…]["'”’»“)\]]*)\s+(?=[„«"'“¿¡A-ZÄÖÜÑÀÈÉÌÒÙ0-9])/u;

// Dialogue-aware sentence splitter. Exported so exercise builders can COUNT
// sentences (is this exactly one?) without ever extracting a sub-piece.
export function splitSentences(text: string): string[] {
  return text
    .split(SENTENCE_BOUNDARY)
    .map((s) => s.trim())
    .filter(Boolean);
}

// Does the candidate look like a usable standalone sentence?
function looksClean(s: string, wordBare: string): boolean {
  if (!s) return false;
  // Must start like a sentence (letter, digit, or opening quote/¿¡), not a stray
  // comma/closing-quote left over from a bad split.
  if (!/^[„«"'“¿¡A-Za-zÀ-ÿ0-9]/.test(s)) return false;
  if (s.length < 6) return false;
  if (wordBare && !s.toLowerCase().includes(wordBare)) return false;
  return true;
}

export function extractExampleSentence(
  rawSentence: string | null | undefined,
  word: string | null | undefined,
): string | null {
  const full = typeof rawSentence === "string" ? rawSentence.trim() : "";
  if (!full) return null;
  const sentences = splitSentences(full);
  if (sentences.length <= 1) return full; // already a single sentence
  const wordBare = (word ?? "").trim().toLowerCase().replace(/^\[\[|\]\]$/g, "");
  const candidate = wordBare
    ? sentences.find((s) => s.toLowerCase().includes(wordBare))
    : sentences[0];
  // Only reduce when the candidate is clean; otherwise keep the original.
  return candidate && looksClean(candidate, wordBare) ? candidate : full;
}
