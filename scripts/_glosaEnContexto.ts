/** Vuelca cada píldora curada junto a la ORACIÓN donde cae, para leerla
 *  contra su contexto (regla `feedback_gloss_in_context`). */
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const rows = await p.journeyStory.findMany({
    where: { journeyId: "cmsyrge55000732u9oiu8wue3", topic: { in: process.argv.slice(2) } },
    select: { slug: true, topic: true, slotIndex: true, text: true, vocab: true },
    orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
  });
  for (const s of rows) {
    console.log(`\n### ${s.slug}`);
    const frases = s.text.split(/\n\s*\n/).flatMap((x) => x.split(/(?<=[.!?…])\s+/)).map((x) => x.trim()).filter(Boolean);
    for (const v of (s.vocab as Array<{ word: string; surface?: string; definition: string }>)) {
      const sup = v.surface ?? v.word;
      const f = frases.find((x) => x.includes(sup)) ?? "(NO APARECE)";
      console.log(`- ${sup} :: ${v.definition}\n    ${f}`);
    }
  }
  await p.$disconnect();
})();
