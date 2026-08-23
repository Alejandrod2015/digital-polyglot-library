import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const A0 = "cmqrtaj1p000032qtda86z6um";
(async () => {
  const j = await p.journey.findUnique({ where: { id: A0 } });
  const orden = j!.topics;
  const st = await p.journeyStory.findMany({ where: { journeyId: A0 } });
  st.sort((a,b) => (orden.indexOf(a.topic)-orden.indexOf(b.topic)) || (a.slotIndex-b.slotIndex));
  for (const s of st) {
    console.log(`\n\n##### ${s.topic}#${s.slotIndex}: ${s.title}`);
    console.log(`SINOPSIS: ${s.synopsis}`);
    console.log(s.text);
  }
  await p.$disconnect();
})();
