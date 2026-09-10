/** SOLO LECTURA. Donde aparece "onze" en las filas TapGlossSet del bundle PT B1. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const filas = await p.tapGlossSet.findMany({ where: { bundle: "portuguese-traveler-brazil-b1" }, select: { slug: true, glosses: true } });
  for (const f of filas) {
    const g = f.glosses as Record<string, unknown>;
    for (const k of Object.keys(g ?? {})) if (k.toLowerCase() === "onze") console.log(`slug="${f.slug}" ${k}: ${JSON.stringify(g[k])}`);
  }
  console.log(`${filas.length} filas`);
})().finally(() => p.$disconnect());
