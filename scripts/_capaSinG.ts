import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const filas = await p.tapGlossSet.findMany({ where: { NOT: { slug: "" } }, select: { bundle: true, slug: true, glosses: true } });
  let total = 0, sinG = 0; const ej: string[] = [];
  for (const f of filas) for (const [k, v] of Object.entries(f.glosses as Record<string, { g?: string }>)) {
    total++;
    if (!v?.g || !String(v.g).trim()) { sinG++; if (ej.length < 5) ej.push(`${f.bundle}/${f.slug}: ${k}`); }
  }
  console.log(`entradas de capa: ${total}\nsin definicion g: ${sinG}`);
  if (ej.length) console.log(ej.join("\n"));
  await p.$disconnect();
})();
