/**
 * Fix vocabulary entries whose English definition just repeats the Spanish
 * word, which leaves the learner with nothing when they tap the pill.
 *
 * All four cases are cognates ("memorable", "nostalgia", "canal", "cultural")
 * where whoever authored the entry copied the headword into the definition
 * field. Replacements follow the terse gloss style already used in these two
 * books ("neighborhood", "votive candle", "chain (store)").
 *
 * Writes `vocab` only, on the named stories only, and is idempotent: an entry
 * is touched solely while its definition still equals its word.
 *
 *   npx tsx scripts/fixSelfReferentialDefinitions.ts            # dry run
 *   npx tsx scripts/fixSelfReferentialDefinitions.ts --apply
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const FIXES: { storySlug: string; word: string; definition: string }[] = [
  { storySlug: "la-feria-de-san-marcos", word: "memorable", definition: "unforgettable" },
  { storySlug: "dia-de-muertos-en-xochimilco", word: "nostalgia", definition: "longing for the past" },
  { storySlug: "dia-de-muertos-en-xochimilco", word: "canal", definition: "canal, waterway" },
  { storySlug: "el-negocio-familiar", word: "cultural", definition: "relating to culture" },
];

type VocabItem = { word: string; definition: string; type?: string; example?: string };

async function main() {
  let changed = 0;
  const byStory = new Map<string, typeof FIXES>();
  for (const f of FIXES) byStory.set(f.storySlug, [...(byStory.get(f.storySlug) ?? []), f]);

  for (const [storySlug, fixes] of byStory) {
    const story = await prisma.catalogStory.findFirst({
      where: { slug: storySlug },
      select: { id: true, slug: true, vocab: true },
    });
    if (!story) {
      console.log(`  ${storySlug}: no encontrada`);
      continue;
    }
    const vocab = (Array.isArray(story.vocab) ? story.vocab : []) as unknown as VocabItem[];
    let touched = false;
    const next = vocab.map((item) => {
      const fix = fixes.find((f) => f.word.toLowerCase() === (item.word ?? "").trim().toLowerCase());
      if (!fix) return item;
      // Guard: only rewrite while the definition is still the broken one.
      if ((item.definition ?? "").trim().toLowerCase() !== fix.word.toLowerCase()) return item;
      touched = true;
      changed += 1;
      console.log(`  ${storySlug} · ${item.word}: "${item.definition}" -> "${fix.definition}"`);
      return { ...item, definition: fix.definition };
    });
    if (touched && APPLY) {
      await prisma.catalogStory.update({
        where: { id: story.id },
        data: { vocab: next as unknown as object },
      });
    }
  }

  console.log(`\n${changed} definiciones ${APPLY ? "corregidas" : "por corregir (dry run)"}`);
  if (!APPLY) console.log("Corre con --apply para escribir.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
