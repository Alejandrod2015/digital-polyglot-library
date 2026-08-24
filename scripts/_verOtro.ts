import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const [lang, variant, lvl] = [process.argv[2], process.argv[3], process.argv[4]];
  const j = await p.journey.findFirst({ where: { language: lang, variant, levels: { has: lvl } }, select: { id: true, name: true, topics: true } });
  if (!j) { console.log("no encontrado"); await p.$disconnect(); return; }
  const n = Number(process.argv[5] ?? 2);
  const rows = (await p.journeyStory.findMany({ where: { journeyId: j.id }, select: { slug: true, title: true, text: true, topic: true, slotIndex: true } }))
    .sort((a, b) => ((j.topics ?? []).indexOf(a.topic) - (j.topics ?? []).indexOf(b.topic)) || (a.slotIndex - b.slotIndex));
  console.log(`### ${j.name} ${lang}/${variant} ${lvl}`);
  for (const s of rows.filter((r) => /“/.test(r.text ?? "")).slice(0, n)) {
    console.log(`\n===== ${s.title}`);
    console.log(s.text);
  }
  await p.$disconnect();
})();
