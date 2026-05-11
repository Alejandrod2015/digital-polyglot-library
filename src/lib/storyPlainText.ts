// Strip HTML/markup from a story body and normalize whitespace so the
// result can be tokenized for karaoke or fed to aeneas for forced
// alignment. Lives in its own module (no server-only deps) so the
// mobile reader can import it without dragging Prisma or Modal helpers
// into the Metro bundle.
//
// Behaviour summary:
//   - `</p><p>` and `</blockquote><blockquote>` → single newline
//     (preserves paragraph boundaries so downstream splitters can
//     recover them).
//   - `<br>` → newline.
//   - Any other tag → space.
//   - Windows line endings + literal `\n` strings → newline.
//   - Collapses runs of spaces/tabs to one space, runs of 3+ newlines
//     to a blank line.
/**
 * Find ranges of speaker labels at the start of paragraphs/lines —
 * e.g. "Tomás:", "Don Beto:", "Alma:". These are visual cues for who
 * speaks but are NOT pronounced in the narrated audio of multi-voice
 * stories. Aeneas, which aligns text↔audio assuming every token is
 * spoken, drifts when these are left in: it reserves time for "Tomás:"
 * and pushes every following word later than it should be.
 *
 * Anchored to start-of-line + 1-4 capitalized words + ": " to avoid
 * matching colons inside running prose ("le dijo: vámonos").
 */
export type SpeakerLabelRange = { start: number; end: number };
export function findSpeakerLabelRanges(plainText: string): SpeakerLabelRange[] {
  const ranges: SpeakerLabelRange[] = [];
  const regex =
    /^([A-ZÄÖÜÁÉÍÓÚÑ][A-Za-zÄÖÜäöüßÁÉÍÓÚÑáéíóúñ.'-]*(?:\s+[A-ZÄÖÜÁÉÍÓÚÑ][A-Za-zÄÖÜäöüßÁÉÍÓÚÑáéíóúñ.'-]*){0,3})(?=:\s)/gmu;
  let match: RegExpExecArray | null = regex.exec(plainText);
  while (match) {
    // Range covers `<name>:<space>` so the entire visual cue is excised
    // from the alignment text (including the colon and trailing space).
    const start = match.index;
    const end = match.index + match[1].length + 2;
    ranges.push({ start, end });
    match = regex.exec(plainText);
  }
  return ranges;
}

/**
 * Produce a copy of `plainText` with every speaker label cue
 * ("Tomás: ", "Don Beto: ") removed. Used to feed aeneas a text that
 * matches what the narrator actually says. The reader keeps the
 * original (with labels) for rendering; tokens get remapped from this
 * stripped space back to the original via `remapTokensToOriginal`.
 */
export function stripSpeakerLabels(plainText: string): {
  stripped: string;
  ranges: SpeakerLabelRange[];
} {
  const ranges = findSpeakerLabelRanges(plainText);
  if (ranges.length === 0) return { stripped: plainText, ranges };
  let cursor = 0;
  let out = "";
  for (const range of ranges) {
    out += plainText.slice(cursor, range.start);
    cursor = range.end;
  }
  out += plainText.slice(cursor);
  return { stripped: out, ranges };
}

export function extractStoryPlainText(rawText: string): string {
  const stripped = rawText
    // Cualquier transición entre bloques (párrafo o cita) se colapsa a
    // un único `\n`. Antes solo cubríamos p→p y blockquote→blockquote,
    // pero las historias del catálogo alternan narrador (`<p>`) con
    // diálogo (`<blockquote>`) y esas transiciones quedaban sin salto,
    // así que el reader renderizaba todo como un bloque monolítico.
    .replace(/<\/(?:p|blockquote)>\s*<(?:p|blockquote)\b[^>]*>/gi, "\n")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\r\n?/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return stripped;
}
