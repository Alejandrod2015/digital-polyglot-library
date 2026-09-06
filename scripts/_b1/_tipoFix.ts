/** El tipo tambien viaja en la copia: `casero` venia de "homemade" y por eso
 *  llegaba como adjetivo. El lector pinta el color desde ahi. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const FIX: Record<string, string> = { casero: "noun", cola: "noun", bombilla: "noun", cuarto: "noun", billete: "noun" };
(async () => {
  const p = new PrismaClient();
  const filas = await p.tapGlossSet.findMany({ where: { bundle: "spanish-traveler-spain-b1" } });
  for (const f of filas) {
    const g = f.glosses as Record<string, any>;
    let n = 0;
    for (const [w, t] of Object.entries(FIX)) if (g[w] && g[w].t !== t) { g[w].t = t; n++; }
    if (n) { await p.tapGlossSet.update({ where: { bundle_slug: { bundle: f.bundle, slug: f.slug } }, data: { glosses: g } }); console.log(`${f.slug || "(global)"}: ${n} tipos`); }
  }
  await p.$disconnect();
})();
