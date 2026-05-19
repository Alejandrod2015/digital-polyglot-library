import { createClerkClient } from "@clerk/backend";
import { prisma } from "@/lib/prisma";

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

async function main() {
  const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const rows = await prisma.userMetric.groupBy({
    by: ["userId"],
    where: {
      createdAt: { gte: from },
      eventType: { in: ["audio_play", "audio_complete"] },
    },
    _count: { _all: true },
    orderBy: { _count: { userId: "desc" } },
    take: 30,
  });
  console.log("\n== Top userIds por audio_play/audio_complete (30d) ==");
  for (const row of rows) {
    let email = "—";
    try {
      const user = await clerk.users.getUser(row.userId);
      email = user.emailAddresses.map((e) => e.emailAddress).join(", ") || "—";
    } catch {
      email = "(clerk lookup failed)";
    }
    console.log(`  ${row.userId.padEnd(40)}  ${String(row._count._all).padStart(6)} events  ${email}`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
