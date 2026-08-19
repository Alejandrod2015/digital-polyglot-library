import { PrismaClient } from "../src/generated/prisma";

async function main() {
  const prisma = new PrismaClient();
  const a = await prisma.storyRating.deleteMany({ where: { storySlug: "_qa-metrica" } });
  const b = await prisma.userMetric.deleteMany({ where: { storySlug: "_qa-metrica" } });
  console.log(`borradas: rating=${a.count} metricas=${b.count}`);
  await prisma.$disconnect();
}

void main();
