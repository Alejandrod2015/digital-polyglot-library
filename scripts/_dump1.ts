import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import fs from "node:fs";
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const s = await p.journeyStory.findFirst({ where: { slug: "el-plan-de-nuria" },
    select: { topic: true, slotIndex: true, title: true, slug: true, synopsis: true, text: true, vocab: true, arcType: true, journeyId: true } });
  fs.writeFileSync("scripts/_story.json", JSON.stringify([s], null, 1));
  console.log("journeyId:", s?.journeyId, "| topic:", s?.topic, "| slot:", s?.slotIndex);
  console.log("vocab:", (s?.vocab as any[]).map((v) => v.word).join(", "));
  await p.$disconnect();
})();
