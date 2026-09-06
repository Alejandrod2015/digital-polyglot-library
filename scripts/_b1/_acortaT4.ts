/** Dos trozos del tema 4 pasaban de 8 palabras y tres numerales entraron como
 *  tocables. Mismo arreglo que en el tema 3. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const B = "spanish-traveler-spain-b1";
const CORTOS: Record<string, { es: string; en: string }> = {
  "con la voz más baja de lo que quería": { es: "con la voz más baja", en: "in a lower voice" },
  "si el del techo no nos falla otra vez": { es: "si el del techo no falla", en: "if the roof man does not fail" },
};
const NUMERALES = ["cinco", "veinte", "veintiuno"];
(async () => {
  const p = new PrismaClient();
  const filas = await p.tapGlossSet.findMany({ where: { bundle: B } });
  let c = 0, q = 0;
  for (const f of filas) {
    const g = f.glosses as Record<string, any>;
    for (const w of Object.keys(g)) {
      const ctx = g[w]?.c;
      if (ctx && CORTOS[ctx.es]) { g[w] = { ...g[w], c: { ...CORTOS[ctx.es] } }; c++; }
    }
    if (f.slug === "") for (const n of NUMERALES) if (g[n]) { delete g[n]; q++; }
    await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug: f.slug } }, data: { glosses: g } });
  }
  console.log(`acortados ${c} · numerales fuera ${q}`);
  await p.$disconnect();
})();
