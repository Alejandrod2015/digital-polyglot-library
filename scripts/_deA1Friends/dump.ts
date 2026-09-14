// Solo lectura: estado de los journeys alemanes para el plan del Friends DE A1.
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import { writeFileSync } from "fs";
const p = new PrismaClient();
(async () => {
  const js = await p.journey.findMany({ where: { language: "german", status: { not: "archived" } }, select: { id: true, name: true, variant: true, levels: true, status: true, topics: true } });
  const out: any = { journeys: [] };
  for (const j of js) {
    const labels = await p.topic.findMany({ where: { slug: { in: j.topics } }, select: { slug: true, label: true } });
    const stories = await p.journeyStory.findMany({ where: { journeyId: j.id }, orderBy: [{ topic: "asc" }, { slotIndex: "asc" }], select: { topic: true, slotIndex: true, title: true, text: true, vocab: true, synopsis: true } });
    out.journeys.push({ ...j, labels, stories });
    console.log(j.id, j.name, j.levels, j.status, labels.map((l) => l.label).join(" | "));
  }
  writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
  await p.$disconnect();
})();
