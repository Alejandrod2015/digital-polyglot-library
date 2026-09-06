import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const filas = await p.tapGlossSet.findMany({ where: { bundle: "spanish-traveler-spain-b1", NOT: { slug: "" } }, select: { slug: true, glosses: true } });
  for (const f of filas) for (const [w, e] of Object.entries(f.glosses as Record<string, any>)) {
    const n = e.c ? String(e.c.es).split(/\s+/).length : 0;
    if (n > 8) console.log(`${f.slug.slice(0,22).padEnd(23)} ${w.padEnd(12)} ${n}w  ${e.c.es}`);
  }
  await p.$disconnect();
})();
