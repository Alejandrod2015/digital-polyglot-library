/** Deja 20 plazas por historia quitando las que NO vuelven: la plaza que sale
 *  una sola vez en las 21 es justo la que hunde la escalera. */
import { PrismaClient } from '../../src/generated/prisma';
import fs from 'fs';
const p = new PrismaClient();
(async () => {
  const st = await p.journeyStory.findMany({ where: { journeyId: 'cmud5qhu00006j81cmkl4u5ks', text: { not: null } }, select: { text:true } });
  const t7 = JSON.parse(fs.readFileSync('scripts/_esA0Mexico/t7.json','utf8'));
  const textos = [...st.map(s=>String(s.text)), ...t7.map((s:any)=>s.text)].map(t=>t.toLowerCase());
  const n = (k: string) => {
    const re = new RegExp(`(?<!\\p{L})${k.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?!\\p{L})`,'u');
    return textos.filter(t=>re.test(t)).length;
  };
  for (const f of process.argv.slice(2)) {
    const d = JSON.parse(fs.readFileSync(f,'utf8'));
    let quitadas = 0;
    for (const s of d) {
      const orden = [...s.vocab].sort((a:any,b:any)=> n(String(a.surface??a.word)) - n(String(b.surface??b.word)));
      const sobran = Math.max(0, s.vocab.length - 20);
      const fuera = new Set(orden.slice(0, sobran).map((v:any)=>v.word));
      s.vocab = s.vocab.filter((v:any)=>!fuera.has(v.word));
      quitadas += sobran;
    }
    fs.writeFileSync(f, JSON.stringify(d, null, 1));
    console.log(`${f}: -${quitadas} plazas · ahora ${d.map((s:any)=>s.vocab.length).join(',')}`);
  }
  await p.$disconnect();
})();
