import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const filas = await p.tapGlossSet.findMany({ where: { NOT: { slug: "" } }, select: { bundle: true, glosses: true } });
  let con = 0, total = 0;
  const ej: string[] = [];
  for (const f of filas) for (const [w, e] of Object.entries(f.glosses as Record<string, any>)) {
    if (!e.f?.mood) continue;
    total++;
    if (/\(.*\)/.test(String(e.f.lemma ?? ""))) { con++; if (ej.length < 5) ej.push(`${f.bundle} ${w}: ${e.f.lemma}`); }
  }
  console.log(`bloques con modo: ${total} · con el tiempo repetido en el lema: ${con}`);
  for (const x of ej) console.log("  ", x);
  await p.$disconnect();
})();
