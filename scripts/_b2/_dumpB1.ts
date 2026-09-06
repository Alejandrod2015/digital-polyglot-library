import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const st = await p.journeyStory.findMany({
    where: { journeyId: "cmtmylg7k0007321h6t7njesx" },
    orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
    select: { topic: true, slotIndex: true, title: true, slug: true, status: true, text: true },
  });
  console.log("historias:", st.length, "| con texto:", st.filter(s=>s.text).length);
  for (const s of st) console.log(`${s.topic} #${s.slotIndex} [${s.status}] ${s.title ?? "-"} (${s.slug ?? "-"}) ${s.text ? s.text.split(/\s+/).length + "w" : "VACIA"}`);
  await p.$disconnect();
})();
