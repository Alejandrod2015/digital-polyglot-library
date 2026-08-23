/** Candidatos de vocabulario REAL para una historia del journey FR: formas del
 *  cuerpo que no son ya plaza de vocabulario en ninguna historia, ordenadas por
 *  en cuántos cuerpos del journey reaparecen (lo que las hace portables). */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const ID = "cmt09ehi60000320qf9efrypu";
const tok = (t: string) => (t.toLowerCase().match(/\p{L}+/gu) ?? []);
const clave = (w: string) => w.toLowerCase().replace(/^(le|la|les|un|une|des|du|de|l')\s*/, "");
(async () => {
  const j = await p.journey.findUnique({ where: { id: ID }, select: { topics: true } });
  const order = j?.topics ?? [];
  const st = (await p.journeyStory.findMany({ where: { journeyId: ID }, select: { slug: true, topic: true, slotIndex: true, text: true, vocab: true } }))
    .sort((a,b)=>(order.indexOf(a.topic)-order.indexOf(b.topic))||(a.slotIndex-b.slotIndex));
  const banco = new Set(st.flatMap(s => ((s.vocab as any[])??[]).flatMap(v => tok(clave(v.word)))));
  const cuerpos = st.map(s => new Set(tok(s.text!)));
  const i = Number(process.argv[2]) - 1;
  const mias = [...new Set(tok(st[i].text!))].filter(w => w.length > 2 && !banco.has(w));
  mias.map(w => [w, cuerpos.filter(c => c.has(w)).length] as const)
      .sort((a,b)=>b[1]-a[1])
      .forEach(([w,n]) => process.stdout.write(`${w}(${n}) `));
  console.log();
  await p.$disconnect();
})();
