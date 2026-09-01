import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
/** Cuanto gana anteponer la superficie tocada al lema. */
(async () => {
  const capa = await p.tapGlossSet.findMany({ where: { NOT: { slug: "" } }, select: { slug: true, glosses: true } });
  const conC = capa.filter((f) => Object.values(f.glosses as Record<string, { c?: unknown }>).some((v) => v?.c));
  let n = 0, soloLema = 0, conSuperficie = 0;
  for (const f of conC.slice(0, 40)) {
    const st = await p.journeyStory.findFirst({ where: { slug: f.slug }, select: { text: true, vocab: true } });
    if (!st?.vocab || !st.text) continue;
    const g = f.glosses as Record<string, { c?: unknown }>;
    const enTexto = new Set((String(st.text).toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []));
    for (const v of st.vocab as Array<{ word?: string; surface?: string }>) {
      const lema = (v.word ?? "").trim().toLowerCase();
      if (!lema || lema.includes(" ")) continue;
      const raiz = lema.slice(0, Math.max(4, lema.length - 2));
      const sup = enTexto.has(lema) ? lema : [...enTexto].find((t) => t.startsWith(raiz));
      if (!sup) continue;
      n++;
      const porLema = !!(g[lema]?.c || (v.surface && g[v.surface.toLowerCase()]?.c));
      const porSup = !!g[sup]?.c;
      if (porLema) soloLema++;
      if (porSup || porLema) conSuperficie++;
    }
  }
  console.log(`palabras de vocab: ${n}`);
  console.log(`  resolvian ANTES (lema/surface): ${soloLema} (${Math.round(soloLema / n * 100)}%)`);
  console.log(`  resuelven AHORA (+ superficie): ${conSuperficie} (${Math.round(conSuperficie / n * 100)}%)`);
  await p.$disconnect();
})();
