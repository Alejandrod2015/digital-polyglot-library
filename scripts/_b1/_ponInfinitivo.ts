/** Un verbo sin tabla de formas lleva el infinitivo entre parentesis dentro de
 *  la propia glosa. Es la convencion que documenta docs/gloss-spec.md mientras
 *  el indice de formas no reconozca todos los verbos. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
(async () => {
  const p = new PrismaClient();
  const B = "spanish-traveler-spain-b1";
  const filas = await p.tapGlossSet.findMany({ where: { bundle: B } });
  const hs = await p.journeyStory.findMany({
    where: { slug: { in: filas.find((f) => f.slug === "")!.slugs } },
    select: { slug: true, vocab: true },
  });
  let n = 0;
  for (const h of hs) {
    const fila = filas.find((f) => f.slug === h.slug); if (!fila) continue;
    const g = fila.glosses as Record<string, any>;
    for (const v of ((h.vocab ?? []) as any[])) {
      if (v.type !== "verb") continue;
      const lema = String(v.word).toLowerCase(), sup = String(v.surface ?? "").toLowerCase();
      for (const k of [lema, sup].filter(Boolean)) {
        const e = g[k]; if (!e || e.f) continue;
        if (/\([\p{L}\s,]+\)/u.test(String(e.g ?? ""))) continue;
        g[k] = { ...e, g: `${e.g} (${lema})` };
        n++;
      }
    }
    await p.tapGlossSet.update({ where: { bundle_slug: { bundle: B, slug: h.slug! } }, data: { glosses: g } });
  }
  console.log(`infinitivos puestos ${n}`);
  await p.$disconnect();
})();
