import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const s = await p.journeyStory.findFirst({ where: { journeyId: process.argv[2], slug: process.argv[3] }, select: { title: true, slug: true, synopsis: true, text: true, vocab: true, arcType: true, topic: true, slotIndex: true } });
  console.log(JSON.stringify(s, null, 1));
  await p.$disconnect();
})();
