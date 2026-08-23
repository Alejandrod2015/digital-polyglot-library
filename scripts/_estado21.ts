import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const r = await p.journeyStory.findMany({
    where: { journeyId: "cmsyrge55000732u9oiu8wue3" },
    select: { topic: true, slotIndex: true, slug: true, wordCount: true, vocab: true },
    orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
  });
  for (const s of r) {
    const v = (s.vocab as Array<{ anchor?: boolean }>) ?? [];
    console.log(s.topic, s.slotIndex, s.wordCount, v.length, "anc", v.filter((x) => x.anchor).length);
  }
  await p.$disconnect();
})();
