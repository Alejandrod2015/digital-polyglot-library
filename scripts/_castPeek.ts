import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const n = await p.journeyStory.count({ where: { status: "published" } });
  const withCast = await p.journeyStory.count({ where: { status: "published", cast: { not: null } } });
  const withWc = await p.journeyStory.count({ where: { status: "published", wordCount: { not: null } } });
  console.log("publicadas:", n, "| con cast:", withCast, "| con wordCount:", withWc);
  const rows = await p.journeyStory.findMany({ where: { status: "published", cast: { not: null } }, select: { title: true, cast: true, wordCount: true }, take: 3 });
  for (const r of rows) console.log(r.title, "|", r.wordCount, "palabras |", JSON.stringify(r.cast).slice(0, 260));
})().finally(() => p.$disconnect());
