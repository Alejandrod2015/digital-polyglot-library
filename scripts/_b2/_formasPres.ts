/** Detalle de los checks de presentacion y apertura del B2 latam (base o fichero de tema sustituido):
 *  npx tsx scripts/_b2/_formasPres.ts [tNcorto.json ...] */
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
  for (const f of process.argv.slice(2)) for (const s of JSON.parse(fs.readFileSync(f, "utf8"))) db = db.map((d) => (d.slug === s.slug ? { ...d, text: s.text } : d));
  const r = validateJourneyStories(db.map((s) => ({ slug: s.slug, title: s.title, text: s.text, language: "ES", level: "b2", vocab: s.vocab as any, topic: s.topic })),
    { language: "ES", level: "b2", conjuntoCompleto: true, journeyId: J, journeyType: j?.typeSlug ?? "traveler" });
  for (const c of r) if (/introduction|opening-shape/.test(c.id)) console.log(`[${c.status}] ${c.id}: ${c.detail ?? ""}`);
  await p.$disconnect();
})();
