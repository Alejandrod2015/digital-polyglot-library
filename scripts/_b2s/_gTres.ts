import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const B = "spanish-traveler-spain-b2";
const G: Record<string, Record<string, { g: string; t: string }>> = {
  "la-herramienta-seria": {
    "negociar": { g: "to negotiate, to settle by give and take (negociar)", t: "verb" },
    "repasar": { g: "to go over again (repasar)", t: "verb" },
  },
  "el-cafe-lo-pones-tu": {
    "quedarse": { g: "to stay, to remain somewhere (quedarse)", t: "verb" },
  },
};
(async () => {
  for (const [slug, fixes] of Object.entries(G)) {
    const fila = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug } } });
    const g = { ...(fila!.glosses as Record<string, any>) };
    for (const [k, v] of Object.entries(fixes)) g[k] = { ...g[k], ...v };
    await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug } }, data: { glosses: g } });
    console.log(slug, "->", Object.keys(fixes).join(", "));
  }
  await p.$disconnect();
})();
