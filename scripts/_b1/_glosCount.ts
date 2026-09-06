import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const f = await p.tapGlossSet.findMany({ where: { bundle: "spanish-traveler-spain-b1", NOT: { slug: "" } }, select: { slug: true, glosses: true } });
  for (const x of f) {
    const g = x.glosses as Record<string, any>;
    const k = Object.keys(g);
    console.log(`${x.slug.padEnd(28)} ${k.length} glosas · contexto ${k.filter((w) => g[w].c).length} · formas ${k.filter((w) => g[w].f).length}`);
  }
  await p.$disconnect();
})();
