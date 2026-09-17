// Solo lectura: vuelca las 21 historias del Cultural ES latam B1 (Alondra y Ulises) para escribir las escenas de portada.
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
const ID = "cmu410zep000732szrw94t2sl";
(async () => {
  const j = await p.journey.findUnique({ where: { id: ID } });
  console.log(JSON.stringify({ id: j?.id, status: (j as any)?.status, typeSlug: (j as any)?.typeSlug, language: (j as any)?.language, variant: (j as any)?.variant, level: (j as any)?.level }));
  const s = await p.journeyStory.findMany({ where: { journeyId: ID } });
  s.sort((a, b) => (a as any).topicIndex - (b as any).topicIndex || a.topic.localeCompare(b.topic) || a.slotIndex - b.slotIndex);
  for (const x of s) {
    console.log(`\n### ${x.topic} #${x.slotIndex} ${x.status} ${x.slug} | ${x.title} | cover=${x.coverUrl ?? "-"} | coverDone=${(x as any).coverDone} | vocab=${Array.isArray(x.vocab) ? (x.vocab as any[]).length : "?"}\nSYN: ${(x as any).synopsis ?? ""}\n${x.text}`);
  }
  console.log("\nTOTAL", s.length, "coverUrl!=null:", s.filter(x => x.coverUrl).length);
  await p.$disconnect();
})();
