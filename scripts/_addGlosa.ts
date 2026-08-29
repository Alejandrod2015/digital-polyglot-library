/** Anade una clave NUEVA al mapa global de un bundle. Existe para las claves
 *  con apostrofo (`c'est`, `s'appelle`), que la cobertura no reclama nunca
 *  porque su cola ya esta glosada, pero que el lector prueba PRIMERO y que
 *  dicen algo distinto de sus dos mitades: `c'est` no es "est".
 *  npx tsx scripts/_addGlosa.ts <bundle> <palabra> <glosa> <tipo> */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const [bundle, w, glosa, tipo] = process.argv.slice(2);
  const f = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle, slug: "" } } });
  const g = f!.glosses as Record<string, { g: string; t: string }>;
  if (g[w]) { console.error(`${w} ya existe: "${g[w].g}"`); process.exit(1); }
  g[w] = { g: glosa, t: tipo };
  await p.tapGlossSet.update({ where: { bundle_slug: { bundle, slug: "" } }, data: { glosses: g as never } });
  console.log(`${w} = "${glosa}" (${tipo})`);
  await p.$disconnect();
})();
