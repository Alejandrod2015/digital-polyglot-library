import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const st = await p.journeyStory.findMany({ where: { journeyId: "cmtmylg7k0007321h6t7njesx" }, orderBy: [{ topic: "asc" }, { slotIndex: "asc" }], select: { topic: true, slotIndex: true, arcType: true, synopsis: true } });
  for (const s of st) console.log(`${s.topic}#${s.slotIndex} ${s.arcType} :: ${s.synopsis?.slice(0,80)}`);
  await p.$disconnect();
})();
