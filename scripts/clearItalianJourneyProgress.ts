// One-shot script to clear stale audio_complete / continue_listening
// metrics for the Italian journey of a single user. Used when residual
// progress events from older flows mark stories as audioFinished even
// though the user never actually listened to them, and the journey
// "next" pointer ends up jumping past them.
//
// Usage:
//   npx tsx scripts/clearItalianJourneyProgress.ts [--email user@example.com] [--dry-run]
//
// Defaults to alejandro@muvn.de when no --email is provided.

import { config } from "dotenv";
import { PrismaClient } from "../src/generated/prisma";
import { createClerkClient } from "@clerk/backend";

config({ path: ".env.local" });
config({ path: ".env" });

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const emailFlagIndex = args.indexOf("--email");
  const email =
    emailFlagIndex >= 0 ? args[emailFlagIndex + 1] : "alejandro@muvn.de";
  const dryRun = args.includes("--dry-run");

  const clerkSecretKey = process.env.CLERK_SECRET_KEY;
  if (!clerkSecretKey) {
    console.error("CLERK_SECRET_KEY missing in env.");
    process.exit(1);
  }

  const clerk = createClerkClient({ secretKey: clerkSecretKey });
  const usersRes = await clerk.users.getUserList({ emailAddress: [email] });
  const user = usersRes.data[0];
  if (!user) {
    console.error(`No Clerk user found for email ${email}`);
    process.exit(1);
  }

  console.log(`Clerk user: ${user.id} (${email})`);

  const italianStorySlugs = await prisma.journeyStory.findMany({
    where: {
      journey: { language: { equals: "italian", mode: "insensitive" } },
      slug: { not: null },
    },
    select: { slug: true },
  });
  const slugSet = new Set(
    italianStorySlugs
      .map((row) => row.slug?.trim())
      .filter((slug): slug is string => Boolean(slug)),
  );
  console.log(`Italian journey story slugs: ${slugSet.size}`);

  const offending = await prisma.userMetric.findMany({
    where: {
      userId: user.id,
      eventType: { in: ["audio_complete", "continue_listening"] },
      storySlug: { in: Array.from(slugSet) },
    },
    select: { id: true, storySlug: true, eventType: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  console.log(`Matching UserMetric rows: ${offending.length}`);
  for (const row of offending.slice(0, 30)) {
    console.log(
      `  ${row.createdAt.toISOString()}  ${row.eventType.padEnd(20)} ${row.storySlug}`,
    );
  }
  if (offending.length > 30) {
    console.log(`  ... and ${offending.length - 30} more`);
  }

  if (dryRun) {
    console.log("--dry-run: no rows deleted.");
    await prisma.$disconnect();
    return;
  }

  if (offending.length === 0) {
    console.log("Nothing to delete.");
    await prisma.$disconnect();
    return;
  }

  const deleted = await prisma.userMetric.deleteMany({
    where: { id: { in: offending.map((row) => row.id) } },
  });
  console.log(`Deleted ${deleted.count} rows.`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
