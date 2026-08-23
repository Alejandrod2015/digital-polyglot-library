import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const J = "cmsyrge55000732u9oiu8wue3";
  const j = await p.journey.findUnique({ where: { id: J }, select: { status: true } });
  const s = await p.journeyStory.findMany({ where: { journeyId: J }, select: { id: true, status: true, audioUrl: true, coverUrl: true, voiceId: true } });
  const sets = await p.storyPracticeSet.count({ where: { storyId: { in: s.map((x) => x.id) } } });
  const ej = await p.storyPracticeExercise.count({ where: { set: { storyId: { in: s.map((x) => x.id) } } } });
  console.log(`journey: ${j?.status}`);
  console.log(`historias ${s.length} · published ${s.filter((x) => x.status === "published").length} · audio ${s.filter((x) => x.audioUrl).length} · portada ${s.filter((x) => x.coverUrl).length} · voz ${s.filter((x) => x.voiceId).length}`);
  console.log(`sets de práctica ${sets} · ejercicios ${ej}`);
  await p.$disconnect();
})();
