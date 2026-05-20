/**
 * Lists every userId active this week with event counts + Clerk email,
 * so we know who shows up in the weekly digest.
 *
 * Run with: npx tsx scripts/whoIsActiveThisWeek.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const { PrismaClient } = await import("../src/generated/prisma");
  const { createClerkClient } = await import("@clerk/backend");
  const prisma = new PrismaClient();
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY ?? "" });

  const sinceMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const events = await prisma.userMetric.findMany({
    where: { createdAt: { gte: new Date(sinceMs) } },
    select: { userId: true, eventType: true },
  });

  const byUser = new Map<string, Record<string, number>>();
  for (const e of events) {
    const m = byUser.get(e.userId) ?? {};
    m[e.eventType] = (m[e.eventType] ?? 0) + 1;
    byUser.set(e.userId, m);
  }

  const userIds = Array.from(byUser.keys());
  let names = new Map<string, { email: string | null; name: string | null }>();
  if (userIds.length && process.env.CLERK_SECRET_KEY) {
    try {
      const res = await clerk.users.getUserList({ userId: userIds, limit: 200 });
      names = new Map(
        res.data.map((u) => [
          u.id,
          {
            email: u.emailAddresses[0]?.emailAddress ?? null,
            name: [u.firstName, u.lastName].filter(Boolean).join(" ") || null,
          },
        ]),
      );
    } catch (err) {
      console.error("Clerk lookup failed:", err);
    }
  }

  for (const [userId, counts] of byUser.entries()) {
    const meta = names.get(userId);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    console.log(`${userId}`);
    console.log(`  email: ${meta?.email ?? "(unresolved)"}`);
    console.log(`  name:  ${meta?.name ?? "(no name)"}`);
    console.log(`  total events: ${total}`);
    console.log(`  by type: ${JSON.stringify(counts)}`);
    console.log("");
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
