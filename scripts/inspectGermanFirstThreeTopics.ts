import { config } from "dotenv";
import { PrismaClient } from "../src/generated/prisma";
config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const prisma = new PrismaClient();
  const journey = await prisma.journey.findFirst({
    where: {
      language: { equals: "german", mode: "insensitive" },
      name: { equals: "Conversacional", mode: "insensitive" },
    },
  });
  if (!journey) throw new Error("not found");
  const firstThree = journey.topics.slice(0, 3);
  console.log(`First 3 topics: ${firstThree.join(", ")}`);
  const stories = await prisma.journeyStory.findMany({
    where: { journeyId: journey.id, topic: { in: firstThree }, status: "published" },
    orderBy: [{ topic: "asc" }, { level: "asc" }, { slotIndex: "asc" }],
    select: { topic: true, level: true, slotIndex: true, title: true, coverUrl: true },
  });
  for (const s of stories) {
    const has = s.coverUrl ? "Y" : "N";
    console.log(`${s.topic.padEnd(28)} L${s.level} slot${s.slotIndex}  cover=${has}  ${s.title}`);
  }
  console.log(`Total: ${stories.length} stories`);
  await prisma.$disconnect();
}
main().catch(console.error);
