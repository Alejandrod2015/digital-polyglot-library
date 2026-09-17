import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const s = await p.journeyStory.findFirst({ where: { title: "Aquí se dice arrendando" }, select: { vocab: true, audioWordTimings: true } });
  const tim = s?.audioWordTimings as unknown as { words: Array<{ text: string; startSec: number; endSec: number }>; audioDurationSec: number };
  const w = tim.words;
  console.log("total", w.length, "dur", tim.audioDurationSec);
  console.log(w.slice(20, 95).map((x, i) => `${i + 20}:${x.text}@${x.startSec.toFixed(2)}`).join("  "));
  console.log("\nVOCAB:", (s?.vocab as unknown as Array<{ word: string; type: string; surface?: string; definition: string }>).map((v) => `${v.type}|${v.word}|${v.surface || ""}|${v.definition.slice(0, 55)}`).join("\n"));
  await p.$disconnect();
})();
