import { PrismaClient } from '../src/generated/prisma';
const p = new PrismaClient();
(async () => {
  const js = await p.journey.findMany({ where: { language: 'spanish', status: { in: ['active','draft'] } }, select: { id:true, name:true, variant:true, levels:true, topics:true, status:true, typeSlug:true } });
  for (const j of js) {
    console.log(`${j.status}\t${j.variant}\t${j.name}\t${j.levels.join(',')}\t${j.id}`);
    console.log('   ', j.topics.join(' | '));
  }
  await p.$disconnect();
})();
