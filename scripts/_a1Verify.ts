import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
(async () => {
  const j = await prisma.journey.findFirst({ where: { status: "active", levels: { has: "a1" } }, select: { id: true } });
  const stories = await prisma.journeyStory.findMany({ where: { journeyId: j!.id, status: "published" }, select: { id: true, slug: true } });
  let ok = 0;
  for (const s of stories) {
    const latest = await prisma.storyPracticeSet.findFirst({ where: { storyId: s.id }, orderBy: { createdAt: "desc" }, select: { id: true } });
    const n = latest ? await prisma.storyPracticeExercise.count({ where: { setId: latest.id } }) : 0;
    if (n >= 17) ok++; else console.log("PROBLEMA:", s.slug, n);
  }
  console.log(`${ok}/${stories.length} historias A1 con set nuevo (>=21 ej)`);
})().finally(() => prisma.$disconnect());
