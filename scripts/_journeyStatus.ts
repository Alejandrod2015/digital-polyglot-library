import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
(async () => {
  const journeys = await prisma.journey.findMany({ where: { status: "active" }, select: { id: true, name: true, language: true, variant: true, levels: true } });
  for (const j of journeys) {
    const stories = await prisma.journeyStory.findMany({ where: { journeyId: j.id },
      select: { id: true, slug: true, status: true, audioStatus: true, audioUrl: true, coverUrl: true, practiceVoiceId: true } });
    const pub = stories.filter((s) => s.status === "published").length;
    const audio = stories.filter((s) => s.audioUrl).length;
    const covers = stories.filter((s) => s.coverUrl).length;
    const pvoice = stories.filter((s) => s.practiceVoiceId).length;
    let newSets = 0, oldSets = 0;
    for (const s of stories) {
      const n = await prisma.storyPracticeExercise.count({ where: { set: { storyId: s.id } } });
      if (n >= 16) newSets++; else if (n > 0) oldSets++;
    }
    console.log(JSON.stringify({ journey: j.name, lang: j.language, variant: j.variant, levels: j.levels, total: stories.length, pub, audio, covers, newSets, oldSets, practiceVoiceSet: pvoice }));
  }
})().finally(() => prisma.$disconnect());
