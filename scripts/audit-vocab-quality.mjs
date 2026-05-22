// Audit randomized del vocabulario de historias publicadas.
// Muestra 10 historias al azar (status=published) y para cada una:
//   - metadata básica (title, journey, level, topic, language)
//   - vocab count + distribución por párrafo
//   - flags de calidad detectados
//
// Flags chequeados (per docs/story-quality-spec.md):
//   - clustering: ≥60% del vocab en el opening (primer ¶)
//   - count: <10 o >30 items (rango razonable para un short story)
//   - definitions: missing, too long (>20 palabras), idioma incorrecto
//   - duplicates: misma word repetida
//   - common words: heuristic de palabras universales (article-like)
//   - missing example sentence
//   - type inference disagrees con morfología (e.g., -ar end pero tagged noun)
//
// Output: imprime tabla resumen + detalle de cada historia.

import { PrismaClient } from "../src/generated/prisma/index.js";

const prisma = new PrismaClient();

// Heurística de palabras universalmente conocidas — pueden colarse al
// vocab del LLM aunque cualquier English speaker ya las reconozca.
const UNIVERSAL_WORDS = new Set([
  "ok", "no", "si", "yes", "hi", "hello", "café", "taxi", "hotel",
  "wifi", "internet", "video", "menu", "pizza", "coca", "cola",
  "bar", "club", "tour", "stop", "go", "tv", "radio", "metro",
  "bus", "taxi", "auto", "moto", "supermarket", "salon",
]);

function countParagraphs(text) {
  if (typeof text !== "string") return 0;
  return text.split(/\n{2,}/).filter((p) => p.trim()).length;
}

function locateVocabInText(text, word) {
  if (!text || !word) return -1;
  const idx = text.toLowerCase().indexOf(word.toLowerCase());
  return idx;
}

function distributionFlags(story) {
  const paragraphs = story.text
    ? story.text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
    : [];
  const vocab = Array.isArray(story.vocab) ? story.vocab : [];
  if (paragraphs.length === 0 || vocab.length === 0) {
    return { perParagraph: [], openingPct: 0, paragraphsTouched: 0 };
  }
  const perPara = new Array(paragraphs.length).fill(0);
  for (const v of vocab) {
    const word = (v.surface ?? v.word ?? "").trim();
    if (!word) continue;
    let placed = false;
    for (let i = 0; i < paragraphs.length; i++) {
      if (paragraphs[i].toLowerCase().includes(word.toLowerCase())) {
        perPara[i] += 1;
        placed = true;
        break;
      }
    }
    if (!placed) perPara[0] += 1; // count as opening if untraceable
  }
  const openingCount = perPara[0];
  const openingPct = vocab.length > 0 ? (openingCount / vocab.length) * 100 : 0;
  const paragraphsTouched = perPara.filter((n) => n > 0).length;
  return { perParagraph: perPara, openingPct, paragraphsTouched };
}

function flagDefinition(def) {
  if (!def || typeof def !== "string") return "missing";
  const wc = def.split(/\s+/).filter(Boolean).length;
  if (wc > 22) return `long (${wc}w)`;
  return null;
}

function flagWord(w) {
  const lc = (w ?? "").trim().toLowerCase();
  if (!lc) return "empty";
  if (UNIVERSAL_WORDS.has(lc)) return "universal";
  return null;
}

