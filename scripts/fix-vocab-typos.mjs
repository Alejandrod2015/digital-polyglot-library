// Verifica y corrige typos/halucinaciones en vocab.
//
// Para cada item con word potencialmente sospechosa, busca en el texto:
//   - Si la word literal aparece → es válida, no tocar.
//   - Si una variante razonable aparece (substring del lemma, o lemma
//     + sufijo conjugación común) → reemplazar word por la que sí
//     aparece.
//   - Si nada aparece → flag como halucinación y borrar el item.
//
// Conservador: sólo dedupea y arregla typos donde tenemos certeza
// alta. No toca definiciones ni distribución.
//
// Pasa --apply para escribir cambios; sin flag = dry-run.

import { PrismaClient } from "../src/generated/prisma/index.js";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

function norm(s) {
  return (s ?? "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// Variantes conjugacionales/declensión comunes para verificar si
// una word del vocab aparece en el texto en forma flexionada.
function candidateForms(word, language) {
  const w = word.toLowerCase();
  const base = w.replace(/(?:are|ere|ire|ar|er|ir|en)$/, "");
  const forms = new Set([w, base]);
  if (language === "italian") {
    for (const suf of ["o", "a", "i", "e", "ono", "ano", "iva", "ato", "uto", "ito", "iamo", "iate", "ano", "ò"]) {
      forms.add(base + suf);
    }
  } else if (language === "spanish") {
    for (const suf of ["o", "a", "as", "an", "amos", "aron", "ó", "ando", "ado", "ido", "iendo"]) {
      forms.add(base + suf);
    }
  } else if (language === "german") {
    // German: try common verb declension + Umlaut variants
    const baseG = w.replace(/(?:en|n)$/, "");
    for (const suf of ["e", "st", "t", "en", "te", "ten", "ete", "eteten", "et"]) {
      forms.add(baseG + suf);
    }
    forms.add(w);
  }
  return forms;
}

function findInText(text, candidates, originalWord) {
  const tNorm = norm(text);
  // 1) Simple substring de cualquier candidato — captura plurales,
  //    conjugaciones, género donde el lemma es subset (tortilla en
  //    tortillas, bambino en bambini, etc.).
  for (const c of candidates) {
    const cNorm = norm(c);
    if (cNorm.length < 3) continue;
    if (tNorm.includes(cNorm)) return c;
  }
  // 2) Para multi-word expressions ("non vedere l'ora") chequea el
  //    primer token significativo.
  if (originalWord && originalWord.includes(" ")) {
    const tokens = originalWord
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length >= 4);
    for (const t of tokens) {
      if (tNorm.includes(norm(t))) return originalWord;
    }
  }
  // 3) Last-resort: prefijo de 5 chars del lemma. Captura raíces
  //    irregulares (rispondere → rispose, andare → vado/andò).
  const orig = norm(originalWord ?? "");
  if (orig.length >= 5) {
    const prefix = orig.slice(0, 5);
    if (tNorm.includes(prefix)) return originalWord;
  }
  return null;
}

async function main() {
  const stories = await prisma.journeyStory.findMany({
    where: {
      status: "published",
      text: { not: null },
      vocab: { not: null },
    },
    select: {
      id: true,
      title: true,
      text: true,
      vocab: true,
      journey: { select: { language: true } },
    },
  });

  console.log(`Checking ${stories.length} published stories...\n`);

  let totalScanned = 0;
  let totalHallucinated = 0;
  let totalDuplicates = 0;
  const changes = []; // { storyId, title, before, after, reason }

  for (const s of stories) {
    const lang = (s.journey?.language ?? "").toLowerCase();
    const vocab = Array.isArray(s.vocab) ? s.vocab : [];
    if (vocab.length === 0) continue;

    const seen = new Map(); // norm(word) → keep flag
    const cleaned = [];
    const text = s.text ?? "";

    for (const v of vocab) {
      totalScanned++;
      const word = (v.word ?? v.surface ?? "").trim();
      if (!word) continue;
      const key = norm(word);

      if (seen.has(key)) {
        totalDuplicates++;
        changes.push({
          storyId: s.id,
          title: s.title,
          before: word,
          after: "(removed dup)",
          reason: "duplicate",
        });
        continue;
      }
      seen.set(key, true);

      const cands = candidateForms(word, lang);
      const found = findInText(text, cands, word);
      if (!found) {
        totalHallucinated++;
        changes.push({
          storyId: s.id,
          title: s.title,
          before: word,
          after: "(removed)",
          reason: "not in story text (likely hallucination)",
        });
        continue;
      }

      cleaned.push(v);
    }

    if (cleaned.length !== vocab.length) {
      if (APPLY) {
        await prisma.journeyStory.update({
          where: { id: s.id },
          data: { vocab: cleaned, vocabCount: cleaned.length },
        });
      }
    }
  }

  console.log(`Vocab items scanned: ${totalScanned}`);
  console.log(`Duplicates removed: ${totalDuplicates}`);
  console.log(`Hallucinated/not-in-text removed: ${totalHallucinated}`);
  console.log(`Total changes: ${changes.length}\n`);

  // Print details per change, grouped by story
  const byStory = new Map();
  for (const c of changes) {
    if (!byStory.has(c.storyId)) byStory.set(c.storyId, { title: c.title, items: [] });
    byStory.get(c.storyId).items.push(c);
  }
  for (const [, { title, items }] of byStory) {
    console.log(`📖 ${title}`);
    for (const it of items) {
      console.log(`   - "${it.before}" → ${it.after}  (${it.reason})`);
    }
  }

  if (!APPLY) {
    console.log(`\n[DRY RUN] Pass --apply to commit changes.`);
  } else {
    console.log(`\n→ Changes written to DB.`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
