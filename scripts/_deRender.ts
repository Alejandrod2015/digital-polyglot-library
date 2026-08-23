/** Como sale cada historia EN PANTALLA, y si algun bloque parte una linea
 *  citada por la mitad. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { renderedParagraphs } from "@/lib/readerParagraphs";
const p = new PrismaClient();
(async () => {
  const j = await p.journey.findUnique({ where: { id: "cmt0a8vb1000m32p1x7r5ba28" }, select: { topics: true } });
  const orden = j?.topics ?? [];
  const st = (await p.journeyStory.findMany({
    where: { journeyId: "cmt0a8vb1000m32p1x7r5ba28" },
    select: { slug: true, topic: true, slotIndex: true, text: true },
  })).sort((a, b) => (orden.indexOf(a.topic) - orden.indexOf(b.topic)) || (a.slotIndex - b.slotIndex));
  let rotas = 0;
  for (const s of st) {
    const bl = renderedParagraphs(String(s.text));
    bl.forEach((b, i) => {
      const abre = (b.match(/“/g) ?? []).length, cierra = (b.match(/”/g) ?? []).length;
      if (abre !== cierra) {
        rotas++;
        console.log(`${s.slug} bloque ${i + 1}: ${abre} aperturas y ${cierra} cierres\n   ${b.slice(0, 110)}`);
      }
    });
    if (process.argv[2] === s.slug) { console.log(`\n--- ${s.slug} en pantalla ---`); bl.forEach((b, i) => console.log(`[${i + 1}] ${b}`)); }
  }
  console.log(`\nbloques que parten una linea citada: ${rotas}`);
  await p.$disconnect();
})();
