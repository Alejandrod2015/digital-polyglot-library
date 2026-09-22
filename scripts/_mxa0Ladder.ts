import { PrismaClient } from '../src/generated/prisma';
import { assertLadderContiguous } from '../src/lib/journeyLadder';
const p = new PrismaClient();
(async () => {
  const ex = await p.journey.findMany({ select: { id:true, name:true, language:true, variant:true, levels:true, status:true, generationCohort:true } });
  try {
    assertLadderContiguous({ name: 'Friends', language: 'spanish', variant: 'mexico', levels: ['a0'] }, ex as never);
    console.log('LADDER OK: se puede crear Friends spanish/mexico a0');
  } catch (e) { console.log('LADDER BLOQUEA:', (e as Error).message); }
  await p.$disconnect();
})();
