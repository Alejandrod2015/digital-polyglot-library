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
