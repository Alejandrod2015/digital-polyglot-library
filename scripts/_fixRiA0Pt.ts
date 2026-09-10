// Corrige las tablas de `ri` y `sorri` del bundle del A0 PT-BR: el generador las tomo por preterito
// y en las historias son PRESENTE ("Larissa ri", "e sorri").
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const T: Record<string, { lemma: string; rows: string[][] }> = {
  ri: { lemma: "rir", rows: [["eu","rio"],["você","ri"],["ele, ela","ri"],["nós","rimos"],["vocês","riem"],["eles","riem"]] },
  sorri: { lemma: "sorrir", rows: [["eu","sorrio"],["você","sorri"],["ele, ela","sorri"],["nós","sorrimos"],["vocês","sorriem"],["eles","sorriem"]] },
};
(async () => {
  const filas = await p.tapGlossSet.findMany({ where: { bundle: "portuguese-traveler-brazil-a0" } });
  let n = 0;
  for (const f of filas) {
    const g = f.glosses as Record<string, any>; let cambio = false;
    for (const [w, t] of Object.entries(T)) if (g[w]?.f) { g[w].f = { ...g[w].f, lemma: t.lemma, rows: t.rows, here: 2 }; cambio = true; n++; }
    if (cambio) await p.tapGlossSet.update({ where: { id: f.id }, data: { glosses: g as never } });
  }
  console.log(`tablas corregidas: ${n}`);
  await p.$disconnect();
})();
