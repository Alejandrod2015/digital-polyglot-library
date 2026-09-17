// Solo lectura: vuelca las 21 historias del Friends IT A1 para escribir las escenas de portada.
import { PrismaClient } from "../../../../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const j = await p.journey.findUnique({ where: { id: "cmu1bfmb3000732wxuuwj7j2a" } });
  console.log(JSON.stringify({ id: j?.id, status: (j as any)?.status, name: (j as any)?.name }));
  const s = await p.journeyStory.findMany({ where: { journeyId: "cmu1bfmb3000732wxuuwj7j2a" }, orderBy: [{ topic: "asc" }, { slotIndex: "asc" }] });
  for (const x of s) console.log(`\n### ${x.topic} #${x.slotIndex} ${x.status} ${x.slug} | ${x.title} | cover=${x.coverUrl ?? "-"} vocab=${Array.isArray(x.vocab) ? (x.vocab as any[]).length : 0}\n${x.text}`);
  console.log("\nTOTAL", s.length);
  await p.$disconnect();
})();
