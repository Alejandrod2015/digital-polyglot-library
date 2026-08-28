import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const [bundle, ...ws] = process.argv.slice(2);
  const filas = await p.tapGlossSet.findMany({ where: { bundle, NOT: { slug: "" } } });
  let n = 0;
  for (const f of filas) {
    const g = f.glosses as Record<string, unknown>;
    let c = false;
    for (const w of ws) if (w in g) { delete g[w]; n++; c = true; }
    if (c) await p.tapGlossSet.update({ where: { bundle_slug: { bundle, slug: f.slug } }, data: { glosses: g as never } });
  }
  console.log(`${n} entradas borradas de las capas`);
  await p.$disconnect();
})();
