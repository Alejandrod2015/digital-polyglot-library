/** Dice, por cada palabra, si esta bloqueada (pool latam) o ya enseñada en este journey. */
import { PrismaClient } from '../src/generated/prisma';
import fs from 'fs';
const p = new PrismaClient();
(async () => {
  const bl = new Set<string>(JSON.parse(fs.readFileSync('scripts/_mxa0-bloqueadas.json','utf8')).tope2);
  const st = await p.journeyStory.findMany({ where: { journeyId: 'cmud5qhu00006j81cmkl4u5ks', text: { not: null } }, select: { vocab: true } });
  const ya = new Set(st.flatMap(s => ((s.vocab as any[]) ?? []).map(v => String(v.word).toLowerCase())));
  const libres: string[] = [], bloq: string[] = [], taught: string[] = [];
  for (const w of process.argv.slice(2)) {
    const k = w.toLowerCase();
    if (ya.has(k)) taught.push(w); else if (bl.has(k)) bloq.push(w); else libres.push(w);
  }
  console.log('LIBRE :', libres.join(' '));
  console.log('BLOQ  :', bloq.join(' '));
  console.log('YA EN JOURNEY:', taught.join(' '));
  await p.$disconnect();
})();
