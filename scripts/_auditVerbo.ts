/** Busca formas concretas dentro de los bloques `f.rows` de TODOS los bundles.
 *  npx tsx scripts/_auditVerbo.ts dormo dorme dormen dás vés */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const malas = new Set(process.argv.slice(2));
  const filas = await p.tapGlossSet.findMany();
  let n = 0;
  for (const f of filas) {
    for (const [w, e] of Object.entries(f.glosses as Record<string, { f?: { rows: string[][] } }>)) {
      const hit = (e.f?.rows ?? []).flat().filter((x) => malas.has(x.toLowerCase()));
      if (hit.length) { console.log(`${f.bundle} | ${f.slug || "(global)"} | ${w} | ${[...new Set(hit)].join(" ")}`); n++; }
    }
  }
  console.log(`${n} entradas`);
  await p.$disconnect();
})();
