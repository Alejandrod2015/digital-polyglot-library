import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const st = await p.journeyStory.findMany({
    where: { journeyId: process.argv[2] },
    orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
    select: { topic: true, slotIndex: true, title: true, text: true },
  });
  for (const s of st) console.log(`\n===== [${s.topic} #${s.slotIndex}] ${s.title} =====\n${s.text}`);
  await p.$disconnect();
})();
