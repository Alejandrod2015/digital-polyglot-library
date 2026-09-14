import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../../src/generated/prisma";
import { validateJourneyStories } from "../../src/lib/validateJourneyStories";
const p = new PrismaClient();
(async () => {
  const j = await p.journey.findUniqueOrThrow({ where: { id: "cmu047bkz0007326jsgeptkox" }, select: { topics: true } });
  const rows = await p.journeyStory.findMany({ where: { journeyId: "cmu047bkz0007326jsgeptkox" }, select: { slug: true, title: true, text: true, vocab: true, topic: true, slotIndex: true } });
  rows.sort((a, b) => j.topics.indexOf(a.topic) - j.topics.indexOf(b.topic) || a.slotIndex - b.slotIndex);
  const st = rows.map((r) => ({ slug: r.slug!, title: r.title!, text: r.text!, language: "DE", level: "a0", vocab: r.vocab as any, topic: r.topic }));
  for (const c of validateJourneyStories(st, { language: "DE", level: "a0", conjuntoCompleto: true, journeyType: "relationships", journeyId: "cmu047bkz0007326jsgeptkox" }))
    if (/recirculation|form-variety|opening-shape|repeated-opener|closing|cast|quoted/.test(c.id)) console.log(c.status, c.id, c.detail ?? "", c.label);
  await p.$disconnect();
})();