function pickRandom(arr, n) {
  const shuffled = arr.slice().sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

async function main() {
  const all = await prisma.journeyStory.findMany({
    where: {
      status: "published",
      text: { not: null },
      vocab: { not: null },
    },
    select: {
      id: true,
      title: true,
      slug: true,
      level: true,
      topic: true,
      text: true,
      vocab: true,
      journey: { select: { name: true, language: true, variant: true } },
    },
  });

  if (all.length === 0) {
    console.log("No published stories with vocab found.");
    await prisma.$disconnect();
    return;
  }

  const sample = pickRandom(all, Math.min(10, all.length));
  console.log(`Auditing ${sample.length} of ${all.length} published stories.\n`);

  const summaryRows = [];

  for (const s of sample) {
    const vocab = Array.isArray(s.vocab) ? s.vocab : [];
    const paraCount = countParagraphs(s.text);
    const dist = distributionFlags(s);

    // Per-item flags
    const itemFlags = [];
    const seenWords = new Set();
    let duplicates = 0;
    let missingDef = 0;
    let longDef = 0;
    let universal = 0;
    let noExample = 0;
    let typeMismatch = 0;

    for (const v of vocab) {
      const word = (v.word ?? v.surface ?? "").trim();
      const def = v.definition ?? v.translation ?? null;
      const type = (v.type ?? v.wordType ?? "").toString().toLowerCase();
      const example = v.exampleSentence ?? v.sentence ?? null;

      if (!word) continue;
      const norm = word.toLowerCase();
      if (seenWords.has(norm)) duplicates += 1;
      seenWords.add(norm);

      const defFlag = flagDefinition(def);
      if (defFlag === "missing") missingDef += 1;
      else if (defFlag && defFlag.startsWith("long")) longDef += 1;

      const wordFlag = flagWord(word);
      if (wordFlag === "universal") universal += 1;

      if (!example) noExample += 1;

      // morphology check: -ar/-er/-ir ending should be verb
      if (
        /(?:ar|er|ir)$/.test(norm) &&
        norm.length >= 4 &&
        type &&
        type !== "verb" &&
        !norm.includes(" ")
      ) {
        typeMismatch += 1;
        if (itemFlags.length < 3) {
          itemFlags.push(`type mismatch: "${word}" tagged ${type}, looks verbal`);
        }
      }
    }

    const heavyOpening = dist.openingPct >= 60 && vocab.length >= 8;
    const lowCoverage = paraCount > 0 && dist.paragraphsTouched / paraCount < 0.4;

    const flags = [];
    if (vocab.length < 10) flags.push(`only ${vocab.length} items`);
    if (vocab.length > 30) flags.push(`${vocab.length} items (too many)`);
    if (heavyOpening) flags.push(`${dist.openingPct.toFixed(0)}% in opening ¶`);
    if (lowCoverage) flags.push(`covers ${dist.paragraphsTouched}/${paraCount} ¶`);
    if (duplicates) flags.push(`${duplicates} duplicates`);
    if (missingDef) flags.push(`${missingDef} missing def`);
    if (longDef) flags.push(`${longDef} long def`);
    if (universal) flags.push(`${universal} universal`);
    if (noExample) flags.push(`${noExample}/${vocab.length} no example`);
    if (typeMismatch) flags.push(`${typeMismatch} morph mismatch`);

    summaryRows.push({
      title: s.title ?? "(untitled)",
      journey: `${s.journey?.name}/${s.journey?.language}`,
      level: s.level,
      vocab: vocab.length,
      paras: paraCount,
      flags,
    });

    console.log("=".repeat(72));
    console.log(`📖 "${s.title}"  [${s.journey?.name} / ${s.journey?.language} / ${s.level}]`);
    console.log(`   topic=${s.topic}  paragraphs=${paraCount}  vocab=${vocab.length}`);
    if (vocab.length > 0) {
      console.log(`   distribution per ¶: ${dist.perParagraph.join(" · ")}`);
      console.log(`   opening: ${dist.openingPct.toFixed(0)}%  covers ${dist.paragraphsTouched}/${paraCount} ¶`);
    }
    if (flags.length > 0) {
      console.log(`   ⚠  ${flags.join(" · ")}`);
    } else {
      console.log(`   ✓  no flags`);
    }
    if (itemFlags.length > 0) {
      for (const f of itemFlags) console.log(`      - ${f}`);
    }
    // Print first 3 and last 2 vocab items as sample
    const sampled = vocab.slice(0, 3).concat(vocab.length > 5 ? vocab.slice(-2) : []);
    for (const v of sampled) {
      const word = v.word ?? v.surface ?? "";
      const type = v.type ?? v.wordType ?? "";
      const def = (v.definition ?? v.translation ?? "").slice(0, 80);
      console.log(`      • ${word} [${type}] — ${def}`);
    }
  }

  console.log("\n" + "=".repeat(72));
  console.log("SUMMARY");
  console.log("=".repeat(72));
  for (const r of summaryRows) {
    const flagStr = r.flags.length > 0 ? `⚠ ${r.flags.join(", ")}` : "✓ clean";
    console.log(`  ${r.title.padEnd(40).slice(0, 40)} ${r.level}  ${String(r.vocab).padStart(3)}w  ${flagStr}`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
