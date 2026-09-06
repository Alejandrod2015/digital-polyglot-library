import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const slugs = process.argv.slice(2);
  const st = await p.journeyStory.findMany({
    where: { journeyId: "cmtmylg7k0007321h6t7njesx", slug: { in: slugs } },
    select: { topic: true, slotIndex: true, title: true, text: true, synopsis: true, vocab: true },
  });
  for (const s of st) {
    console.log(`\n======== ${s.topic} #${s.slotIndex}: ${s.title}\n${s.text}`);
    const v = (s.vocab as any[]) ?? [];
    console.log(`--- vocab (${v.length}): ${v.map((x)=>x.word).join(", ")}`);
  }
  await p.$disconnect();
})();
