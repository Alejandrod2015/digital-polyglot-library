// Post-migration sanity check: does the backfill line up, and can the Prisma
// client actually round-trip every new model? A migration that only "did not
// throw" is not a migration that works.

import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  const total = await prisma.betaSignup.count();
  const withFirstName = await prisma.betaSignup.count({ where: { firstName: { not: null } } });
  const withAppleId = await prisma.betaSignup.count({ where: { appleIdEmail: { not: null } } });
  const byStatus = await prisma.betaSignup.groupBy({ by: ["status"], _count: { _all: true } });

  console.log(`BetaSignup rows: ${total}`);
  console.log(`  firstName backfilled:    ${withFirstName}`);
  console.log(`  appleIdEmail backfilled: ${withAppleId}`);
  console.log(`  by status: ${byStatus.map((s) => `${s.status}=${s._count._all}`).join(", ") || "(none)"}`);

  // Rows that predate the attribution fields legitimately have nothing to
  // backfill from. Name them so the gap is understood rather than assumed.
  const missing = await prisma.betaSignup.findMany({
    where: { appleIdEmail: null },
    select: { email: true, createdAt: true, status: true },
    orderBy: { createdAt: "asc" },
  });
  if (missing.length > 0) {
    console.log(`\n${missing.length} row(s) with no Apple ID (cannot be auto-invited):`);
    for (const m of missing) {
      console.log(`  ${m.createdAt.toISOString().slice(0, 10)}  ${m.status.padEnd(9)}  ${m.email}`);
    }
  }

  console.log(`\nNew tables readable:`);
  console.log(`  BetaEmailLog: ${await prisma.betaEmailLog.count()}`);
  console.log(`  BetaFeedback: ${await prisma.betaFeedback.count()}`);
  console.log(`  BetaRelease:  ${await prisma.betaRelease.count()}`);

  // Prove the unique constraint that the whole idempotency story rests on.
  // Written and rolled back so production is left exactly as found.
  const probe = await prisma.betaSignup.findFirst({ select: { id: true } });
  if (!probe) {
    console.log("\nNo signups to probe the email ledger with; constraint untested.");
    return;
  }
  try {
    await prisma.$transaction(async (tx) => {
      await tx.betaEmailLog.create({ data: { signupId: probe.id, kind: "__probe__" } });
      try {
        await tx.betaEmailLog.create({ data: { signupId: probe.id, kind: "__probe__" } });
        throw new Error("DUPLICATE WAS ALLOWED: the unique index is not doing its job");
      } catch (err) {
        if (err instanceof Error && err.message.startsWith("DUPLICATE WAS ALLOWED")) throw err;
        console.log("  ledger uniqueness: duplicate correctly rejected");
      }
      throw new Error("__rollback__");
    });
  } catch (err) {
    if (!(err instanceof Error) || err.message !== "__rollback__") throw err;
    console.log("  probe rolled back, nothing left behind");
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    await prisma.$disconnect();
    console.error(err);
    process.exit(1);
  });
