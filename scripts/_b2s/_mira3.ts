import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const B = "spanish-traveler-spain-b2";
(async () => {
  for (const [slug, lemas] of [["la-herramienta-seria", ["negociar", "repasar"]], ["el-cafe-lo-pones-tu", ["quedarse"]]] as [string, string[]][]) {
    const h = await p.journeyStory.findFirst({ where: { slug }, select: { vocab: true } });
    const fila = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug } } });
    const g = fila!.glosses as Record<string, any>;
    for (const lema of lemas) {
      const v = (h!.vocab as any[]).find((x) => x.word === lema);
      console.log(slug, "· vocab:", JSON.stringify(v));
      for (const k of [v?.surface?.toLowerCase(), lema]) if (k) console.log(`   fila[${k}] =`, JSON.stringify(g[k] ?? null).slice(0, 160));
    }
  }
  await p.$disconnect();
})();
