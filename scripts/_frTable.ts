/**
 * La tabla del Expat FR A0 con TODAS las columnas: escalera de recirculación
 * (`_ladderTable`) + estado de producción (`_frSheet`), en una fila por
 * historia y con el enlace al lector local. Solo lectura.
 *
 *   npx tsx scripts/_frTable.ts
 */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const ID = "cmt09ehi60000320qf9efrypu";
const tok = (s: string) => (s.toLowerCase().match(/\p{L}+/gu) ?? []);
const strip = (w: string) => w.replace(/^(le|la|les|l'|un|une|des|du|de)\s+/i, "").trim();
const depl = (w: string) => (w.length > 3 && /(?:es|s|x)$/.test(w) ? w.replace(/(?:es|s|x)$/, "") : w);
const key = (w: string) => depl([...tok(strip(w))].sort((a, b) => b.length - a.length)[0] ?? "");
const casa = (a: string, b: string) => { let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return i >= 4; };

(async () => {
  const j = await p.journey.findUnique({ where: { id: ID }, select: { topics: true } });
  const order = j?.topics ?? [];
  const st = (await p.journeyStory.findMany({
    where: { journeyId: ID, NOT: { text: null } },
    select: { slug: true, title: true, topic: true, slotIndex: true, text: true, vocab: true,
              coverUrl: true, audioUrl: true, voiceId: true,
              practiceSet: { select: { exercises: { select: { id: true } } } } },
  })).sort((a, b) => (order.indexOf(a.topic) - order.indexOf(b.topic)) || (a.slotIndex - b.slotIndex));

  const words = st.map((s) => tok(String(s.text)).map(depl));
  const taught = st.map((s) => ((s.vocab as Array<{ word: string }>) ?? []).map((v) => ({ word: v.word, k: key(v.word) })));

  console.log("#|historia|slug|palabras|slots|vuelven despues|en n historias|recoge de antes|practica|glosas|portada|voz|audio|cuales vuelven");
  st.forEach((s, i) => {
    const vuelven: string[] = [];
    let alcance = 0;
    for (const v of taught[i]) {
      const post = words.slice(i + 1).filter((arr) => arr.some((x) => casa(x, v.k))).length;
      if (post > 0) { vuelven.push(v.word); alcance += post; }
    }
    const antes = new Set<string>();
    for (let n = 0; n < i; n++) for (const v of taught[n]) if (words[i].some((x) => casa(x, v.k))) antes.add(v.word);
    const ex = (s.practiceSet?.exercises ?? []).length;
    console.log([i + 1, s.title, s.slug, String(s.text ?? "").split(/\s+/).length, taught[i].length,
      vuelven.length, alcance, antes.size, ex ? `${ex} ex` : "-", "si",
      s.coverUrl ? "si" : "-", s.voiceId ? "si" : "-", s.audioUrl ? "si" : "-",
      vuelven.join(", ") || "-"].join("|"));
  });
  await p.$disconnect();
})();
