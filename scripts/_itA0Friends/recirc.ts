// Escalera de recirculacion del Friends IT A0 con la formula de
// journey-vocab-recirculation: historias guardadas en la base + los ficheros
// de tanda que se pasen (los reemplazan por topic#slot).
//
//   npx tsx scripts/_itA0Friends/recirc.ts [t2-data.json ...]
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { readFileSync } from "fs";
import { PrismaClient } from "../../src/generated/prisma";

const JOURNEY = "cmu0dpa3i0007j80ugstn0jf0";
const prisma = new PrismaClient();

(async () => {
  const j = await prisma.journey.findUnique({ where: { id: JOURNEY }, select: { topics: true } });
  const rows = await prisma.journeyStory.findMany({ where: { journeyId: JOURNEY, text: { not: null } }, select: { topic: true, slotIndex: true, text: true, vocab: true, title: true } });
  const byKey = new Map(rows.map((r) => [`${r.topic}#${r.slotIndex}`, r as any]));
  for (const f of process.argv.slice(2)) for (const s of JSON.parse(readFileSync(f, "utf8"))) byKey.set(`${s.topic}#${s.slotIndex}`, s);
  const order = (j!.topics as string[]);
  const stories = [...byKey.values()].sort((a, b) => order.indexOf(a.topic) - order.indexOf(b.topic) || a.slotIndex - b.slotIndex);
  const tok = (t: string) => t.toLowerCase().match(/\p{L}+/gu) ?? [];
  const cuerpos = stories.map((s) => new Set(tok(s.text)));
  const textos = stories.map((s) => String(s.text).toLowerCase());
  const clave = (v: any) => String(v.surface ?? v.word).toLowerCase().replace(/^(der|die|das|le|la|el|il|o|a)\s+/, "");
  const enc = (v: any) => {
    const k = clave(v);
    if (!k.includes(" ")) return cuerpos.filter((c) => c.has(k)).length;
    const lema = String(v.word).toLowerCase();
    return textos.filter((t) => t.includes(k) || t.includes(lema)).length;
  };
  const todas: Array<{ w: string; n: number; anchor: boolean; where: string }> = [];
  const vocabCount = new Map<string, number>();
  for (const s of stories) for (const v of s.vocab ?? []) {
    todas.push({ w: String(v.surface ?? v.word), n: enc(v), anchor: !!v.anchor, where: `${order.indexOf(s.topic) + 1}.${s.slotIndex + 1}` });
    vocabCount.set(String(v.word), (vocabCount.get(String(v.word)) ?? 0) + 1);
  }
  const port = todas.filter((x) => !x.anchor);
  const anc = todas.filter((x) => x.anchor);
  const media = port.reduce((a, b) => a + b.n, 0) / (port.length || 1);
  const solas = port.filter((x) => x.n <= 1);
  console.log(`${stories.length} historias · portables ${port.length} media ${media.toFixed(2)} (suelo A0 2,5) · cola ${solas.length}/${port.length} (${Math.round(100 * solas.length / (port.length || 1))}%, tope 30%) · ancladas ${anc.length}/${todas.length} (${Math.round(100 * anc.length / (todas.length || 1))}%, tope 30%)`);
  console.log("un solo encuentro:", solas.map((x) => `${x.w}(${x.where})`).join(", "));
  const dos = port.filter((x) => x.n === 2);
  console.log("dos encuentros:", dos.map((x) => `${x.w}(${x.where})`).join(", "));
  const rep = [...vocabCount].filter(([, n]) => n > 1);
  if (rep.length) console.log("vocab en mas de una historia:", rep.map(([w, n]) => `${w} x${n}`).join(", "));
  await prisma.$disconnect();
})();
