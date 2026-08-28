/** Corrige una glosa del mapa GLOBAL de un bundle.
 *  npx tsx scripts/_setGlosa.ts <bundle> <palabra> <glosa> <tipo> */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const [bundle, w, glosa, tipo] = process.argv.slice(2);
  const f = await p.tapGlossSet.findUnique({ where: { bundle_slug: { bundle, slug: "" } } });
  const g = f!.glosses as Record<string, { g: string; t: string }>;
  if (!g[w]) { console.error(`${w} no existe`); process.exit(1); }
  console.log(`${w}: "${g[w].g}" (${g[w].t}) -> "${glosa}" (${tipo})`);
  g[w] = { ...g[w], g: glosa, t: tipo };
  await p.tapGlossSet.update({ where: { bundle_slug: { bundle, slug: "" } }, data: { glosses: g as never } });
  await p.$disconnect();
})();
