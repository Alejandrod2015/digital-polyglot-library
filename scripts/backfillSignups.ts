/**
 * Backfills the UserMetric `signup_completed` event for every existing
 * Clerk user, using each user's real `created_at` timestamp. Idempotent:
 * userIds that already have a signup_completed row are skipped, so it's
 * safe to re-run after Clerk fires `user.created` webhooks for new
 * signups going forward.
 *
 * Run with: npx tsx scripts/backfillSignups.ts
 * Dry-run:  npx tsx scripts/backfillSignups.ts --dry
 */

import { config } from "dotenv";
import { PrismaClient } from "../src/generated/prisma";

config({ path: ".env.local" });
config({ path: ".env" });

const DRY = process.argv.includes("--dry");

type ClerkUser = {
  id: string;
  created_at: number;
  primary_email_address_id: string | null;
  email_addresses: Array<{ id: string; email_address: string }>;
};

function pickPrimaryEmail(user: ClerkUser): string | null {
  if (!user.email_addresses.length) return null;
  const primary = user.primary_email_address_id
    ? user.email_addresses.find((e) => e.id === user.primary_email_address_id)
    : user.email_addresses[0];
  return primary?.email_address ?? null;
}

async function fetchAllClerkUsers(secret: string): Promise<ClerkUser[]> {
  const all: ClerkUser[] = [];
  let offset = 0;
  const limit = 100;
  while (true) {
    const res = await fetch(
      `https://api.clerk.com/v1/users?limit=${limit}&offset=${offset}&order_by=created_at`,
      { headers: { Authorization: `Bearer ${secret}` } },
    );
    if (!res.ok) {
      throw new Error(`Clerk users fetch failed: ${res.status} ${res.statusText}`);
    }
    const batch = (await res.json()) as ClerkUser[];
    all.push(...batch);
    if (batch.length < limit) break;
    offset += limit;
  }
  return all;
}

async function main() {
  const secret = process.env.CLERK_SECRET_KEY;
  if (!secret) {
    console.error("Missing CLERK_SECRET_KEY in env");
    process.exit(1);
  }

  console.log(`Mode: ${DRY ? "DRY RUN" : "WRITE"}`);
  console.log("Fetching Clerk users...");
  const users = await fetchAllClerkUsers(secret);
  console.log(`  ${users.length} users in Clerk`);

  const prisma = new PrismaClient();

  // Skip users that already have a signup_completed event.
  const existing = await prisma.userMetric.findMany({
    where: { eventType: "signup_completed" },
    select: { userId: true },
  });
  const existingIds = new Set(existing.map((r) => r.userId));

  const toBackfill = users.filter((u) => !existingIds.has(u.id));
  console.log(`  ${toBackfill.length} need a signup_completed event`);

  let written = 0;
  for (const user of toBackfill) {
    const email = pickPrimaryEmail(user);
    const createdAt = new Date(user.created_at);
    if (DRY) {
      console.log(
        `  [dry] ${user.id}  ${email ?? "(no email)"}  ${createdAt.toISOString()}`,
      );
      continue;
    }
    await prisma.userMetric.create({
      data: {
        userId: user.id,
        storySlug: "__auth__",
        bookSlug: "signup",
        eventType: "signup_completed",
        createdAt,
        metadata: { email, source: "clerk-backfill" },
      },
    });
    written += 1;
    console.log(
      `  ✓ ${user.id}  ${email ?? "(no email)"}  ${createdAt.toISOString()}`,
    );
  }

  await prisma.$disconnect();
  console.log("");
  console.log(`Backfill complete. Wrote ${written} signup_completed events.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
