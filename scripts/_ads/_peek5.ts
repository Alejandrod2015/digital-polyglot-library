import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const s = await p.journeyStory.findFirst({ where: { title: "El gallo colorado" }, select: { vocab: true, practiceSet: { select: { exercises: { select: { type: true, word: true, sentence: true, payload: true } } } } } });
  for (const v of (s?.vocab as unknown as Array<{ word: string; type: string; surface?: string; definition: string }>)) if (/fia|fío|fio/i.test(v.word + (v.surface || ""))) console.log("VOCAB:", JSON.stringify(v));
  for (const e of s?.practiceSet?.exercises || []) if (/fiado/i.test(e.word)) console.log(e.type, "|", e.sentence, "|", JSON.stringify(e.payload));
  await p.$disconnect();
})();
