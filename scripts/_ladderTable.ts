/**
 * Una fila por historia con el estado de la escalera de recirculación.
 * Solo lectura.  npx tsx scripts/_ladderTable.ts <journeyId>
 */
import { config } from "dotenv";
config({ path: ".env.local" }); config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";

const p = new PrismaClient();
const tok = (s: string) => (s.toLowerCase().match(/\p{L}+/gu) ?? []);
const strip = (w: string) => w.replace(/^(le|la|les|l'|un|une|des|du|de)\s+/i, "").trim();
const depl = (w: string) => (w.length > 3 && /(?:es|s|x)$/.test(w) ? w.replace(/(?:es|s|x)$/, "") : w);
const key = (w: string) => depl([...tok(strip(w))].sort((a, b) => b.length - a.length)[0] ?? "");
const casa = (a: string, b: string) => { let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return i >= 4; };

async function main() {
  const journeyId = process.argv[2];
  const j = await p.journey.findUnique({ where: { id: journeyId }, select: { topics: true } });
  const order = j?.topics ?? [];
  const st = (await p.journeyStory.findMany({
    where: { journeyId, NOT: { text: null } },
    select: { topic: true, slotIndex: true, title: true, text: true, vocab: true },
  })).sort((a, b) => (order.indexOf(a.topic) - order.indexOf(b.topic)) || (a.slotIndex - b.slotIndex));

  const words = st.map((s) => tok(String(s.text)).map(depl));
  const taught = st.map((s) => ((s.vocab as Array<{ word: string }>) ?? []).map((v) => ({ word: v.word, k: key(v.word) })));

  // Solo cuenta el reencuentro en OTRA historia: repetir dentro de la propia
  // pagina es reconocimiento inmediato, no recuerdo con esfuerzo.
  console.log("Historia|Slots|Vuelven despues|En n historias|Recoge de antes|Cuales vuelven");
  st.forEach((s, i) => {
    const vuelven: string[] = [];
    let alcance = 0;
    for (const v of taught[i]) {
      const post = words.slice(i + 1).filter((arr) => arr.some((x) => casa(x, v.k))).length;
      if (post > 0) { vuelven.push(v.word); alcance += post; }
    }
    const antes = new Set<string>();
    for (let n = 0; n < i; n++) for (const v of taught[n]) if (words[i].some((x) => casa(x, v.k))) antes.add(v.word);
    console.log([`${i + 1}. ${s.title}`, taught[i].length, vuelven.length, alcance, antes.size, vuelven.join(", ")].join("|"));
  });
  await p.$disconnect();
}
main();
