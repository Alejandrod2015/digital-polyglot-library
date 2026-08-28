/** Arregla en sitio la tilde de la i tonica de los preteritos en -y- y el
 *  infinitivo `oir` sin tilde. Solo toca celdas cuyo texto es exactamente una
 *  de las formas mal escritas: no rehace ninguna tabla. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const CELDA: Record<string, string> = {
  caiste: "caíste", caimos: "caímos", caisteis: "caísteis",
  oiste: "oíste", oimos: "oímos", oisteis: "oísteis",
  leiste: "leíste", leimos: "leímos", leisteis: "leísteis",
  creiste: "creíste", creimos: "creímos", creisteis: "creísteis",
};
(async () => {
  const filas = await p.tapGlossSet.findMany({ where: { NOT: { slug: "" } } });
  let n = 0, tablas = 0;
  for (const f of filas) {
    const g = f.glosses as Record<string, { f?: { lemma?: string; rows: string[][] } }>;
    let cambio = false;
    for (const e of Object.values(g)) {
      if (!e.f) continue;
      let tocada = false;
      for (const r of e.f.rows) {
        const fix = CELDA[r[1]];
        if (fix) { r[1] = fix; n++; tocada = true; }
      }
      if (e.f.lemma?.startsWith("oir")) { e.f.lemma = e.f.lemma.replace(/^oir/, "oír"); tocada = true; }
      if (tocada) { tablas++; cambio = true; }
    }
    if (cambio) await p.tapGlossSet.update({ where: { bundle_slug: { bundle: f.bundle, slug: f.slug } }, data: { glosses: g as never } });
  }
  console.log(`${n} celdas en ${tablas} tablas`);
  await p.$disconnect();
})();
