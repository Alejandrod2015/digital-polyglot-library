import { PrismaClient } from "../src/generated/prisma";

async function main() {
  const prisma = new PrismaClient();
  const rows = await prisma.userMetric.findMany({
    where: { eventType: { in: ["story_rated", "story_rating_comment"] } },
    orderBy: { createdAt: "desc" },
    take: 8,
  });
  console.log(
    rows.map((r) => `${r.eventType}  ${r.storySlug}  value=${r.value}  ${JSON.stringify(r.metadata)}`).join("\n") ||
      "(sin filas)",
  );
  await prisma.$disconnect();
}

void main();
