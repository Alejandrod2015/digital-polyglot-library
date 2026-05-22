// Audit del vocab en libros publicados del catálogo
// (src/data/books/*.ts). Sample de 10 historias random.
//
// Cada vocab item es {word, definition}. El texto usa
// <span class="vocab-word" data-word="X">X</span> para anclar.
//
// Chequea:
//   - duplicates por word
//   - missing definition
//   - definition too long
//   - word NOT tagged in text con data-word ni aparece en body
//   - data-word="X" en text PERO X no está en vocab array (vocab tagged
//     pero sin definition = roto al hacer click)
//   - word case mismatch entre vocab y data-word
//   - definitions vacías o demasiado cortas (<4 palabras)

import { readdirSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BOOKS_DIR = resolve(__dirname, "../src/data/books");

// Carga los TS como texto y extrae el objeto exportado con un eval-safe
// approach: leemos el archivo y usamos un regex para extraer story por
// story. Más seguro que dynamic-import-TS.
function loadBooks() {
  const files = readdirSync(BOOKS_DIR).filter(
    (f) => f.endsWith(".ts") && f !== "index.ts"
  );
  const books = [];
  for (const f of files) {
    const raw = readFileSync(resolve(BOOKS_DIR, f), "utf8");
    // Strip the TS-only bits to make it JS-parseable
    const cleaned = raw
      .replace(/^import .*$/gm, "")
      .replace(/^export\s+const\s+\w+\s*:\s*Book\s*=\s*/m, "module.exports = ")
      .replace(/^export\s+const\s+\w+\s*=\s*/m, "module.exports = ");
    // Use Function constructor sandbox
    try {
      const exports = {};
      const module = { exports };
      const fn = new Function("module", "exports", cleaned);
      fn(module, exports);
      const book = module.exports;
      if (book?.stories?.length) books.push({ file: f, book });
    } catch (e) {
      console.warn(`Failed to parse ${f}: ${e.message}`);
    }
  }
  return books;
}

function pickRandom(arr, n) {
  return arr.slice().sort(() => Math.random() - 0.5).slice(0, n);
}

function norm(s) {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, " ");
}

function extractDataWords(html) {
  const tags = [...html.matchAll(/data-word="([^"]+)"/gi)].map((m) => m[1]);
  return tags;
}

async function main() {
  const all = loadBooks();
  console.log(`Loaded ${all.length} books.\n`);

  // Flat list de stories con book attached
  const allStories = [];
  for (const { book } of all) {
    for (const story of book.stories ?? []) {
      allStories.push({
        bookTitle: book.title,
        bookSlug: book.slug,
        ...story,
      });
    }
  }
  console.log(`Total stories across catalog: ${allStories.length}\n`);

  const sample = pickRandom(allStories, 10);

  const summary = [];
  for (const s of sample) {
    const vocab = Array.isArray(s.vocab) ? s.vocab : [];
    const text = s.text ?? "";
    const taggedWords = extractDataWords(text); // strings inside data-word="..."
    const plainText = norm(stripHtml(text));

    const flags = [];
    const itemFlags = [];

    // ── 1. Duplicates ──
    const seen = new Set();
    let duplicates = 0;
    for (const v of vocab) {
      const k = norm(v.word ?? "");
      if (!k) continue;
      if (seen.has(k)) duplicates += 1;
      seen.add(k);
    }
    if (duplicates) flags.push(`${duplicates} dup`);

    // ── 2. Missing/short/long definitions ──
    let missingDef = 0;
    let shortDef = 0;
    let longDef = 0;
    for (const v of vocab) {
      const def = (v.definition ?? "").trim();
      if (!def) missingDef += 1;
      else {
        const wc = def.split(/\s+/).length;
        if (wc < 4) shortDef += 1;
        else if (wc > 22) longDef += 1;
      }
    }
    if (missingDef) flags.push(`${missingDef} missing-def`);
    if (shortDef) flags.push(`${shortDef} short-def`);
    if (longDef) flags.push(`${longDef} long-def`);

    // ── 3. Vocab word NOT in text (no data-word AND not in plain text) ──
    let notInText = 0;
    const notInTextWords = [];
    const taggedNormSet = new Set(taggedWords.map(norm));
    for (const v of vocab) {
      const word = (v.word ?? "").trim();
      if (!word) continue;
      const wNorm = norm(word);
      const tagged = taggedNormSet.has(wNorm);
      const inPlain = plainText.includes(wNorm);
      if (!tagged && !inPlain) {
        notInText += 1;
        notInTextWords.push(word);
      }
    }
    if (notInText) {
      flags.push(`${notInText} not-in-text`);
      itemFlags.push(`not in text: ${notInTextWords.slice(0, 5).join(", ")}`);
    }

    // ── 4. Tagged in text but NOT in vocab array ──
    const vocabNormSet = new Set(vocab.map((v) => norm(v.word)));
    const orphanTags = taggedWords.filter((w) => !vocabNormSet.has(norm(w)));
    if (orphanTags.length) {
      flags.push(`${orphanTags.length} orphan-tag`);
      itemFlags.push(`tagged but missing from vocab: ${orphanTags.slice(0, 5).join(", ")}`);
    }

    // ── 5. Vocab in array but never tagged in text (only plain) ──
    let notTagged = 0;
    const notTaggedWords = [];
    for (const v of vocab) {
      const w = (v.word ?? "").trim();
      if (!w) continue;
      if (!taggedNormSet.has(norm(w)) && plainText.includes(norm(w))) {
        notTagged += 1;
        notTaggedWords.push(w);
      }
    }
    if (notTagged) {
      flags.push(`${notTagged} not-tagged`);
      itemFlags.push(`in text but no data-word span: ${notTaggedWords.slice(0, 5).join(", ")}`);
    }

    // ── 6. Word count ──
    if (vocab.length === 0) flags.push("0 vocab");
    else if (vocab.length < 5) flags.push(`only ${vocab.length} items`);
    else if (vocab.length > 25) flags.push(`${vocab.length} items (a lot)`);

    summary.push({
      story: `${s.title}`,
      book: s.bookTitle,
      vocab: vocab.length,
      tagged: taggedWords.length,
      flags,
    });

    console.log("─".repeat(72));
    console.log(`📖 "${s.title}"  [${s.bookTitle}]`);
    console.log(`   vocab=${vocab.length}  tagged-in-text=${taggedWords.length}`);
    if (flags.length === 0) {
      console.log(`   ✓  no issues`);
    } else {
      console.log(`   ⚠  ${flags.join(" · ")}`);
    }
    for (const f of itemFlags) console.log(`      - ${f}`);
    // sample first 3 vocab
    for (const v of vocab.slice(0, 3)) {
      const def = (v.definition ?? "").slice(0, 80);
      console.log(`      • ${v.word}: ${def}`);
    }
  }

  console.log("\n" + "═".repeat(72));
  console.log("SUMMARY");
  console.log("═".repeat(72));
  for (const r of summary) {
    const flagStr = r.flags.length ? `⚠ ${r.flags.join(", ")}` : "✓ clean";
    console.log(`  ${r.story.padEnd(35).slice(0, 35)}  ${String(r.vocab).padStart(2)}w  ${flagStr}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
