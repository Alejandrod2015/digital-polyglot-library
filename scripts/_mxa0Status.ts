import { PrismaClient } from '../src/generated/prisma';
const p = new PrismaClient();
(async () => {
  const js = await p.journey.findMany({ select: { id:true,name:true,language:true,variant:true,levels:true,status:true,typeSlug:true,topics:true,storiesPerTopic:true,createdAt:true } , orderBy:{createdAt:'asc'}});
  for (const j of js) console.log([j.status.padEnd(8), (j.language+'/'+j.variant).padEnd(22), (j.name||'').padEnd(14), (j.typeSlug||'-').padEnd(12), j.levels.join(','), `${j.topics.length}x${j.storiesPerTopic}`, j.createdAt.toISOString().slice(0,10), j.id].join(' '));
  await p.$disconnect();
})();
