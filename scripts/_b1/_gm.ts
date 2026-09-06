import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  for (const b of ["spanish-traveler-spain-a1", "spanish-traveler-spain-a2", "spanish-traveler-spain-b1"]) {
    const f = await p.tapGlossSet.findMany({ where: { bundle: b, NOT: { slug: "" } }, select: { glosses: true } });
    let n = 0, con = 0;
    for (const x of f) for (const v of Object.values(x.glosses as Record<string, any>)) if (v.t === "noun") { n++; if (v.gm) con++; }
    console.log(`${b.padEnd(28)} sustantivos ${n} · con genero ${con} (${n ? Math.round(con / n * 100) : 0}%)`);
  }
  await p.$disconnect();
})();
