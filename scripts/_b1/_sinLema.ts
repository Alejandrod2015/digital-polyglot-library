import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const filas = await p.tapGlossSet.findMany({ where: { bundle: "spanish-traveler-spain-b1" }, select: { slug: true, glosses: true } });
  const sin = new Set<string>();
  for (const f of filas) for (const [w, e] of Object.entries(f.glosses as Record<string, any>)) {
    if (e.t !== "verb" || e.f) continue;
    if (/\([a-záéíóúñ]+(ar|er|ir)[,)]/.test(String(e.g))) continue;  // el infinitivo ya va en la glosa
    sin.add(`${w}|${e.g}`);
  }
  console.log(`verbos sin tabla y sin infinitivo a la vista: ${sin.size}`);
  for (const x of [...sin].sort()) console.log("  ", x);
  await p.$disconnect();
})();
