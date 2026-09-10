/** SOLO LECTURA. Glosas de seca/secam/seco en el bundle PT B1 (global y nada-minha-filha). */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  for (const slug of ["", "nada-minha-filha"]) {
    const f = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: "portuguese-traveler-brazil-b1", slug } }, select: { glosses: true } });
    const g = (f?.glosses ?? {}) as Record<string, unknown>;
    for (const k of ["seca", "secam", "seco", "secar"]) if (g[k]) console.log(`slug="${slug}" ${k}: ${JSON.stringify(g[k])}`);
  }
})().finally(() => p.$disconnect());
