import { prisma } from "@/lib/prisma";

async function main() {
  const rows = await prisma.libraryBook.findMany({
    select: { bookId: true, userId: true, createdAt: true, title: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  console.log("\n== Últimos libros guardados ==");
  for (const r of rows) {
    console.log(`  ${r.userId.padEnd(40)} ${r.bookId.padEnd(40)} ${r.createdAt.toISOString().slice(0,10)}`);
  }

  const orphans = await prisma.userMetric.groupBy({
    by: ["userId"],
    where: { eventType: "signup_completed" },
    _count: { _all: true },
  });
  console.log("\n== Todos los userIds con signup_completed ==");
  for (const r of orphans) {
    console.log(`  ${r.userId.padEnd(40)} ${r._count._all} events`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
