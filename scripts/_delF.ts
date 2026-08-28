/** Quita la tabla de formas de una palabra en TODAS las capas de un bundle.
 *  npx tsx scripts/_delF.ts <bundle> <palabra...> */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const [bundle, ...ws] = process.argv.slice(2);
  const filas = await p.tapGlossSet.findMany({ where: { bundle, NOT: { slug: "" } } });
  let n = 0;
  for (const f of filas) {
    const g = f.glosses as Record<string, { f?: unknown }>;
    let c = false;
    for (const w of ws) if (g[w]?.f) { delete g[w].f; n++; c = true; }
    if (c) await p.tapGlossSet.update({ where: { bundle_slug: { bundle, slug: f.slug } }, data: { glosses: g as never } });
  }
  console.log(`${n} tablas quitadas`);
  await p.$disconnect();
})();
