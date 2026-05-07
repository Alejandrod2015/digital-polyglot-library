import { config } from "dotenv";
import { PrismaClient } from "../src/generated/prisma";
config({ path: ".env.local" });
config({ path: ".env" });

async function run() {
  const prisma = new PrismaClient();
  const journeys = await prisma.journey.findMany({
    select: { id: true, name: true, language: true, variant: true, levels: true, _count: { select: { stories: true } } },
    orderBy: [{ language: "asc" }, { variant: "asc" }],
  });
  for (const j of journeys) {
    console.log(`${j.language.padEnd(12)} ${j.variant.padEnd(20)} ${j.name.padEnd(30)} levels=${j.levels.length} stories=${j._count.stories}`);
  }
  await prisma.$disconnect();
}
run().catch(console.error);
