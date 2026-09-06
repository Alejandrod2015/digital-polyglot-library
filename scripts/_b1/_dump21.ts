import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "node:fs";
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const ss = await p.journeyStory.findMany({
    where: { journeyId: "cmt5x67ze000l320cpgunu5vi" },
    select: { topic: true, slotIndex: true, slug: true, title: true, text: true, arcType: true, vocab: true },
    orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
  });
  fs.writeFileSync("scripts/_b1/21.json", JSON.stringify(ss, null, 1));
  console.log("historias:", ss.length);
  await p.$disconnect();
})();
