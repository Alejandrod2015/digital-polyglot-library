// Solo lectura: vuelca los journeys italianos live+draft (temas, textos, vocab) para planear el Friends IT A1.
import "dotenv/config";
import { PrismaClient } from "../../src/generated/prisma";
import { writeFileSync } from "fs";
const prisma = new PrismaClient();
(async () => {
  const js = await prisma.journey.findMany({
    where: { status: { in: ["active", "draft"] } },
    select: { id: true, name: true, language: true, variant: true, typeSlug: true, levels: true, topics: true, status: true,
      stories: { select: { topic: true, slotIndex: true, title: true, text: true, vocab: true, status: true }, orderBy: [{ topic: "asc" }, { slotIndex: "asc" }] } },
  });
  const topics = await prisma.topic.findMany({ select: { slug: true, label: true } });
  writeFileSync(process.argv[2], JSON.stringify({ js, topics }, null, 1));
  console.log(js.length, "journeys");
  await prisma.$disconnect();
})();
