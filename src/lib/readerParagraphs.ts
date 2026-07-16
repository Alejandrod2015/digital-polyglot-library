/**
 * readerParagraphs — how NARRATED prose actually reaches the screen.
 *
 * The reader does NOT honour authored `\n\n`: splitSentences() flattens every
 * newline to a space and StoryContent re-groups the text into paragraphs of N
 * sentences. Only multi-voice "Speaker: line" stories keep authored blocks
 * (one paragraph per turn, via detectDialogueBlocks).
 *
 * This lives in lib, not inside the component, because the story gate needs to
 * measure vocab distribution over the blocks the READER renders, not over the
 * paragraphs the author typed. Those two drifted apart and it shipped a story
 * with 5 pills stacked in one on-screen paragraph while the gate reported
 * "max 3 per paragraph" (2026-07-09). Single source of truth: if the chunking
 * changes here, the gate follows automatically.
 */

/** Default used by the reader (StoryContent's `sentencesPerParagraph`). */
export const READER_SENTENCES_PER_PARAGRAPH = 3;

export function splitSentences(raw: string): string[] {
  const text = raw.replace(/\s*\n+\s*/g, " ").trim();
  if (!text) return [];
  const parts = text.split(/(?<=[.!?…‽⁇⁉]["»”’]?)(?:\s+|$)/u);
  const clean = parts
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .filter((s) => /[\p{L}\p{N}]/u.test(s));

  // A fragment starting lowercase is a continuation (e.g. the tail of a quote:
  // `"No manches", le soltó`), not a new sentence.
  const merged: string[] = [];
  for (const segment of clean) {
    const shouldAttachToPrev =
      merged.length > 0 && /^[\s,"'“”„«»)\]]*[\p{Ll}]/u.test(segment);
    if (shouldAttachToPrev) {
      merged[merged.length - 1] = `${merged[merged.length - 1]} ${segment}`;
      continue;
    }
    merged.push(segment);
  }
  return merged;
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * The paragraphs a narrated story is actually rendered as. Mirrors
 * StoryContent's `paragraphs` memo for the non-dialogue, non-HTML path.
 */
export function renderedParagraphs(
  text: string,
  sentencesPerParagraph: number = READER_SENTENCES_PER_PARAGRAPH
): string[] {
  const size = Math.max(1, Math.min(6, sentencesPerParagraph));
  return chunk(splitSentences(text), size).map((p) => p.join(" "));
}
