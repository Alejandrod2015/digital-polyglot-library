const MAX_PREVIEW_PARAGRAPHS = 3;
const MAX_PREVIEW_CHARS = 650;

function stripHtmlPreservingParagraphs(input: string): string {
  return input
    .replace(/<\/(p|div|blockquote|li|h[1-6])>/giu, "\n\n")
    .replace(/<br\s*\/?>/giu, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\r\n?/g, "\n");
}

function normalizeParagraphs(input: string): string[] {
  return stripHtmlPreservingParagraphs(input)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function getLockedStoryPreviewHtml(text: string): string {
  const paragraphs = normalizeParagraphs(text);
  if (paragraphs.length === 0) return "";

  const selected: string[] = [];
  let usedChars = 0;

  for (const paragraph of paragraphs) {
    if (selected.length >= MAX_PREVIEW_PARAGRAPHS) break;

    const remaining = MAX_PREVIEW_CHARS - usedChars;
    if (remaining <= 0) break;

    if (paragraph.length <= remaining) {
      selected.push(paragraph);
      usedChars += paragraph.length;
      continue;
    }

    const clipped = paragraph.slice(0, remaining).replace(/\s+\S*$/, "").trim();
    if (clipped) {
      selected.push(`${clipped}…`);
    }
    break;
  }

  return selected
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join("");
}
