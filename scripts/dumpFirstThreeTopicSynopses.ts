import { config } from "dotenv";
import { PrismaClient } from "../src/generated/prisma";
config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const prisma = new PrismaClient();
  const journey = await prisma.journey.findFirst({
    where: { language: { equals: "german", mode: "insensitive" }, name: { equals: "Conversacional", mode: "insensitive" } },
  });
  if (!journey) throw new Error("not found");
  const firstThree = journey.topics.slice(0, 3);
  const stories = await prisma.journeyStory.findMany({
    where: { journeyId: journey.id, topic: { in: firstThree }, status: "published" },
    orderBy: [{ topic: "asc" }, { level: "asc" }, { slotIndex: "asc" }],
    select: { id: true, title: true, synopsis: true, topic: true, slotIndex: true },
  });
  for (const s of stories) {
    console.log("---");
    console.log(`ID: ${s.id}`);
    console.log(`TITLE: ${s.title}`);
    console.log(`TOPIC: ${s.topic} slot${s.slotIndex}`);
    console.log(`SYNOPSIS: ${s.synopsis}`);
  }
  await prisma.$disconnect();
}
main().catch(console.error);
