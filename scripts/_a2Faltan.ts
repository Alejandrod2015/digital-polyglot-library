/** Vuelca las palabras tocables sin contexto, con la frase donde caen y una
 *  ventana ya recortada del texto, para escribir solo el ingles. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const TAPPABLE = /\p{L}[\p{L}\p{M}'-]*/gu;
(async () => {
  const B = "spanish-traveler-latam-a2";
  const rows = await p.tapGlossSet.findMany({ where: { bundle: B }, select: { slug: true, glosses: true } });
  const global = (rows.find((r) => !r.slug)?.glosses ?? {}) as Record<string, any>;
  const porHist = new Map(rows.filter((r) => r.slug).map((r) => [r.slug, (r.glosses ?? {}) as Record<string, any>]));
  const ss = await p.journeyStory.findMany({ where: { slug: { in: [...porHist.keys()] } },
    select: { slug: true, title: true, text: true } });
  const out: any = {};
  for (const s of ss) {
    const t = `${s.title}. ${s.text}`;
    const propias = porHist.get(s.slug)!;
    const faltan = new Map<string, string>();
    for (const m of t.matchAll(TAPPABLE)) {
      const k = m[0].toLowerCase();
      if (!global[k] || propias[k]?.c || faltan.has(k)) continue;
      const i = m.index!;
      let a = i, b = i + m[0].length, n = 0;
      while (a > 0 && n < 2) { a--; if (/\s/.test(t[a])) n++; }
      n = 0; while (b < t.length && n < 3) { if (/\s/.test(t[b])) n++; b++; }
      faltan.set(k, t.slice(a, b).replace(/^[\s“”.,;:¿¡]+|[\s“”.,;:]+$/g, ""));
    }
    if (faltan.size) out[s.slug] = Object.fromEntries([...faltan].map(([k, v]) => [k, { g: global[k].g, t: global[k].t ?? "", es: v }]));
  }
  fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
  const n = Object.values(out).reduce((s: number, o: any) => s + Object.keys(o).length, 0);
  console.log(`${n} entradas en ${Object.keys(out).length} historias`);
})().finally(() => p.$disconnect());
