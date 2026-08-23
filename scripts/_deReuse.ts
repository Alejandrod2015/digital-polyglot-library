/** Para reescribir un cuerpo reusando lo ya enseñado: palabras que son plaza de
 *  vocab en OTRAS historias y no aparecen en esta, agrupadas por tipo. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const j = await p.journey.findUnique({ where: { id: "cmt0a8vb1000m32p1x7r5ba28" }, select: { topics: true } });
  const orden = j?.topics ?? [];
  const st = (await p.journeyStory.findMany({
    where: { journeyId: "cmt0a8vb1000m32p1x7r5ba28" },
    select: { slug: true, topic: true, slotIndex: true, text: true, vocab: true },
  })).sort((a, b) => (orden.indexOf(a.topic) - orden.indexOf(b.topic)) || (a.slotIndex - b.slotIndex));
  const tok = (t: string) => new Set((String(t).toLowerCase().match(/\p{L}+/gu) ?? []));
  const sf = (v: any) => String(v.surface ?? v.word);
  const n = Number(process.argv[2] ?? 0);
  const yo = st[n - 1];
  const mio = tok(yo.text);
  const otras = st.flatMap((s, i) => i === n - 1 ? [] : ((s.vocab as any[]) ?? []).map((v) => ({ ...v, de: i + 1 })));
  const ausentes = otras.filter((v) => !mio.has(sf(v).toLowerCase()));
  const porTipo = new Map<string, string[]>();
  for (const v of ausentes) {
    const k = String(v.type);
    porTipo.set(k, [...(porTipo.get(k) ?? []), `${sf(v)}(${v.de})`]);
  }
  console.log(`=== ${n}. ${yo.slug} · ${mio.size} palabras distintas · faltan ${ausentes.length} de las enseñadas en otras\n`);
  for (const [k, v] of porTipo) console.log(`${k}: ${v.join(" ")}\n`);
  console.log("--- cuerpo ---\n" + yo.text);
  await p.$disconnect();
})();
