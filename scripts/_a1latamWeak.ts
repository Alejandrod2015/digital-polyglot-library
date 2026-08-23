/** Para una historia: que plazas salen una sola vez y en que otras historias
 *  del journey cabria repetirlas (por tema y sitio). Solo lectura. */
import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const A1 = "cmt5vxwgd0007324oesy195k8";
const tok = (t: string) => (t.toLowerCase().match(/\p{L}+/gu) ?? []);
const clave = (v: any) => String(v.surface ?? v.word).toLowerCase().replace(/^(der|die|das|le|la|el|il|o|a)\s+/, "");
(async () => {
  const j = await p.journey.findUnique({ where: { id: A1 } });
  const filas = await p.journeyStory.findMany({ where: { journeyId: A1 },
    select: { slug: true, topic: true, slotIndex: true, text: true, vocab: true } });
  const orden = j!.topics;
  filas.sort((a, b) => (orden.indexOf(a.topic) - orden.indexOf(b.topic)) || (a.slotIndex - b.slotIndex));
  const cuerpos = filas.map((f) => new Set(tok(String(f.text ?? ""))));
  for (const slug of process.argv.slice(2)) {
    const i = filas.findIndex((f) => f.slug === slug);
    const voc = (filas[i].vocab as any[]) ?? [];
    console.log(`\n### ${slug}`);
    for (const v of voc) {
      const k = clave(v);
      const donde = filas.map((f, n) => (cuerpos[n].has(k) ? `${n + 1}` : null)).filter(Boolean);
      console.log(`  ${String(v.surface ?? v.word).padEnd(18)} ${donde.length}x  [${donde.join(",")}]`);
    }
  }
  await p.$disconnect();
})();
