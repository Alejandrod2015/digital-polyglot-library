import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
async function main() {
  const rows = await prisma.favorite.findMany({
    where: { language: { equals: "german", mode: "insensitive" }, lastReviewedAt: { not: null } },
    orderBy: { lastReviewedAt: "desc" },
    take: 5,
    select: { word: true, lastReviewedAt: true, streak: true },
  });
  console.log(`repasos con sello en el servidor: ${rows.length}`);
  for (const r of rows) console.log(`  ${(r.word ?? "").padEnd(26)} ${r.lastReviewedAt?.toISOString()} streak=${r.streak}`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
