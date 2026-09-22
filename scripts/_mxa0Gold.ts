import { PrismaClient } from '../src/generated/prisma';
const p = new PrismaClient();
(async () => {
  const st = await p.journeyStory.findMany({ where: { journey: { language:'spanish', levels:{has:'a0'}, name:'Traveler' }, text: { not: null } }, select: { title:true,slug:true,synopsis:true,text:true,vocab:true,topic:true,slotIndex:true }, orderBy:[{topic:'asc'},{slotIndex:'asc'}], take: 2 });
  for (const s of st) {
    const w = String(s.text).split(/\s+/).length;
    console.log(`\n===== ${s.title} (${s.slug}) · ${w} palabras · tema ${s.topic}#${s.slotIndex}`);
    console.log('SINOPSIS:', s.synopsis);
    console.log(s.text);
    console.log('VOCAB:', JSON.stringify(s.vocab).slice(0, 1200));
  }
  await p.$disconnect();
})();
