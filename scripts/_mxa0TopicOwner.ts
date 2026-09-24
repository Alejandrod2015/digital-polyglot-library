import { PrismaClient } from '../src/generated/prisma';
const p = new PrismaClient();
(async () => {
  const slugs = ['rooftops-and-laundry','haircuts-and-barbershops','plants-and-balconies','lost-and-found','wrestling-and-masks','grills-and-backyards','parcels-and-deliveries'];
  for (const s of slugs) {
    const t = await p.topic.findFirst({ where: { slug: s }, select: { label:true, isUniversal:true } });
    const js = await p.journey.findMany({ where: { topics: { has: s } }, select: { name:true,language:true,variant:true,levels:true,status:true } });
    console.log(`${s}: ${t ? `EXISTE "${t.label}" (universal=${t.isUniversal})` : 'libre'} · usado por: ${js.map(j=>`${j.name}/${j.language}/${j.variant}/${j.levels.join(',')}/${j.status}`).join(', ') || 'nadie'}`);
  }
  await p.$disconnect();
})();
