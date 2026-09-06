import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const MIO = "spanish-traveler-spain-b1";
(async () => {
  const filas = await p.tapGlossSet.findMany({ where: { slug: "" }, select: { bundle: true, glosses: true } });
  const mio = filas.find((f) => f.bundle === MIO)!.glosses as Record<string, { g: string; t?: string }>;
  const sib = new Map<string, string>();
  for (const f of filas) {
    if (f.bundle === MIO || !f.bundle.startsWith("spanish-")) continue;
    for (const [k, v] of Object.entries(f.glosses as Record<string, { g: string }>)) if (!sib.has(k)) sib.set(k, v.g);
  }
  const ss = await p.journeyStory.findMany({ where: { journeyId: "cmt5x67ze000l320cpgunu5vi" }, select: { slug: true, title: true, text: true } });
  const frases: Array<[string, string]> = [];
  for (const s of ss) for (const o of `${s.title}. ${s.text}`.split(/(?<=[.!?”])\s+/)) frases.push([s.slug!, o.trim()]);
  const copiadas = Object.keys(mio).filter((k) => sib.get(k) === mio[k].g).sort();
  console.log(`copiadas: ${copiadas.length}`);
  for (const w of copiadas) {
    const re = new RegExp(`(^|[^\\p{L}])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\p{L}]|$)`, "iu");
    const h = frases.find(([, o]) => re.test(o));
    console.log(`${w} | ${mio[w].g} | ${h ? h[1].slice(0, 66) : "(NO APARECE)"}`);
  }
  await p.$disconnect();
})();
