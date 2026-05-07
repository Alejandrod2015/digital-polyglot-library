import { config } from "dotenv";
import { createClerkClient } from "@clerk/backend";
import { PrismaClient } from "../src/generated/prisma";
config({ path: ".env.local" });
config({ path: ".env" });

async function run() {
  const prisma = new PrismaClient();
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
  const { data } = await clerk.users.getUserList({ limit: 50, orderBy: "-created_at" });

  for (const u of data) {
    const email = u.emailAddresses.map((e) => e.emailAddress).join(", ");
    // What metrics does this user have for italian?
    const slugs = await prisma.journeyStory.findMany({
      where: { journey: { language: { equals: "italian", mode: "insensitive" } }, slug: { not: null } },
      select: { slug: true },
    });
    const slugSet = Array.from(new Set(slugs.map((r) => r.slug!).filter(Boolean)));
    const completed = await prisma.userMetric.findMany({
      where: {
        userId: u.id,
        eventType: { in: ["audio_complete", "continue_listening"] },
        storySlug: { in: slugSet },
      },
      select: { storySlug: true, eventType: true, metadata: true, createdAt: true },
    });
    console.log(`${u.id}  ${email}`);
    console.log(`  italian metrics: ${completed.length}`);
    if (completed.length > 0) {
      for (const m of completed.slice(0, 5)) {
        const md = m.metadata as Record<string, unknown> | null;
        const ratio =
          md && typeof md.progressSec === "number" && typeof md.audioDurationSec === "number" && md.audioDurationSec > 0
            ? (md.progressSec as number) / (md.audioDurationSec as number)
            : null;
        console.log(`    ${m.eventType.padEnd(20)} ${m.storySlug}  ratio=${ratio?.toFixed(3) ?? "n/a"}`);
      }
    }
  }
  await prisma.$disconnect();
}
run().catch(console.error);
