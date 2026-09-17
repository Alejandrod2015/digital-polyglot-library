import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const s = await p.journeyStory.findFirst({ where: { title: "El gallo colorado" }, select: { vocab: true } });
  for (const v of (s?.vocab as unknown as Array<{ word: string; definition: string }>)) if (v.word === "dar fiado") console.log(JSON.stringify(v.definition));
  await p.$disconnect();
})();
