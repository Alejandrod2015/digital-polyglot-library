import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const s = await p.journeyStory.findFirst({ where: { journeyId: "cmsou2uk0000732mqa4oatcmn" }, select: { title: true, text: true }, orderBy: { slotIndex: "asc" } });
  console.log(s?.title); console.log(s?.text);
  await p.$disconnect();
})();
