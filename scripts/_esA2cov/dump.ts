// Solo lectura: vuelca las 21 historias del Friends ES A2 (Salamanca) para escribir las escenas de portada.
import { PrismaClient } from "../../../../../src/generated/prisma";
const p = new PrismaClient();
const ORDEN = [
  "music-and-bands",
  "phones-and-social-media",
  "driving-and-cars",
  "money-and-loans",
  "clothes-and-looks",
  "couples-and-dating",
  "fairs-and-street-parties",
];
(async () => {
  const j = await p.journey.findUnique({ where: { id: "cmu36dk1d0007j8p7grgcyiok" } });
  console.log(JSON.stringify({ id: j?.id, status: (j as any)?.status, name: (j as any)?.name, variant: (j as any)?.variant }));
  const s = await p.journeyStory.findMany({ where: { journeyId: "cmu36dk1d0007j8p7grgcyiok" } });
  s.sort((a, b) => ORDEN.indexOf(a.topic) - ORDEN.indexOf(b.topic) || a.slotIndex - b.slotIndex);
  for (const x of s) {
    console.log(`\n### ${x.topic} #${x.slotIndex} ${x.status} ${x.slug} | ${x.title} | cover=${x.coverUrl ?? "-"}\n${x.text}`);
  }
  console.log("\nTOTAL", s.length);
  await p.$disconnect();
})();
