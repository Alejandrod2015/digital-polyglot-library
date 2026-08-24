import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const rows = await p.journeyStory.findMany({
    where: { journeyId: "cmsou2uk0000732mqa4oatcmn" },
    select: { id: true, slug: true },
    orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
    take: 4,
  });
  for (const s of rows) {
    const set = await p.storyPracticeSet.findFirst({ where: { storyId: s.id }, include: { exercises: true } });
    if (!set) { console.log(s.slug, "sin set"); continue; }
    const mic = set.exercises.filter((e: any) => e.type === "meaning_in_context");
    const w = mic.filter((e: any) => (e.payload as any)?.audioClip?.wordClipUrl).length;
    const c = mic.filter((e: any) => (e.payload as any)?.audioClip?.clipUrl).length;
    console.log(`${s.slug} mic=${mic.length} conFrase=${c} conPalabra=${w}`);
  }
  await p.$disconnect();
})();
