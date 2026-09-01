import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { createRequire } from "module";
const __req = createRequire(__filename);
try { const q = __req.resolve("server-only"); (__req as any).cache[q] = { id:q, filename:q, loaded:true, exports:{} }; } catch {}
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const REPARTO = ["journey-cast-fixed-max-two","journey-cast-protagonist-in-all",
                 "journey-cast-one-new-per-topic","journey-cast-first-story-only-fixed"];
(async () => {
  const { validateJourneyStories } = await import("@/lib/validateJourneyStories");
  const js = await p.journey.findMany({ where: { status: "active" },
    select: { id: true, language: true, levels: true, typeSlug: true, topics: true } });
  for (const j of js) {
    const filas = (await p.journeyStory.findMany({ where: { journeyId: j.id, NOT: { text: null } },
      select: { slug: true, title: true, text: true, vocab: true, topic: true, slotIndex: true } }))
      .sort((a,b) => (j.topics.indexOf(a.topic)-j.topics.indexOf(b.topic)) || (a.slotIndex-b.slotIndex));
    if (filas.length < 7) continue;
    const st = filas.map(f => ({ slug: f.slug!, title: f.title ?? "", text: f.text!,
      vocab: f.vocab as never, language: j.language, level: j.levels[0] ?? "", topic: f.topic }));
    const cs = validateJourneyStories(st, { language: j.language, level: j.levels[0] ?? "" })
      .filter(c => REPARTO.includes(c.id));
    const malos = cs.filter(c => c.status !== "pass");
    const cab = `${j.language}/${j.levels[0]} ${j.typeSlug} (${filas.length})`;
    console.log(`\n${cab.padEnd(38)} ${malos.length ? `${malos.length} en rojo` : "las 4 en verde"}`);
    for (const c of malos) console.log(`   ${c.status.toUpperCase()} [${c.id}] ${c.detail ?? ""}`);
  }
})().finally(() => p.$disconnect());
