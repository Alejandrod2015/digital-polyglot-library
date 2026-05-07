import { config } from "dotenv";
import { PrismaClient } from "../src/generated/prisma";
config({ path: ".env.local" });
config({ path: ".env" });

async function run() {
  const prisma = new PrismaClient();
  const j = await prisma.journey.findFirst({
    where: { language: { equals: "italian", mode: "insensitive" } },
    include: { stories: { orderBy: [{ level: "asc" }, { topic: "asc" }, { slotIndex: "asc" }], where: { status: "published" } } },
  });
  if (!j) { console.log("No italian journey"); process.exit(0); }
  console.log(`Journey ${j.name} | topics field: ${JSON.stringify(j.topics)}`);
  console.log(`Levels: ${JSON.stringify(j.levels)}`);
  console.log(`\nStories in journey order:`);
  for (const s of j.stories) {
    console.log(`  ${s.level}/${s.topic}/[${s.slotIndex}] id=${s.id} slug=${s.slug} title=${s.title}`);
  }
  await prisma.$disconnect();
}
run().catch(e => { console.error(e); process.exit(1); });
