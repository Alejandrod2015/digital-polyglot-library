import { PrismaClient } from '../../src/generated/prisma';
const p = new PrismaClient();
(async () => {
  const st = await p.journeyStory.findMany({ where: { journeyId: 'cmud5qhu00006j81cmkl4u5ks', topic: { in: process.argv.slice(2) }, text: { not: null } }, select: { topic:true, slotIndex:true, slug:true, text:true, vocab:true }, orderBy:[{topic:'asc'},{slotIndex:'asc'}] });
  for (const s of st) console.log(`\n===== ${s.topic}#${s.slotIndex} ${s.slug}\n${s.text}\n--- vocab: ${((s.vocab as any[])??[]).map(v=>v.surface??v.word).join(', ')}`);
  await p.$disconnect();
})();
