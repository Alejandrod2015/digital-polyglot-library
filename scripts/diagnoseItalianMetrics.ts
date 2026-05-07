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
  const slugSet = Array.from(new Set(slugs.map(r => r.slug!).filter(Boolean)));
  console.log(`Italian slugs in DB: ${slugSet.length}`);

  const metrics = await prisma.userMetric.findMany({
    where: {
      eventType: { in: ["audio_complete", "continue_listening"] },
      storySlug: { in: slugSet },
    },
    select: { userId: true, eventType: true, storySlug: true, createdAt: true, metadata: true },
    orderBy: { createdAt: "desc" },
  });
  console.log(`Total italian metrics rows: ${metrics.length}`);

  const byUser = new Map<string, number>();
  for (const m of metrics) byUser.set(m.userId, (byUser.get(m.userId) ?? 0) + 1);
  for (const [userId, count] of byUser) {
    console.log(`  ${userId}: ${count} rows`);
  }
  await prisma.$disconnect();
}
run().catch(console.error);
