import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const filas = await p.tapGlossSet.findMany({ where: { bundle: "spanish-traveler-spain-b1", NOT: { slug: "" } }, select: { slug: true, glosses: true } });
  for (const f of filas) {
    const g = f.glosses as Record<string, any>;
    const verbos = Object.entries(g).filter(([, e]) => e.t === "verb");
    const sin = verbos.filter(([, e]) => !e.f).map(([w]) => w);
    console.log(`${f.slug.slice(0,24).padEnd(25)} verbos ${verbos.length} · con tabla ${verbos.length - sin.length} · sin: ${sin.join(" ")}`);
  }
  await p.$disconnect();
})();
