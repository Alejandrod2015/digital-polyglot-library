import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
(async () => {
  const p = new PrismaClient();
  const bs = await p.tapGlossSet.findMany({ where: { slug: "" }, select: { bundle: true, glosses: true } });
  const busca = ["lucía","hernando","irene","ana","fernanda","violeta","madrid","lima","iris","renato","doña","don"];
  for (const b of bs) {
    const g = b.glosses as Record<string, any>;
    for (const w of busca) if (g?.[w]) console.log(`${b.bundle} :: ${w} → ${JSON.stringify(g[w])}`);
  }
  // y articulos
  for (const b of bs.filter(x=>x.bundle.startsWith("spanish"))) {
    const g = b.glosses as Record<string, any>;
    for (const w of ["la","el","una","dos"]) if (g?.[w]) { console.log(`${b.bundle} :: ${w} → ${JSON.stringify(g[w])}`); break; }
  }
  await p.$disconnect();
})();
