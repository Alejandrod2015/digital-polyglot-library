import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
(async () => {
  const hits = await prisma.journeyStory.findMany({
    where: { text: { contains: "244" }, journey: { language: "german" } },
    select: { slug: true, audioStatus: true, text: true } });
  for (const h of hits) {
    const lines = h.text.split("\n").filter((l) => l.includes("244"));
    console.log(h.slug, `(audio: ${h.audioStatus})`);
    for (const l of lines) console.log("   ", l.slice(0, 140));
  }
  if (!hits.length) {
    const any = await prisma.journeyStory.findMany({
      where: { text: { contains: "B 2" }, journey: { language: "german" } },
      select: { slug: true } });
    console.log("sin 244; con 'B 2':", any.map((a) => a.slug));
  }
  await prisma.$disconnect();
})();
