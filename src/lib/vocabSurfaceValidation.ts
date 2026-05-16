/**
 * Guarantee that every vocab item's `surface` (or `word`) appears as a
 * literal `\b...\b` token in the story text. Without this gate the
 * practice-audio precision system (computePracticeAudioRanges) can't
 * resolve a deterministic range and the exercise falls back to HQ TTS,
 * which (a) costs ElevenLabs credits and (b) sounds in a different voice
 * than the narration.
 *
 * Returns the list of mismatches with a heuristic suggestion based on
 * shared prefix with words actually present in the text.
 */

export type VocabSurfaceIssue = {
  word: string;
  declaredSurface: string;
  suggestion: string | null;
  candidates: string[];
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFC")
    .trim();
}

function tokenize(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .split(/[^\p{L}\p{M}'\-]+/u)
        .map((t) => t.trim())
        .filter((t) => t.length >= 2),
    ),
  );
}

function sharedPrefix(a: string, b: string): number {
  const len = Math.min(a.length, b.length);
  let i = 0;
  while (i < len && a[i] === b[i]) i += 1;
  return i;
}

export function findCandidates(
  declared: string,
  storyText: string,
): { suggestion: string | null; candidates: string[]; confidence: "high" | "low" } {
  const target = normalize(declared);
  if (!target) return { suggestion: null, candidates: [], confidence: "low" };
  const tokens = tokenize(storyText);
  const minPrefix = Math.min(3, Math.max(2, Math.floor(target.length / 3)));
  const ranked = tokens
    .map((t) => ({ t, score: sharedPrefix(target, t) }))
    .filter((r) => r.score >= minPrefix)
    .sort((a, b) => b.score - a.score || a.t.length - b.t.length)
    .slice(0, 5);
  if (ranked.length === 0) return { suggestion: null, candidates: [], confidence: "low" };
  // High confidence when the top candidate shares at least 60% of the
  // declared word's letters as a prefix. This catches conjugations
  // (compra/comprare, turista/turisti, sorride/sorriso) and rejects
  // accidental neighbors (sentì for serata).
  const top = ranked[0];
  const highConfidence = top.score / target.length >= 0.6;
  return {
    suggestion: top.t,
    candidates: ranked.map((r) => r.t),
    confidence: highConfidence ? "high" : "low",
  };
}

/**
 * Unicode-aware word match: surrounds the declared form with Unicode
 * letter/mark lookarounds (NOT the JS `\b` which only sees ASCII word
 * chars and breaks on accented characters like città, ragù, übermalt).
 */
function makeUnicodeWordRegex(declared: string): RegExp {
  const escaped = declared.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\p{L}\\p{M}])${escaped}(?![\\p{L}\\p{M}])`, "iu");
}

export function validateVocabAgainstText(
  vocab: Array<{ word: string; surface?: string | null }>,
  storyText: string,
): { ok: true } | { ok: false; issues: VocabSurfaceIssue[] } {
  const issues: VocabSurfaceIssue[] = [];
  for (const item of vocab) {
    const declared = (item.surface && item.surface.trim()) || item.word;
    const target = normalize(declared);
    if (!target) continue;
    const pattern = makeUnicodeWordRegex(target);
    if (pattern.test(storyText)) continue;
    const { suggestion, candidates } = findCandidates(declared, storyText);
    issues.push({
      word: item.word,
      declaredSurface: declared,
      suggestion,
      candidates,
    });
  }
  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}
