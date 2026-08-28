import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const filas = await p.tapGlossSet.findMany({ where: { bundle: process.argv[2], NOT: { slug: "" } } });
  let n = 0;
  for (const f of filas) {
    const m = new Map<string, Map<string, string[]>>();
    for (const [w, e] of Object.entries(f.glosses as Record<string, { c?: { es: string; en: string } }>)) {
      if (!e.c) continue;
      if (!m.has(e.c.es)) m.set(e.c.es, new Map());
      const g = m.get(e.c.es)!;
      g.set(e.c.en, [...(g.get(e.c.en) ?? []), w]);
    }
    for (const [es, g] of m) if (g.size > 1) {
      n++;
      console.log(`${f.slug}  «${es}»`);
      for (const [en, ws] of g) console.log(`     ${ws.join(",")}: ${en}`);
    }
  }
  console.log(`\n${n} choques dentro de la misma historia`);
  await p.$disconnect();
})();
