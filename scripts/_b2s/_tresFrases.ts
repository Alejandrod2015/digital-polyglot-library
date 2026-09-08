import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const B = "spanish-traveler-spain-b2";
const FIX: Record<string, Record<string, { es: string; en: string }>> = {
  "la-herramienta-seria": {
    "negociar": { es: "se negocian con el viento", en: "get negotiated with the wind" },
    "repasar": { es: "la fecha se repasa", en: "the date is inked over" },
  },
  "el-cafe-lo-pones-tu": {
    "quedarse": { es: "cuánto se queda", en: "how long she is staying" },
  },
};
(async () => {
  for (const [slug, fixes] of Object.entries(FIX)) {
    const st = await p.journeyStory.findFirst({ where: { slug, journeyId: "cmtplpfum0007j8c6piegwt31" }, select: { text: true } });
    const fila = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug } } });
    const g = { ...(fila!.glosses as Record<string, any>) };
    for (const [k, c] of Object.entries(fixes)) {
      if (!st!.text.toLowerCase().includes(c.es.toLowerCase())) throw new Error(`${slug}/${k}: "${c.es}" no es subcadena`);
      console.log(`  ${slug} · ${k}: existia=${!!g[k]} c_antes=${JSON.stringify(g[k]?.c ?? null)} -> "${c.es}"`);
      g[k] = { ...(g[k] ?? {}), c };
    }
    await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug } }, data: { glosses: g } });
  }
  await p.$disconnect();
})();
