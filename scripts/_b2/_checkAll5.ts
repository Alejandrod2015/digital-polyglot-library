/** Todos los checks de journey, base vs con las 5 correcciones de presentacion aplicadas:
 *  npx tsx scripts/_b2/_checkAll5.ts <fichero.json...> */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import fs from "node:fs";
import { PrismaClient } from "../../src/generated/prisma";
import { validateJourneyStories } from "../../src/lib/validateJourneyStories";
const J = "cmtpls1l20007j8epwgcs6e1h";
const p = new PrismaClient();
(async () => {
  const j = await p.journey.findUnique({ where: { id: J }, select: { topics: true, typeSlug: true } });
  const orden = ((j?.topics ?? []) as any[]).map((t) => (typeof t === "string" ? t : t.slug ?? t.id));
  let db = await p.journeyStory.findMany({ where: { journeyId: J }, select: { slug: true, title: true, text: true, topic: true, slotIndex: true, vocab: true } });
  db.sort((a, b) => orden.indexOf(a.topic) - orden.indexOf(b.topic) || a.slotIndex - b.slotIndex);
  const mk = (arr: any[]) => arr.map((s) => ({ slug: s.slug, title: s.title, text: s.text, language: "ES", level: "b2", vocab: s.vocab as any, topic: s.topic }));
  const ctx = { language: "ES", level: "b2", conjuntoCompleto: true, journeyId: J, journeyType: j?.typeSlug ?? "traveler" };
  const antes = validateJourneyStories(mk(db), ctx);
  let after = [...db];
  for (const f of process.argv.slice(2)) for (const s of JSON.parse(fs.readFileSync(f, "utf8"))) after = after.map((d) => (d.slug === s.slug ? { ...d, text: s.text } : d));
  const despues = validateJourneyStories(mk(after), ctx);
  let cambios = 0;
  for (const c of despues) {
    const a = antes.find((x) => x.id === c.id);
    if (!a || a.status !== c.status) { cambios++; console.log(`[${a?.status ?? "-"} -> ${c.status}] ${c.id}\n    ${(c.detail ?? "").slice(0, 300)}`); }
  }
  console.log(cambios ? `${cambios} cambio(s) de estado` : "0 cambios de estado en ningun check de journey");
  await p.$disconnect();
})();
