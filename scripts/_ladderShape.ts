/**
 * ¿Cumple el journey la ESCALERA, no solo el gate?
 *
 * El gate pide una media de encuentros. La escalera
 * ([[project_vocab_recirculation_ladder]]) pide además:
 *   - 4 encuentros por portable, no 3;
 *   - el encuentro 3 a 2 o 3 historias, el 4 a 6 u 8;
 *   - toda portable entra como muy tarde en la historia 15;
 *   - el vocabulario nuevo desciende hacia el final.
 *
 * Solo lectura.  npx tsx scripts/_ladderShape.ts <journeyId>
 */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const tok = (t: string) => (t.toLowerCase().match(/\p{L}+/gu) ?? []);
const clave = (v: { word: string; surface?: string | null }) =>
  String(v.surface ?? v.word).toLowerCase().replace(/^(le|la|les|un|une|des|du|de)\s+/, "");

async function main() {
  const id = process.argv[2];
  const j = await p.journey.findUnique({ where: { id }, select: { topics: true } });
  const order = j?.topics ?? [];
  const st = (await p.journeyStory.findMany({
    where: { journeyId: id, text: { not: null } },
    select: { slug: true, topic: true, slotIndex: true, text: true, vocab: true },
  })).sort((a, b) => (order.indexOf(a.topic) - order.indexOf(b.topic)) || (a.slotIndex - b.slotIndex));
  const cuerpos = st.map((s) => new Set(tok(s.text!)));

  let port = 0, anc = 0, con4 = 0, sumaPort = 0;
  const d3: number[] = [], d4: number[] = [];
  let tardias = 0;
  for (const [i, s] of st.entries()) {
    for (const v of ((s.vocab as Array<{ word: string; surface?: string; anchor?: boolean }>) ?? [])) {
      const k = clave(v);
      const donde = cuerpos.map((c, n) => (c.has(k) ? n : -1)).filter((n) => n >= 0);
      if (v.anchor) { anc++; continue; }
      port++; sumaPort += donde.length;
      if (donde.length >= 4) con4++;
      if (i >= 15) tardias++;
      const post = donde.filter((n) => n > i);
      if (post[0] !== undefined) d3.push(post[0] - i);
      if (post[1] !== undefined) d4.push(post[1] - i);
    }
  }
  const med = (a: number[]) => (a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : "-");
  console.log(`portables ${port} · ancladas ${anc} · reparto ${Math.round((port / (port + anc)) * 100)}/${Math.round((anc / (port + anc)) * 100)}`);
  console.log(`media de encuentros por portable: ${(sumaPort / port).toFixed(2)} (la escalera pide 4)`);
  console.log(`portables con los 4 encuentros: ${con4}/${port} (${Math.round((con4 / port) * 100)}%)`);
  console.log(`distancia del encuentro 3: media ${med(d3)} historias (pide 2-3) · del 4: ${med(d4)} (pide 6-8)`);
  console.log(`portables que entran DESPUES de la historia 15: ${tardias} (pide 0)`);
  console.log("vocabulario nuevo por historia: " + st.map((s) => ((s.vocab as unknown[]) ?? []).length).join(" "));
  await p.$disconnect();
}
main();
