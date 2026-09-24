import { PrismaClient } from '../../src/generated/prisma';
import fs from 'fs';
const p = new PrismaClient();
(async () => {
  const st = await p.journeyStory.findMany({ where: { journeyId: 'cmud5qhu00006j81cmkl4u5ks', topic: process.argv[2], text: { not: null } }, select: { topic:true, slotIndex:true, slug:true, title:true, synopsis:true, text:true, vocab:true, arcType:true }, orderBy:{slotIndex:'asc'} });
  fs.writeFileSync(process.argv[3], JSON.stringify(st, null, 1));
  console.log(`escrito ${process.argv[3]} con ${st.length}`);
  await p.$disconnect();
})();
