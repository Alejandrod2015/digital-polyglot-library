/**
 * Reconcilia `vocabCount` con la longitud real del array `vocab`.
 *
 * La extensión de Prisma deriva `vocabCount = vocab.length` en cualquier write
 * que SETEE `vocab`, pero en las dos historias donde quité un item sin
 * sustituto la columna se quedó con el valor viejo. Una columna que dice 24
 * cuando el array tiene 23 es la clase de desfase que luego se cuela en una
 * pantalla o en un contador y nadie sabe de dónde sale.
 *
 * Solo toca `vocabCount`; no escribe `vocab` ni `text`.
 */
import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

async function run() {
  const rows = await prisma.journeyStory.findMany({
    where: { journeyId: process.argv[2] },
    select: { id: true, slug: true, vocab: true, vocabCount: true },
    orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
  });
  let off = 0;
  for (const r of rows) {
    const real = Array.isArray(r.vocab) ? (r.vocab as unknown[]).length : 0;
    if (real === r.vocabCount) continue;
    off++;
    console.log(`${r.slug.padEnd(28)} columna=${r.vocabCount} · array=${real}`);
    if (apply) await prisma.journeyStory.update({ where: { id: r.id }, data: { vocabCount: real } });
  }
  console.log(off ? (apply ? `\ncorregidas ${off}` : `\n${off} desfasadas (dry run)`) : "\ntodas cuadran");
  await prisma.$disconnect();
}
run().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
