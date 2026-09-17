import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  for (const [title, from, to] of [["Los aguanto de dos en dos", 74, 82]] as Array<[string, number, number]>) {
    const s = await p.journeyStory.findFirst({ where: { title }, select: { audioWordTimings: true } });
    const w = (s?.audioWordTimings as unknown as { words: Array<{ text: string; startSec: number; endSec: number }> }).words;
    const start = w[from].startSec + 0.45;
    console.log("====", title, "start", start.toFixed(2));
    for (let i = from; i <= to; i++) console.log(`${i - from}\t${i}\t${w[i].text}\t${(w[i].startSec - start).toFixed(2)}\t${(w[i].endSec - start).toFixed(2)}`);
  }
  await p.$disconnect();
})();
