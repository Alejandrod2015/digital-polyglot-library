import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
(async () => {
  const s = await prisma.journeyStory.findFirst({ where: { slug: "el-desfile" }, select: { audioSegments: true } });
  for (const g of (s?.audioSegments as any[]) || []) if (g.text.includes("equivoco")) console.log(JSON.stringify({ t: g.text, a: g.startSec, b: g.endSec }));
})().finally(() => prisma.$disconnect());
