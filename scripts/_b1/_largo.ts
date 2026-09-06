import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  for (const b of ["spanish-traveler-spain-a1", "spanish-traveler-spain-a2", "spanish-traveler-spain-b1"]) {
    const f = await p.tapGlossSet.findMany({ where: { bundle: b, NOT: { slug: "" } }, select: { glosses: true } });
    const largos: number[] = [];
    for (const x of f) for (const v of Object.values(x.glosses as Record<string, any>)) if (v.c) largos.push(String(v.c.es).split(/\s+/).length);
    largos.sort((a, b) => a - b);
    const pct = (q: number) => largos[Math.floor(largos.length * q)];
    console.log(`${b.padEnd(28)} n=${largos.length} · mediana ${pct(0.5)} · p90 ${pct(0.9)} · max ${largos[largos.length - 1]}`);
  }
  await p.$disconnect();
})();
