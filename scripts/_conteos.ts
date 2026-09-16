import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import crypto from "node:crypto";
const p = new PrismaClient();
(async () => {
  const bundle = process.argv[2];
  const filas = await p.tapGlossSet.findMany({ where: { bundle }, orderBy: { slug: "asc" } });
  const global = filas.find((f) => f.slug === "")!;
  const capas = filas.filter((f) => f.slug !== "");
  let entradas = 0, conC = 0, cEnIgualG = 0, nouns = 0, nounsGm = 0, puntoYComa = 0;
  const sinFijar: string[] = [];
  for (const f of capas) {
    for (const [w, e] of Object.entries(f.glosses as Record<string, any>)) {
      entradas++;
      if (e.c) conC++;
      if (e.c && String(e.c.en).trim().toLowerCase() === String(e.g).trim().toLowerCase()) cEnIgualG++;
      if (e.t === "noun") { nouns++; if (e.gm) nounsGm++; }
      if (String(e.g).includes(";")) { puntoYComa++; sinFijar.push(`${f.slug}:${w} = ${e.g}`); }
    }
  }
  const g = global.glosses as Record<string, any>;
  console.log(`bundle:            ${bundle}`);
  console.log(`filas:             ${filas.length} (1 global + ${capas.length} historias)`);
  console.log(`glosas globales:   ${Object.keys(g).length}`);
  console.log(`entradas en capas: ${entradas}`);
  console.log(`con c (trozo):     ${conC}   -> conteo c.en == entradas con g: ${conC === entradas ? "SI (todas)" : "NO"}`);
  console.log(`c.en identico a g: ${cEnIgualG} (debe ser 0)`);
  console.log(`sustantivos:       ${nouns}, con gm: ${nounsGm} (faltan ${nouns - nounsGm})`);
  console.log(`glosas con ";":    ${puntoYComa}`);
  for (const s of sinFijar) console.log(`   ${s}`);
  const hash = crypto.createHash("sha256").update(JSON.stringify(filas.map((f) => [f.slug, f.glosses]))).digest("hex").slice(0, 16);
  console.log(`hash del bundle:   ${hash}`);
  await p.$disconnect();
})();
