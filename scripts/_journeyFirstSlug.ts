import { prisma } from "../src/lib/prisma";
(async () => {
  const js = await prisma.journey.findMany({
    where: { status: { in: ["active", "draft"] } },
    select: { id: true, topics: true, name: true, language: true, variant: true, levels: true, status: true,
      stories: { select: { slug: true, topic: true, slotIndex: true, status: true, coverUrl: true, audioUrl: true } } },
  });
  for (const j of js) {
    const order = j.topics ?? [];
    const ss = [...j.stories].sort((a, b) => (order.indexOf(a.topic) - order.indexOf(b.topic)) || (a.slotIndex - b.slotIndex));
    console.log(JSON.stringify({ id: j.id, tipo: j.name, lang: j.language, variant: j.variant,
      level: (j.levels||[]).join("/"), status: j.status, n: ss.length,
      cov: ss.filter(s=>s.coverUrl).length, aud: ss.filter(s=>s.audioUrl).length,
      pub: ss.filter(s=>s.status==="published").length, first: ss[0]?.slug ?? null }));
  }
  await prisma.$disconnect();
})();
