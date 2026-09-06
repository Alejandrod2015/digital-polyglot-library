import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  for (const b of ["spanish-traveler-spain-a1", "spanish-traveler-spain-a2", "spanish-traveler-latam-a2", "spanish-traveler-spain-b1"]) {
    const filas = await p.tapGlossSet.findMany({ where: { bundle: b, NOT: { slug: "" } }, select: { glosses: true } });
    let v = 0, con = 0;
    for (const f of filas) for (const e of Object.values(f.glosses as Record<string, any>)) if (e.t === "verb") { v++; if (e.f) con++; }
    console.log(`${b.padEnd(28)} verbos ${String(v).padStart(4)} · con tabla ${String(con).padStart(4)} (${Math.round(con / v * 100)}%)`);
  }
  await p.$disconnect();
})();
