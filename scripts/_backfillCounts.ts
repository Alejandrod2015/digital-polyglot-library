/**
 * Rellena `wordCount` y `vocabCount` en las historias que los tienen en null.
 *
 * WHY (2026-08-19): ningún camino de escritura los rellenaba, así que 293 de
 * 564 filas estaban vacías, incluidas las 21 del A1 de España recién
 * publicado. No afecta al lector, pero cualquier tabla o informe que los lea
 * da cifras falsas sin avisar de que faltan. Se cuenta igual que el validador.
 *
 *   npx tsx scripts/_backfillCounts.ts [--apply]
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();
const contar = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;

void (async () => {
  const apply = process.argv.includes("--apply");
  const rows = await prisma.journeyStory.findMany({
    where: { OR: [{ wordCount: null }, { vocabCount: null }] },
    select: { id: true, slug: true, text: true, vocab: true, wordCount: true, vocabCount: true },
  });
  console.log(`${rows.length} historias sin contadores`);
  let hechas = 0;
  for (const r of rows) {
    if (!r.text) { console.log(`  sin texto: ${r.slug}`); continue; }
    const w = contar(r.text);
    const v = Array.isArray(r.vocab) ? (r.vocab as unknown[]).length : 0;
    if (apply) {
      await prisma.journeyStory.update({ where: { id: r.id }, data: { wordCount: w, vocabCount: v } });
    }
    hechas++;
  }
  console.log(apply ? `actualizadas: ${hechas}` : `simulación: ${hechas} se actualizarían. Repite con --apply.`);
  await prisma.$disconnect();
})();
