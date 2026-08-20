import { PrismaClient } from "../src/generated/prisma";

async function main() {
  const prisma = new PrismaClient();
  const rows = await prisma.storyRating.findMany({ orderBy: { createdAt: "desc" }, take: 8 });
  console.log(
    rows
      .map((r) => `${r.surface.padEnd(8)} ${r.liked ? "up  " : "down"}  ${r.storySlug.padEnd(28)} comment=${r.comment ?? "-"}`)
      .join("\n") || "(sin filas)",
  );
  await prisma.$disconnect();
}

void main();
