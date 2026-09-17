import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const s = await p.journeyStory.findFirst({ where: { title: "El gallo colorado" }, select: { text: true, vocab: true, audioWordTimings: true, journey: { select: { variant: true, status: true, typeSlug: true, levels: true } } } });
  console.log(JSON.stringify(s?.journey));
  console.log((s?.text || "").slice(0, 700));
  const w = (s?.audioWordTimings as unknown as { words: Array<{ text: string; startSec: number; endSec: number }> }).words;
  console.log(w.map((x, i) => `${i}:${x.text}`).join(" ").slice(0, 1200));
  await p.$disconnect();
})();
