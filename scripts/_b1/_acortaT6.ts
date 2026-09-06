/** Cuatro trozos del tema 6 pasaban de 8 palabras. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const B = "spanish-traveler-spain-b1";
const CORTOS: Record<string, { es: string; en: string }> = {
  "La decisión es de Emilio, de Berta y suya": { es: "La decisión es de los tres", en: "The decision belongs to all three" },
  "Y el mío es caro porque sí lo toca": { es: "el mío es caro porque sí lo toca", en: "mine is dear because it does" },
  "Y lo que firmo lo tengo que poder enseñar": { es: "lo que firmo lo tengo que enseñar", en: "what I sign I have to show" },
  "porque el dinero no es mío, es de los tres": { es: "el dinero no es mío", en: "the money is not mine" },
};
(async () => {
  const p = new PrismaClient();
  const filas = await p.tapGlossSet.findMany({ where: { bundle: B } });
  let c = 0;
  for (const f of filas) {
    const g = f.glosses as Record<string, any>;
    for (const w of Object.keys(g)) {
      const ctx = g[w]?.c;
      if (ctx && CORTOS[ctx.es]) { g[w] = { ...g[w], c: { ...CORTOS[ctx.es] } }; c++; }
    }
    await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug: f.slug } }, data: { glosses: g } });
  }
  console.log(`acortados ${c}`);
  await p.$disconnect();
})();
