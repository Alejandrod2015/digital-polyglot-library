import { prisma } from "@/lib/prisma";

async function main() {
  // Top saved books in last 30 days
  const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const rows = await prisma.libraryBook.groupBy({
    by: ["bookId"],
    where: { createdAt: { gte: from } },
    _count: { _all: true },
    orderBy: { _count: { bookId: "desc" } },
    take: 10,
  });

  const titleRows = await prisma.libraryBook.findMany({
    where: { bookId: { in: rows.map((r) => r.bookId) } },
    select: { bookId: true, title: true },
    distinct: ["bookId"],
  });
  const titles = new Map(titleRows.map((t) => [t.bookId, t.title]));

  console.log("\n== Top saved books (30d) ==");
  for (const r of rows) {
    console.log(`  bookId=${r.bookId.padEnd(40)}  saves=${r._count._all}  title=${titles.get(r.bookId) ?? "(sin title)"}`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
