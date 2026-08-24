import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const rows = await p.journeyStory.findMany({
    where: { journeyId: "cmsyrge55000732u9oiu8wue3" },
    select: { slug: true, topic: true, slotIndex: true, arcType: true },
    orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
  });
  for (const r of rows) console.log(`${r.topic}\t${r.slotIndex}\t${r.arcType}\t${r.slug}`);
  await p.$disconnect();
})();
