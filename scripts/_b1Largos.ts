import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const ss = await p.journeyStory.findMany({ where: { journeyId: process.argv[2], NOT: { text: null } }, orderBy: [{ topic: "asc" }, { slotIndex: "asc" }], select: { topic: true, slotIndex: true, title: true, wordCount: true } });
  for (const s of ss) {
    const wc = s.wordCount ?? 0;
    const banda = wc < 100 || wc > 190 ? "FUERA (duro 100-190)" : wc < 115 || wc > 170 ? "fuera del blando 115-170" : "ok";
    console.log(`${s.topic}#${s.slotIndex}  ${String(wc).padStart(3)}  ${banda}  ${s.title}`);
  }
  await p.$disconnect();
})();
