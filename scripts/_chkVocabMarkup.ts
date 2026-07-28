import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const rows = await p.catalogStory.findMany({
    where: { book: { slug: "colombian-spanish-stories-for-beginners" } },
    select: { slug: true, text: true, vocab: true },
  });
  let conMarkup = 0, totalVocab = 0;
  for (const r of rows) {
    const spans = (r.text.match(/class="vocab-word"/g) || []).length;
    const v = Array.isArray(r.vocab) ? r.vocab.length : 0;
    if (spans > 0) conMarkup += 1;
    totalVocab += v;
    if (rows.indexOf(r) < 3) console.log(`  ${r.slug.padEnd(34)} spans=${spans} vocab=${v}`);
  }
  console.log(`historias del libro: ${rows.length} | con markup de vocab: ${conMarkup} | entradas de vocab totales: ${totalVocab}`);
  await p.$disconnect();
})();
