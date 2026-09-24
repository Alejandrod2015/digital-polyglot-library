import { PrismaClient } from '../src/generated/prisma';
const p = new PrismaClient();
(async () => {
  const st = await p.journeyStory.findMany({ where: { journeyId: 'cmud5qhu00006j81cmkl4u5ks', text: { not: null } }, select: { vocab: true } });
  const w = st.flatMap(s => ((s.vocab as any[]) ?? []).map(v => String(v.word)));
  console.log(w.length, 'plazas ya enseñadas en este journey:');
  console.log([...new Set(w)].sort().join(', '));
  await p.$disconnect();
})();
