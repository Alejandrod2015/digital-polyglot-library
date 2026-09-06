import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "node:fs";
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const b = process.argv[2];
  const filas = await p.tapGlossSet.findMany({ where: { bundle: b, NOT: { slug: "" } }, select: { slug: true, glosses: true } });
  const out: Array<{ slug: string; palabras: string[]; es: string; en: string }> = [];
  const idx = new Map<string, number>();
  for (const f of filas) for (const [w, e] of Object.entries(f.glosses as Record<string, any>)) {
    if (!e.c || String(e.c.es).trim().split(/\s+/).length <= 8) continue;
    const k = `${f.slug}|${e.c.es}`;
    if (!idx.has(k)) { idx.set(k, out.length); out.push({ slug: f.slug, palabras: [], es: e.c.es, en: e.c.en }); }
    out[idx.get(k)!].palabras.push(w);
  }
  fs.writeFileSync(`scripts/_b1/g/largos-${b}.json`, JSON.stringify(out, null, 1));
  console.log(`${b}: ${out.length} trozos`);
  for (const x of out.slice(0, 8)) console.log(`  [${x.palabras.join(",")}] ${x.es}  ->  ${x.en}`);
  await p.$disconnect();
})();
