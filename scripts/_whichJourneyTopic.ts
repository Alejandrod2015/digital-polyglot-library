import { PrismaClient } from "../src/generated/prisma";

async function main() {
  const prisma = new PrismaClient();
  const rows = await prisma.journey.findMany({
    where: { status: { in: ["active", "draft"] }, language: "spanish" },
    select: { name: true, variant: true, levels: true, topics: true, status: true },
  });
  for (const r of rows) {
    console.log(`${r.status === "active" ? "live " : "draft"} ${r.name.padEnd(9)} ${r.variant.padEnd(10)} ${(r.levels ?? []).join(",").padEnd(4)} temas: ${(r.topics ?? []).slice(0, 3).join(" | ")}`);
  }
  await prisma.$disconnect();
}

void main();
