/** Para cada set curado: ejercicios huerfanos (su palabra ya no se enseña) y
 *  plazas sin ejercicio, con una clausula del propio cuerpo donde sale. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import * as fs from "fs";
const p = new PrismaClient();
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const firstTok = (s: string) => norm(s).split(/\s+/)[0] ?? "";
const pref = (a: string, b: string) => { let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return i; };
const cubre = (t: string, w: string, sf: string) => {
  const a = norm(t); if (a === norm(w) || a === norm(sf)) return true;
  const ta = firstTok(a), tb = firstTok(norm(w));
  return pref(ta, tb) >= Math.max(3, Math.min(ta.length, tb.length) - 3);
};
(async () => {
  const j = await p.journey.findUnique({ where: { id: "cmt0a8vb1000m32p1x7r5ba28" }, select: { topics: true } });
  const orden = j?.topics ?? [];
  const st = (await p.journeyStory.findMany({
    where: { journeyId: "cmt0a8vb1000m32p1x7r5ba28" },
    select: { slug: true, topic: true, slotIndex: true, text: true, vocab: true },
  })).sort((a, b) => (orden.indexOf(a.topic) - orden.indexOf(b.topic)) || (a.slotIndex - b.slotIndex));
  for (const s of st) {
    const exs = JSON.parse(fs.readFileSync(`scripts/_sets/${s.slug}.json`, "utf8")) as any[];
    const objetivo = exs.flatMap((e) => String(e.word).split(","));
    const voc = ((s.vocab as any[]) ?? []);
    const sin = voc.filter((v) => !objetivo.some((t) => cubre(t, String(v.word), String(v.surface ?? v.word))));
    const huerf = exs.filter((e) => e.type !== "match_meaning" &&
      !voc.some((v) => cubre(String(e.word), String(v.word), String(v.surface ?? v.word))));
    if (!sin.length && !huerf.length) continue;
    console.log(`\n=== ${s.slug}`);
    if (huerf.length) console.log(`  FUERA (${huerf.length}): ${huerf.map((e) => e.word).join(", ")}`);
    for (const v of sin) {
      const sf = String(v.surface ?? v.word);
      const cl = String(s.text).replace(/\s*\n+\s*/g, " ").split(/(?<=[.!?”])\s+/)
        .find((f) => new RegExp(`\\b${sf}\\b`, "u").test(f) && !/[“”]/.test(f)) ?? "";
      console.log(`  FALTA ${String(v.word).padEnd(16)} [${sf}] ${String(v.type).padEnd(10)} ${v.definition}`);
      console.log(`        ${cl}`);
    }
  }
  await p.$disconnect();
})();
