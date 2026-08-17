// Read-only: current beta rules + cohort counts.
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  const cfg = await prisma.studioConfig.findUnique({ where: { key: "beta_rules" } });
  console.log("beta_rules row:", JSON.stringify(cfg?.value ?? null, null, 2));

  const byStatus = await prisma.betaSignup.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  console.log("\napplicants by status:");
  for (const s of byStatus) console.log(`  ${s.status.padEnd(10)} ${s._count._all}`);

  const waitlisted = await prisma.betaSignup.findMany({
    where: { status: "waitlist" },
    orderBy: [{ score: "desc" }],
    select: { email: true, firstName: true, score: true, targetLanguage: true, platform: true, createdAt: true },
  });
  console.log("\nwaitlist, best score first:");
  for (const w of waitlisted) {
    console.log(
      `  ${String(w.score ?? "-").padStart(3)}  ${(w.firstName ?? "?").padEnd(12)} ${w.email.padEnd(38)} ${w.targetLanguage} ${w.platform ?? "ios"}  ${w.createdAt.toISOString().slice(0, 10)}`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
