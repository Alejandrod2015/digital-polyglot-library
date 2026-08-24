import fs from "node:fs";
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const j = await p.journey.findUnique({ where: { id: "cmsyrge55000732u9oiu8wue3" }, select: { topics: true } });
  const rows = await p.journeyStory.findMany({ where: { journeyId: "cmsyrge55000732u9oiu8wue3" }, select: { slug: true, topic: true, slotIndex: true } });
  const orden = j?.topics ?? [];
  rows.sort((a, b) => (orden.indexOf(a.topic) - orden.indexOf(b.topic)) || (a.slotIndex - b.slotIndex));
  const f = "src/data/tapGlosses/portuguese-traveler-brazil-a1.json";
  if (fs.existsSync(f)) { console.log("ya existe"); await p.$disconnect(); return; }
  fs.writeFileSync(f, JSON.stringify({ slugs: rows.map((r) => r.slug), glosses: {} }, null, 1));
  console.log(`creado con ${rows.length} slugs`);
  await p.$disconnect();
})();
