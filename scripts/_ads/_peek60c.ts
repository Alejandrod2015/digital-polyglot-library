import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const s = await p.journeyStory.findFirst({ where: { title: "Aquí se dice arrendando" }, select: { audioWordTimings: true } });
  const w = (s?.audioWordTimings as unknown as { words: Array<{ text: string; startSec: number; endSec: number }> }).words;
  const start = w[35].startSec - 0.25;
  for (let i = 35; i <= 62; i++) console.log(`${i - 35}\t${w[i].text}\t${(w[i].startSec - start).toFixed(2)}\t${(w[i].endSec - start).toFixed(2)}\tgap:${(w[i + 1] ? w[i + 1].startSec - w[i].endSec : 0).toFixed(2)}`);
  await p.$disconnect();
})();
