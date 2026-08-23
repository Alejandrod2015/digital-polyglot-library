/**
 * Qué palabras tienen segundo encuentro dentro de su propia historia, y con qué
 * formas exactas. Sirve para auditar a mano los falsos positivos del
 * emparejamiento por prefijo. Solo lectura.
 *
 *   npx tsx scripts/_ladderWhich.ts <journeyId> <indice de historia, 1..n>
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
  const [journeyId, idxRaw] = process.argv.slice(2);
  const j = await p.journey.findUnique({ where: { id: journeyId }, select: { topics: true } });
  const order = j?.topics ?? [];
  const st = (await p.journeyStory.findMany({
    where: { journeyId, NOT: { text: null } },
    select: { topic: true, slotIndex: true, title: true, text: true, vocab: true },
  })).sort((a, b) => (order.indexOf(a.topic) - order.indexOf(b.topic)) || (a.slotIndex - b.slotIndex));
  const s = st[Number(idxRaw) - 1];
  const raw = tok(String(s.text));
  const stems = raw.map(depl);
  console.log(`${s.title}\n`);
  for (const v of ((s.vocab as Array<{ word: string }>) ?? [])) {
    const k = key(v.word);
    const formas = raw.filter((_, n) => casa(stems[n], k));
    if (formas.length >= 2) console.log(`  ${v.word.padEnd(16)} ${formas.length}x  ->  ${formas.join(", ")}`);
  }
  await p.$disconnect();
}
main();
