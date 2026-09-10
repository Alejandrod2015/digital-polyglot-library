/** Las 21 en orden de lectura, enteras, para leerlas seguidas como el usuario
 *  final. Solo lectura. */
import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const J = "cmtrcpgso00073232h8vaf7na";
const p = new PrismaClient();
(async () => {
  const j = await p.journey.findUnique({ where: { id: J }, select: { topics: true } });
  const ss = await p.journeyStory.findMany({
    where: { journeyId: J, NOT: { text: null } },
    select: { slug: true, title: true, text: true, topic: true, slotIndex: true, arcType: true },
  });
  ss.sort((a, b) => (j!.topics.indexOf(a.topic!) - j!.topics.indexOf(b.topic!)) || a.slotIndex - b.slotIndex);
  ss.forEach((s, i) => {
    const pal = (s.text!.match(/[A-Za-zÀ-ÿ']+/g) ?? []).length;
    console.log(`\n───── ${i + 1}. ${s.title}  [${s.topic} · ${s.arcType} · ${pal} pal.]`);
    console.log(s.text);
  });
  await p.$disconnect();
})();
