import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
(async () => {
  // distinct story-level per spanish/latam journey
  const js = await prisma.journey.findMany({ where: { language: "spanish" }, select: { id: true, name: true, variant: true, levels: true, status: true } });
  for (const j of js) {
    const levels = await prisma.journeyStory.groupBy({ by: ["level"], where: { journeyId: j.id }, _count: true });
    console.log(`${j.name} (${j.variant}, ${j.status}) journey.levels=[${j.levels}]  story-levels: ${levels.map(l=>`${l.level}:${l._count}`).join("  ")}`);
  }
  await prisma.$disconnect();
})().catch(e=>{console.log("FATAL",e.message);process.exit(1);});
