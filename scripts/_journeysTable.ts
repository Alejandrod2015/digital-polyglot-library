import { prisma } from "../src/lib/prisma";
(async () => {
  const js = await prisma.journey.findMany({
    where: { status: { in: ["active", "draft"] } },
    select: { id: true, name: true, typeSlug: true, language: true, variant: true, levels: true, status: true, topics: true,
      stories: { select: { status: true, coverUrl: true, audioUrl: true } } },
  });
  const rows = js.map((j) => {
    const s = j.stories;
    return { id: j.id, tipo: j.name, type: j.typeSlug, lang: j.language, variant: j.variant,
      level: (j.levels || []).join("/"), status: j.status, historias: s.length,
      portadas: s.filter((x) => x.coverUrl).length, audio: s.filter((x) => x.audioUrl).length,
      pub: s.filter((x) => x.status === "published").length };
  });
  rows.sort((a, b) => (a.status === b.status ? 0 : a.status === "active" ? -1 : 1) || a.lang.localeCompare(b.lang) || a.level.localeCompare(b.level));
  for (const r of rows) console.log(JSON.stringify(r));
  await prisma.$disconnect();
})();
