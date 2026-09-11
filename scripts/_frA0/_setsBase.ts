// SOLO LECTURA. Sets de practica en la base para las 21 historias del journey.
import "dotenv/config";
import { PrismaClient } from "@/generated/prisma";
const p = new PrismaClient();
(async () => {
  const st: any[] = await p.journeyStory.findMany({ where: { journeyId: "cmtwo6cys0007j8yzg6ni3fsc" }, select: { id: true, slug: true } });
  let con = 0;
  for (const s of st) {
    const set: any = await (p as any).storyPracticeSet.findFirst({ where: { storyId: s.id }, orderBy: { createdAt: "desc" }, select: { locked: true, createdAt: true, exercises: { select: { featured: true, language: true } } } });
    if (set) con++;
    console.log(s.slug.padEnd(30), set ? `${set.exercises.length} ej · ${set.exercises.filter((e: any) => e.featured).length} feat · ${[...new Set(set.exercises.map((e: any) => e.language))].join(",")} · locked ${set.locked} · ${set.createdAt.toISOString().slice(0, 16)}` : "SIN SET");
  }
  console.log(`${con}/${st.length} con set`);
  await p.$disconnect();
})();
