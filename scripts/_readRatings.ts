import { PrismaClient } from "../src/generated/prisma";

async function main() {
  const prisma = new PrismaClient();
  const rows = await prisma.storyRating.findMany({ orderBy: { createdAt: "desc" }, take: 5 });
  console.log(
    rows
      .map((r) => `${r.liked ? "up  " : "down"}  ${r.storySlug}  comment=${r.comment ?? "-"}  ${r.platform}`)
      .join("\n") || "(sin filas)",
  );
  await prisma.$disconnect();
}

void main();
