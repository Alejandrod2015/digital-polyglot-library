import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  for (const title of ["La once con chirrido", "El gallo colorado"]) {
    const s = await p.journeyStory.findFirst({ where: { title }, select: { audioSegments: true } });
    const segs = s?.audioSegments as unknown as Array<{ index: number; text: string; startSec: number; endSec: number }>;
    console.log("====", title);
    for (const g of segs) console.log(`${g.index}\t${g.startSec.toFixed(2)}-${g.endSec.toFixed(2)}\t${g.text.slice(0, 80)}`);
  }
  await p.$disconnect();
})();
