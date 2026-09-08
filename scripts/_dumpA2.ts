import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { extractStoryPlainText } from "../src/lib/storyPlainText";
const p = new PrismaClient();
(async () => {
  const j = await p.journey.findUnique({ where: { id: "cmtmylg7k0007321h6t7njesx" }, select: { topics: true } });
  const st = (await p.journeyStory.findMany({
    where: { journeyId: "cmtmylg7k0007321h6t7njesx" },
    select: { slug: true, title: true, text: true, topic: true, slotIndex: true, arcType: true },
  })).sort((a, b) => (j!.topics.indexOf(a.topic) - j!.topics.indexOf(b.topic)) || (a.slotIndex - b.slotIndex));
  for (const s of st) {
    console.log(`\n===== [${s.topic} #${s.slotIndex}] ${s.title} (${s.slug}) arco:${s.arcType ?? "-"} =====`);
    console.log(extractStoryPlainText(String(s.text ?? "")));
  }
  await p.$disconnect();
})();
