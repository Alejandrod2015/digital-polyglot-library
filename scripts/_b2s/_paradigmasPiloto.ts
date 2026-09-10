/** Paradigmas (bloque f) de las formas verbales del piloto, para leerlos uno a uno. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const B = "spanish-traveler-spain-b2";
(async () => {
  const glob = (await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug: "" } } }))!.glosses as Record<string, any>;
  const vistos = new Set<string>();
  for (const slug of ["el-cafe-lo-pones-tu", "la-bolsa-como-prueba", "la-sobremesa-se-estira"]) {
    const g = (await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle: B, slug } } }))!.glosses as Record<string, any>;
    for (const [k, e] of Object.entries(g)) {
      const f = e?.f ?? glob[k]?.f;
      if (!f || vistos.has(k)) continue;
      vistos.add(k);
      const filas = Array.isArray(f) ? f : (f.rows ?? f.forms ?? f);
      console.log(`${k.padEnd(14)} ${(e.g ?? glob[k]?.g ?? "").slice(0, 34).padEnd(34)} | ${JSON.stringify(filas).slice(0, 150)}`);
    }
  }
  console.log(`\n${vistos.size} formas con paradigma`);
  await p.$disconnect();
})();
