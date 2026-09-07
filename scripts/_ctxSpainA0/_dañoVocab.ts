/** ¿Cuantas palabras del VOCABULARIO se quedan sin glosa en su historia?
 *
 *  VocabPanel busca la entrada por superficie Y POR LEMA
 *  (src/components/VocabPanel.tsx, `claves`), asi que una glosa cuya clave es
 *  el lema ("adjudicar") SI se alcanza aunque el texto diga "adjudicaron" y el
 *  lector de tap nunca la encuentre. Es decir: una clave que el barrido de
 *  huerfanas llama muerta puede estar sirviendo al panel de vocabulario.
 *
 *  Esto mide el estado ACTUAL: por bundle, cuantos items de vocabulario no
 *  tienen entrada ni por superficie ni por lema. spanish-traveler-latam-b2 no
 *  se toco y sirve de control. Solo lee. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";

const p = new PrismaClient();

(async () => {
  const filas = await p.tapGlossSet.findMany({ select: { bundle: true, slug: true, slugs: true, glosses: true } });
  const bundles = [...new Set(filas.map((f) => f.bundle))].sort();
  const hs = await p.journeyStory.findMany({ select: { slug: true, vocab: true } });
  const vocabDe = new Map(hs.map((h) => [h.slug, (h.vocab ?? []) as Array<{ word?: string; surface?: string }>]));

  for (const bundle of bundles) {
    const propias = filas.filter((f) => f.bundle === bundle && f.slug);
    let total = 0, sin = 0;
    const ejemplos: string[] = [];
    for (const f of propias) {
      const g = f.glosses as Record<string, { c?: unknown }>;
      for (const v of vocabDe.get(f.slug) ?? []) {
        const claves = [v.surface, v.word].filter((x): x is string => Boolean(x)).map((x) => x.trim().toLowerCase());
        if (!claves.length) continue;
        total++;
        if (claves.some((k) => g[k])) continue;
        sin++;
        if (ejemplos.length < 6) ejemplos.push(`${f.slug}:${claves[claves.length - 1]}`);
      }
    }
    if (!total) continue;
    const pct = ((sin / total) * 100).toFixed(1);
    console.log(`${String(sin).padStart(4)}/${String(total).padEnd(5)} (${pct.padStart(5)}%)  ${bundle}${sin ? `\n      ${ejemplos.join(", ")}` : ""}`);
  }
  await p.$disconnect();
})();
