import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const st = await p.journeyStory.findMany({ where: { journeyId: "cmtplpfum0007j8c6piegwt31", topic: "locals-and-outsiders" }, orderBy: { slotIndex: "asc" }, select: { slotIndex: true, title: true, slug: true, text: true } });
  for (const s of st) console.log(`\n### ${s.slotIndex} · ${s.title} (${s.slug})\n${s.text}`);
  await p.$disconnect();
})();
