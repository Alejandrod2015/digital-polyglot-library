import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const filas = await p.tapGlossSet.findMany({ where: { NOT: { slug: "" } }, select: { bundle: true, slug: true, glosses: true } });
  const pares = new Map<string, { bundle: string; slug: string; palabras: string[]; es: string; en: string; n: number }>();
  for (const f of filas) for (const [w, e] of Object.entries(f.glosses as Record<string, any>)) {
    if (!e.c) continue;
    const n = String(e.c.es).trim().split(/\s+/).length;
    if (n <= 8) continue;
    const k = `${f.bundle}|${f.slug}|${e.c.es}`;
    const v = pares.get(k) ?? { bundle: f.bundle, slug: f.slug, palabras: [], es: e.c.es, en: e.c.en, n };
    v.palabras.push(w); pares.set(k, v);
  }
  console.log(`entradas afectadas: ${[...pares.values()].reduce((a, b) => a + b.palabras.length, 0)}`);
  console.log(`trozos DISTINTOS que hay que reescribir: ${pares.size}`);
  const porB = new Map<string, number>();
  for (const v of pares.values()) porB.set(v.bundle, (porB.get(v.bundle) ?? 0) + 1);
  console.log([...porB].sort((a, b) => b[1] - a[1]).map(([b, n]) => `${b} ${n}`).join(" · "));
  await p.$disconnect();
})();
