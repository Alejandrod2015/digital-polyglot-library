import { config } from "dotenv";
import { PrismaClient } from "../src/generated/prisma";
config({ path: ".env.local" });
config({ path: ".env" });

async function run() {
  const prisma = new PrismaClient();
  const slugs = await prisma.journeyStory.findMany({
    where: { journey: { language: { equals: "italian", mode: "insensitive" } }, slug: { not: null } },
    select: { slug: true },
  });
  const slugSet = Array.from(new Set(slugs.map((r) => r.slug!).filter(Boolean)));
  const result = await prisma.userMetric.deleteMany({
    where: {
      eventType: { in: ["audio_complete", "continue_listening"] },
      storySlug: { in: slugSet },
    },
  });
  console.log(`Deleted ${result.count} orphan italian metric rows.`);
  await prisma.$disconnect();
}
run().catch(console.error);
