import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const rows = await p.journeyStory.groupBy({
    by: ["journeyId"],
    _max: { createdAt: true },
    _count: true,
  });
  const js = await p.journey.findMany({ where: { id: { in: rows.map(r => r.journeyId) } }, select: { id: true, name: true, language: true, variant: true, levels: true, status: true } });
  const m = new Map(js.map(j => [j.id, j]));
  rows.sort((a, b) => (b._max.createdAt?.getTime() ?? 0) - (a._max.createdAt?.getTime() ?? 0));
  for (const r of rows.slice(0, 8)) {
    const j = m.get(r.journeyId);
    if (!j || j.status === "archived") continue;
    console.log(`${r._max.createdAt?.toISOString().slice(0,10)} · ${j.name} ${j.language}/${j.variant} ${j.levels} [${j.status}] · ${r._count} historias · ${j.id}`);
  }
  await p.$disconnect();
})();
