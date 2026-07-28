import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const r = await p.catalogStory.findFirst({ where: { slug: process.argv[2] }, select: { text: true, vocab: true } });
  const v = (Array.isArray(r?.vocab) ? r!.vocab : []) as Array<{ word?: string; surface?: string; type?: string }>;
  const bloques = r!.text.split(/\n\s*\n/).map((b) => b.replace(/<[^>]+>/g, " ").toLowerCase());
  const usado = new Set<number>();
  const porBloque = bloques.map((b) => {
    let n = 0;
    v.forEach((item, i) => {
      if (usado.has(i)) return;
      const w = (item.surface || item.word || "").toLowerCase();
      if (w && b.includes(w)) { n += 1; usado.add(i); }
    });
    return n;
  });
  console.log(`bloques: ${bloques.length} | vocab: ${v.length}`);
  console.log(`items por bloque: ${porBloque.join(", ")}`);
  const max = Math.max(...porBloque);
  console.log(`mayor concentracion: ${max} items (${((100 * max) / v.length).toFixed(0)}% del total) | regla: max ~30%, objetivo 3-5 por parrafo`);
  console.log(`bloques sin ningun item: ${porBloque.filter((x) => x === 0).length}`);
  await p.$disconnect();
})();
