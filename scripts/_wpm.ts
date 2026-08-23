import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const rows = await p.continueListeningEntry.findMany({ where: { audioDurationSec: { gt: 0 } }, select: { storySlug: true, audioDurationSec: true } });
  const dur = new Map<string, number>();
  for (const r of rows) dur.set(r.storySlug, r.audioDurationSec!);
  const stories = await p.journeyStory.findMany({ where: { slug: { in: [...dur.keys()] }, wordCount: { not: null } }, select: { slug: true, wordCount: true, journey: { select: { language: true, levels: true } } } });
  const wpms: number[] = [];
  for (const s of stories) {
    const d = dur.get(s.slug!)!;
    wpms.push((s.wordCount! / d) * 60);
  }
  wpms.sort((a, b) => a - b);
  console.log("historias con duracion real:", wpms.length);
  console.log("wpm min/mediana/max:", Math.round(wpms[0]), Math.round(wpms[Math.floor(wpms.length/2)]), Math.round(wpms[wpms.length-1]));
  const secs = stories.map(s => dur.get(s.slug!)!).sort((a,b)=>a-b);
  console.log("duracion s min/mediana/max:", Math.round(secs[0]), Math.round(secs[Math.floor(secs.length/2)]), Math.round(secs[secs.length-1]));
})().finally(() => p.$disconnect());
