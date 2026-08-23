import { prisma } from "../src/lib/prisma";
(async () => {
  const J = "cmt0a8vb1000m32p1x7r5ba28";
  const j = await prisma.journey.findUnique({ where: { id: J }, select: { topics: true } });
  const orden: string[] = (j?.topics as string[]) ?? [];
  const ss = await prisma.journeyStory.findMany({ where: { journeyId: J },
    select: { slug: true, title: true, topic: true, slotIndex: true, coverUrl: true,
      audioUrl: true, audioWordTimings: true,
      practiceSet: { select: { exercises: true } } } });
  ss.sort((a, b) => (orden.indexOf(a.topic) - orden.indexOf(b.topic)) || (a.slotIndex - b.slotIndex));
  let n = 0;
  for (const s of ss) {
    n++;
    const e: any = s.practiceSet?.exercises;
    console.log([n, s.topic, s.slug, s.title, s.coverUrl ? "SI" : "no",
      s.audioUrl ? "SI" : "no", s.audioWordTimings ? "SI" : "no",
      Array.isArray(e) ? e.length : 0].join("\t"));
  }
  await prisma.$disconnect();
})();
