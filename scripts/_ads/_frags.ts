import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  for (const title of ["La once con chirrido", "El gallo colorado"]) {
    const s = await p.journeyStory.findFirst({ where: { title }, select: { audioFragments: true } });
    const fr = s?.audioFragments as unknown as Array<{ index: number; text: string; startSec: number; endSec: number; url: string; speaker: string }>;
    console.log("====", title, fr.length, "fragmentos");
    for (const f of fr) console.log(`${f.index}\t${f.startSec.toFixed(2)}-${f.endSec.toFixed(2)}\t${f.speaker}\t${f.text.slice(0, 70)}`);
  }
  await p.$disconnect();
})();
