// Apply vocab additions from a JSON patch file to a catalog book.
//
// Patch format: { storySlug: [{ word, definition, type }, ...] }
//
// Per item:
//   - Append to vocab[] array if word not already present (case-insensitive)
//   - Inject <span class="vocab-word" data-word="X">X</span> on first
//     occurrence in story text, outside existing tags. If the word
//     doesn't appear in plain text → skip silently (logged).
//
// Usage:
//   node scripts/apply-vocab-additions.mjs <book-file> <patch-file> [--apply]
//
// Sin --apply = dry-run.

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const positional = args.filter((a) => !a.startsWith("--"));
if (positional.length < 2) {
  console.error("Usage: node apply-vocab-additions.mjs <book-file> <patch-file> [--apply]");
  process.exit(1);
}
const [bookPath, patchPath] = positional.map((p) => resolve(p));

function loadBook(path) {
  const raw = readFileSync(path, "utf8");
  const cleaned = raw
    .replace(/^import .*$/gm, "")
    .replace(/^export\s+const\s+\w+\s*:\s*Book\s*=\s*/m, "module.exports = ");
  const exports = {};
  const module = { exports };
  new Function("module", "exports", cleaned)(module, exports);
  return { book: module.exports, exportName: extractExportName(raw) };
}
function extractExportName(raw) {
  const m = raw.match(/^export\s+const\s+(\w+)\s*:\s*Book/m);
  return m?.[1] ?? "book";
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function injectFirstSpan(text, word) {
  const existsRe = new RegExp(`data-word="${escapeRegex(word)}"`, "i");
  if (existsRe.test(text)) return { text, injected: true };

  let result = "";
  let i = 0;
  let inTag = false;
  let inserted = false;
  const wordRe = new RegExp(
    `(^|[^\\p{L}\\p{N}_])(${escapeRegex(word)})(?=$|[^\\p{L}\\p{N}_])`,
    "iu"
  );
  while (i < text.length) {
    if (!inTag && text[i] === "<") {
      inTag = true;
      result += text[i++];
      continue;
    }
    if (inTag && text[i] === ">") {
      inTag = false;
      result += text[i++];
      continue;
    }
    if (inTag || inserted) {
      result += text[i++];
      continue;
    }
    const slice = text.slice(i);
    const m = slice.match(wordRe);
    if (m && m.index === 0) {
      result +=
        m[1] +
        `<span class="vocab-word" data-word="${word}">${m[2]}</span>`;
      i += m[1].length + m[2].length;
      inserted = true;
    } else {
      result += text[i++];
    }
  }
  return { text: result, injected: inserted };
}

const { book, exportName } = loadBook(bookPath);
const patch = JSON.parse(readFileSync(patchPath, "utf8"));

let totalAdded = 0;
let totalInjected = 0;
let totalSkipped = 0;
const skipped = [];

for (const story of book.stories ?? []) {
  const additions = patch[story.slug];
  if (!additions || additions.length === 0) continue;

  const existing = new Set(
    (story.vocab ?? []).map((v) => (v.word ?? "").toLowerCase())
  );
  let storyAdded = 0;
  let storyInjected = 0;
  let text = story.text ?? "";

  for (const item of additions) {
    const word = (item.word ?? "").trim();
    if (!word) continue;
    if (existing.has(word.toLowerCase())) {
      skipped.push({ story: story.slug, word, reason: "dup" });
      totalSkipped += 1;
      continue;
    }
    // Verify the word actually appears in text (root substring).
    const wordLc = word.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const root = wordLc
      .replace(/(?:are|ere|ire|ar|er|ir|arse|erse|irse)$/, "")
      .slice(0, Math.max(4, wordLc.length - 4));
    const textLc = text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const inText =
      textLc.includes(wordLc) || (root.length >= 4 && textLc.includes(root));
    if (!inText) {
      skipped.push({ story: story.slug, word, reason: "not-in-text" });
      totalSkipped += 1;
      continue;
    }
    // Inject span
    const { text: newText, injected } = injectFirstSpan(text, word);
    if (injected) {
      text = newText;
      storyInjected += 1;
      totalInjected += 1;
    }
    // Append to vocab
    story.vocab.push({
      word,
      definition: item.definition,
      ...(item.type ? { type: item.type } : {}),
    });
    existing.add(word.toLowerCase());
    storyAdded += 1;
    totalAdded += 1;
  }
  story.text = text;
  console.log(
    `📖 ${story.title.padEnd(45).slice(0, 45)}  +${storyAdded} vocab  (${storyInjected} spans)`
  );
}

console.log(`\nTotal added: ${totalAdded}  spans injected: ${totalInjected}  skipped: ${totalSkipped}`);
if (skipped.length) {
  console.log("\nSkipped:");
  for (const s of skipped) {
    console.log(`  ${s.story}  ${s.word}  (${s.reason})`);
  }
}

if (!APPLY) {
  console.log("\n[DRY RUN] Pass --apply to write.");
  process.exit(0);
}

const out = `import { Book } from "@/types/books";\n\nexport const ${exportName}: Book = ${JSON.stringify(book, null, 2)};\n`;
writeFileSync(bookPath, out);
console.log(`\n→ ${bookPath} rewritten.`);
