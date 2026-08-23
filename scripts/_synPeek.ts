import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const rows = await p.journeyStory.findMany({
    where: { status: "published", synopsis: { not: null } },
    select: { title: true, synopsis: true, topic: true, slotIndex: true, journey: { select: { name: true, language: true, topics: true } } },
    take: 6,
  });
  for (const r of rows) console.log(`[${r.journey?.language}] ${r.title} (${r.topic} #${r.slotIndex})\n   ${r.synopsis}\n`);
  const n = await p.journeyStory.count({ where: { status: "published" } });
  const withSyn = await p.journeyStory.count({ where: { status: "published", synopsis: { not: null } } });
  console.log("publicadas:", n, "| con sinopsis:", withSyn);
})().finally(() => p.$disconnect());
