import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const r = await p.journeyStory.findMany({
    where: { journeyId: "cmsyrge55000732u9oiu8wue3", topic: { in: process.argv.slice(2) } },
    select: { topic: true, slotIndex: true, title: true, arcType: true, synopsis: true, text: true },
    orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
  });
  for (const s of r) {
    console.log(`\n===== ${s.topic}#${s.slotIndex} · ${s.title} · ${s.arcType}`);
    console.log("SINOPSIS: " + s.synopsis);
    console.log(s.text);
  }
  await p.$disconnect();
})();
