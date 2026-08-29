import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.pageVisit.findMany({
    where: { userAgent: { contains: "iPhone" } },
    select: { userAgent: true, sessionId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 20000,
  });

  const bySession = new Map<string, string>();
  for (const r of rows) {
    const m = r.userAgent?.match(/(?:iPhone )?OS (\d+)[_.](\d+)/);
    if (!m) continue;
    const key = r.sessionId ?? `${r.createdAt.toISOString()}${r.userAgent?.slice(0, 30)}`;
    if (!bySession.has(key)) bySession.set(key, m[1]);
  }

  const counts = new Map<string, number>();
  for (const major of bySession.values()) counts.set(major, (counts.get(major) ?? 0) + 1);

  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  const sorted = [...counts.entries()].sort((a, b) => Number(a[0]) - Number(b[0]));
  console.log("visitas iPhone:", rows.length, "| sesiones con version:", total);
  for (const [major, n] of sorted) {
    console.log(`  iOS ${major}: ${n}  (${((n / total) * 100).toFixed(1)}%)`);
  }
  const bajo17 = sorted.filter(([m]) => Number(m) < 17).reduce((a, [, n]) => a + n, 0);
  console.log(`por debajo de iOS 17: ${bajo17} de ${total}  (${((bajo17 / total) * 100).toFixed(1)}%)`);
  await prisma.$disconnect();
}

main();
