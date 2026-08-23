/** Las 21 del A1 latam seguidas, en orden de lectura, para leerlas como el
 *  alumno y no por la ficha. */
import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const A1 = "cmt5vxwgd0007324oesy195k8";
(async () => {
  const j = await p.journey.findUnique({ where: { id: A1 } });
  const orden = j!.topics;
  const st = await p.journeyStory.findMany({ where: { journeyId: A1 },
    select: { title: true, text: true, topic: true, slotIndex: true } });
  st.sort((a, b) => (orden.indexOf(a.topic) - orden.indexOf(b.topic)) || (a.slotIndex - b.slotIndex));
  st.forEach((s, i) => { console.log(`\n═══ ${i + 1}. ${s.title}  (${s.topic})\n`); console.log(s.text); });
  await p.$disconnect();
})();
