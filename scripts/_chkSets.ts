import { PrismaClient, Prisma } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const rows = await p.journeyStory.findMany({
    where: { journeyId: "cmsyrge55000732u9oiu8wue3" },
    select: { id: true, slug: true, topic: true, slotIndex: true },
    orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
  });
  let con = 0, clips = 0;
  for (const s of rows) {
    const set = await p.storyPracticeSet.findFirst({ where: { storyId: s.id } });
    const ex = set ? await p.storyPracticeExercise.count({ where: { setId: set.id } }) : 0;
    const withClip = set
      ? await p.storyPracticeExercise.count({
          where: { setId: set.id, payload: { path: ["audioClip", "clipUrl"], not: Prisma.DbNull } },
        })
      : 0;
    if (set) con++;
    clips += withClip;
    console.log(`${set ? "ok " : "NO "} ${s.slug} ex=${ex} clips=${withClip}`);
  }
  console.log(`${con}/${rows.length} con set, ${clips} clips`);
  await p.$disconnect();
})();
