/** La misma medida de recirculacion sobre los A0 que ya existen. */
import { PrismaClient } from '../../src/generated/prisma';
const p = new PrismaClient();
(async () => {
  const js = await p.journey.findMany({ where: { levels: { has:'a0' }, status: { not:'archived' } }, select: { id:true,name:true,language:true,variant:true } });
  for (const j of js) {
    const st = await p.journeyStory.findMany({ where: { journeyId: j.id, text: { not: null } }, select: { text:true, vocab:true } });
    if (st.length < 7) { console.log(`${j.name}/${j.language}/${j.variant}: solo ${st.length} con texto`); continue; }
    const textos = st.map(s=>String(s.text).toLowerCase());
    const n = (k: string) => {
      const re = new RegExp(`(?<!\\p{L})${k.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?!\\p{L})`,'u');
      return textos.filter(t=>re.test(t)).length;
    };
    const plazas = st.flatMap(s=>((s.vocab as any[])??[]).map(v=>String(v.surface ?? v.word)));
    if (!plazas.length) { console.log(`${j.name}/${j.language}/${j.variant}: sin vocab`); continue; }
    const ns = plazas.map(n);
    const media = ns.reduce((a,b)=>a+b,0)/ns.length;
    const cola = ns.filter(x=>x<=1).length/ns.length;
    const palabras = st.map(s=>String(s.text).split(/\s+/).length);
    console.log(`${j.name}/${j.language}/${j.variant}: ${st.length} hist · ${plazas.length} plazas · media ${media.toFixed(2)} · cola ${(cola*100).toFixed(0)}% · ${Math.round(palabras.reduce((a,b)=>a+b,0)/palabras.length)} pal/hist · distintas ${new Set(plazas.map(x=>x.toLowerCase())).size}`);
  }
  await p.$disconnect();
})();
