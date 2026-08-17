import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();

async function run() {
  const stories = await prisma.journeyStory.findMany({
    where: { journeyId: "cmqc6tojm000032el2ebwsgkn" },
    select: { id: true, slug: true, topic: true, slotIndex: true, vocabCount: true },
    orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
  });
  let ok = 0, total = 0;
  for (const s of stories) {
    const set = await prisma.storyPracticeSet.findFirst({
      where: { storyId: s.id }, orderBy: { createdAt: "desc" }, select: { id: true },
    });
    const n = set ? await prisma.storyPracticeExercise.count({ where: { setId: set.id } }) : 0;
    total += n;
    const pass = n >= 17;
    if (pass) ok++;
    console.log(`${pass ? "ok " : "BAJO"} ${s.slug.padEnd(28)} ${String(n).padStart(2)} ejercicios · vocab ${s.vocabCount}`);
  }
  console.log(`\n${ok}/${stories.length} sets con 17 o más · ${total} ejercicios en total`);
  await prisma.$disconnect();
}
run().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
