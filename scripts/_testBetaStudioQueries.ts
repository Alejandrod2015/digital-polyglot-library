// Runs the exact Prisma queries behind GET /api/studio/beta.
//
// The route itself is admin-gated, so it cannot be exercised from a script
// without a Clerk session. What can go wrong in it that typechecking will not
// catch is the query shape: the `_count` include on applicants and the nested
// `signup` include on feedback both fail at runtime, not at compile time, if
// the relations are wired up wrong in the schema. This proves them.

import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  const applicants = await prisma.betaSignup.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
    include: { _count: { select: { feedback: true } } },
  });
  console.log(`applicants: ${applicants.length}, _count present: ${applicants[0]?._count !== undefined}`);

  const feedback = await prisma.betaFeedback.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
    include: { signup: { select: { id: true, firstName: true, email: true } } },
  });
  console.log(`feedback: ${feedback.length} (nested signup include resolved)`);

  const releases = await prisma.betaRelease.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  console.log(`releases: ${releases.length}`);

  const byStatus = applicants.reduce<Record<string, number>>((acc, a) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`stats.byStatus: ${JSON.stringify(byStatus)}`);
  console.log(`stats.activeTesters: ${await prisma.betaSignup.count({ where: { status: { in: ["invited", "accepted"] } } })}`);

  // The release publisher's grouping query, which is the other runtime-only
  // shape: it filters feedback by release and signup in one go.
  const fixed = await prisma.betaFeedback.findMany({
    where: { releaseId: "does-not-exist", status: "fixed", signupId: { in: applicants.map((a) => a.id) } },
    select: { signupId: true, message: true },
  });
  console.log(`publisher grouping query ran, matched ${fixed.length} (0 expected)`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    await prisma.$disconnect();
    console.error(err);
    process.exit(1);
  });
