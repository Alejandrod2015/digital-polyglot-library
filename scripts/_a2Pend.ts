/** Vuelca las glosas del A2 que siguen sin leer, agrupadas por par
 *  (palabra, glosa) para decidir una vez por par y no por ocurrencia. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient(); const B = "spanish-traveler-latam-a2";
(async () => {
  const rows = await p.tapGlossSet.findMany({ where: { bundle: B, NOT: { slug: "" } }, select: { slug: true, glosses: true } });
  const par = new Map<string, { k: string; t: string; g: string; frases: string[]; n: number }>();
  for (const r of rows) for (const [k, v] of Object.entries<any>(r.glosses ?? {})) {
    if (v?.rev !== false) continue;
    const id = `${k}||${v.g}`;
    if (!par.has(id)) par.set(id, { k, t: String(v.t ?? ""), g: String(v.g ?? ""), frases: [], n: 0 });
    const e = par.get(id)!; e.n++;
    const f = String(v?.c?.es ?? ""); if (f && !e.frases.includes(f)) e.frases.push(f);
  }
  const arr = [...par.values()].sort((a, b) => a.k.localeCompare(b.k));
  fs.writeFileSync(process.argv[2], JSON.stringify(arr, null, 1));
  console.log(`pares distintos: ${arr.length} · ocurrencias: ${arr.reduce((s, x) => s + x.n, 0)}`);
})().finally(() => p.$disconnect());
