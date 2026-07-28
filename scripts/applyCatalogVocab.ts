/**
 * Aplica vocabulario curado a historias del catálogo (libros).
 *
 * Entrada: un JSON `{ "<storySlug>": [{ word, definition, type }, ...] }`.
 *
 * El objetivo es igualar la densidad de vocabulario de los journeys (~10
 * entradas por cada 100 palabras). Escribe SOLO el campo `vocab`; nunca toca
 * texto, audio, portada ni metadata.
 *
 * GATE: cada palabra debe aparecer LITERALMENTE en el texto de la historia,
 * porque el lector resalta por coincidencia exacta y una entrada que no
 * aparece nunca se puede tocar. Si alguna falla, no se escribe nada de esa
 * historia. También avisa de duplicados, de frases de más de 4 palabras (el
 * lector las descarta) y de pasarse del tope de resaltado.
 *
 *   npx tsx scripts/applyCatalogVocab.ts <archivo.json>           # dry run
 *   npx tsx scripts/applyCatalogVocab.ts <archivo.json> --apply
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env" });
import { readFileSync, writeFileSync } from "fs";
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const FILE = process.argv[2];
const BOOK = process.argv.includes("--book")
  ? process.argv[process.argv.indexOf("--book") + 1]
  : undefined;

// Espejo de los límites reales del lector (src/components/StoryContent.tsx).
// El crítico es MAX_REGEX_SOURCE_LENGTH: si el patrón compuesto lo supera,
// StoryContent NO resalta nada en esa historia, ni una sola palabra. Pasar de
// ese límite no degrada, apaga.
const MAX_HIGHLIGHT_WORDS = 80;
const MAX_HIGHLIGHT_WORD_TOKENS = 4;
const MAX_HIGHLIGHT_WORD_LENGTH = 48;
const MAX_REGEX_SOURCE_LENGTH = 1400;

type VocabItem = { word: string; definition: string; type?: string; surface?: string };

function esc(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Misma normalización que aplica el lector (StoryContent.sanitizePlainStoryText).
// Al quitar los <span> viejos quedan espacios dobles y espacios delante de la
// puntuación; sin colapsarlos, una entrada de varias palabras se rechaza por
// error aunque el lector sí la vaya a resaltar.
function readerText(raw: string): string {
  return (raw ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?…)])/g, "$1")
    .replace(/([¿¡("])\s+/g, "$1")
    .trim();
}
function inText(word: string, text: string) {
  try {
    return new RegExp(`(^|[^\\p{L}\\p{N}_])${esc(word)}($|[^\\p{L}\\p{N}_])`, "iu").test(text);
  } catch {
    return false;
  }
}

async function main() {
  if (!FILE) throw new Error("uso: tsx scripts/applyCatalogVocab.ts <archivo.json> [--apply]");
  const input = JSON.parse(readFileSync(FILE, "utf8")) as Record<string, VocabItem[]>;

  const backup: Record<string, unknown> = {};
  let ok = 0,
    failed = 0;
  const rows: string[] = [];

  for (const [slug, vocab] of Object.entries(input)) {
    // OJO: hay slugs repetidos entre libros (`el-vendedor-ambulante` existe en
    // el argentino y en el colombiano). Sin acotar por libro se escribiría en
    // la historia equivocada, así que --book es obligatorio cuando hay más de
    // una coincidencia.
    const matches = await prisma.catalogStory.findMany({
      where: { slug, ...(BOOK ? { book: { slug: BOOK } } : {}) },
      select: { id: true, slug: true, text: true, vocab: true, book: { select: { slug: true } } },
    });
    if (matches.length > 1) {
      console.log(
        `  ${slug}: AMBIGUA, existe en ${matches.map((m) => m.book.slug).join(" y ")}. Usa --book <slug>.`
      );
      failed += 1;
      continue;
    }
    const story = matches[0];
    if (!story) {
      console.log(`  ${slug}: NO ENCONTRADA`);
      failed += 1;
      continue;
    }
    const plain = readerText(story.text ?? "");
    const words = plain.trim().split(/\s+/).filter(Boolean).length;

    const problems: string[] = [];
    const seen = new Set<string>();
    for (const v of vocab) {
      const w = (v.surface ?? v.word ?? "").trim();
      if (!w) problems.push("entrada sin palabra");
      else {
        const k = w.toLowerCase();
        if (seen.has(k)) problems.push(`duplicada: ${w}`);
        seen.add(k);
        if (!inText(w, plain)) problems.push(`NO aparece en el texto: ${w}`);
        if (w.split(/\s+/).filter(Boolean).length > MAX_HIGHLIGHT_WORD_TOKENS)
          problems.push(`frase de más de 4 palabras (el lector la descarta): ${w}`);
      }
      if (!(v.definition ?? "").trim()) problems.push(`sin definición: ${v.word}`);
      if ((v.definition ?? "").trim().toLowerCase() === (v.word ?? "").trim().toLowerCase())
        problems.push(`la definición repite la palabra: ${v.word}`);
      if (!(v.type ?? "").trim()) problems.push(`sin tipo: ${v.word}`);
    }
    if (vocab.length > MAX_HIGHLIGHT_WORDS)
      problems.push(`${vocab.length} entradas, por encima del tope de resaltado (${MAX_HIGHLIGHT_WORDS})`);

    // El lector arma un solo patrón con todas las palabras; si se pasa de
    // largo, apaga el resaltado de la historia entera.
    const regexSource = vocab
      .map((v) => (v.surface ?? v.word ?? "").trim())
      .filter((w) => w.length >= 3 && w.length <= MAX_HIGHLIGHT_WORD_LENGTH)
      .sort((a, b) => b.length - a.length)
      .map(esc)
      .join("|");
    if (regexSource.length > MAX_REGEX_SOURCE_LENGTH)
      problems.push(
        `patrón de ${regexSource.length} caracteres, por encima de ${MAX_REGEX_SOURCE_LENGTH}: el lector apagaría TODO el resaltado de esta historia`
      );
    const tooShort = vocab.map((v) => (v.surface ?? v.word ?? "").trim()).filter((w) => w.length > 0 && w.length < 3);
    if (tooShort.length) problems.push(`de menos de 3 letras, el lector las descarta: ${tooShort.join(", ")}`);

    const before = Array.isArray(story.vocab) ? (story.vocab as unknown[]).length : 0;
    const density = ((vocab.length / words) * 100).toFixed(1);

    if (problems.length) {
      failed += 1;
      rows.push(`  ✗ ${slug.padEnd(44)} ${before} -> ${vocab.length}  (${density}%)`);
      problems.forEach((p) => rows.push(`       ! ${p}`));
      continue;
    }

    ok += 1;
    rows.push(`  ✓ ${slug.padEnd(44)} ${before} -> ${vocab.length}  (${density}%)`);
    backup[story.id] = story.vocab;
    if (APPLY) {
      await prisma.catalogStory.update({
        where: { id: story.id },
        data: { vocab: vocab as unknown as object },
      });
    }
  }

  console.log(APPLY ? "=== APLICADO ===" : "=== DRY RUN (nada se escribe) ===");
  console.log(rows.join("\n"));
  console.log(`\n${ok} historias OK, ${failed} con problemas`);

  if (APPLY && Object.keys(backup).length) {
    const path = FILE.replace(/\.json$/, "") + ".backup.json";
    writeFileSync(path, JSON.stringify(backup, null, 2), "utf8");
    console.log(`Respaldo del vocab anterior: ${path}`);
  }
  if (!APPLY) console.log("Corre con --apply para escribir.");

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
