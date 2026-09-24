/** Para el nucleo declarado: en cuantas historias sale cada palabra hoy, y en
 *  cuales NO sale (candidatas a un cambio de sinonimo). */
import { PrismaClient } from '../../src/generated/prisma';
import fs from 'fs';
const p = new PrismaClient();
(async () => {
  const nuc = JSON.parse(fs.readFileSync('scripts/_esMxA0/nucleo.json','utf8')).nucleo;
  const palabras: string[] = Object.values(nuc).flat() as string[];
  const st = await p.journeyStory.findMany({ where: { journeyId: 'cmud5qhu00006j81cmkl4u5ks', text: { not: null } }, select: { slug:true, text:true }, orderBy:[{topic:'asc'},{slotIndex:'asc'}] });
  const t7 = JSON.parse(fs.readFileSync('scripts/_esA0Mexico/t7.json','utf8'));
  const todas = [...st.map(s=>({slug:String(s.slug),text:String(s.text)})), ...t7.map((s:any)=>({slug:s.slug,text:s.text}))];
  const norm = (s:string)=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
  const textos = todas.map(s=>norm(s.text));
  let suma = 0;
  const filas = palabras.map(w => {
    const raiz = norm(w).replace(/(ar|er|ir)$/,'');
    const re = new RegExp(`(?<![a-z])${raiz}[a-z]{0,4}(?![a-z])`,'u');
    const donde = todas.map((s,i)=>re.test(textos[i]) ? s.slug : null).filter(Boolean) as string[];
    suma += donde.length;
    return { w, n: donde.length, donde };
  });
  filas.sort((a,b)=>a.n-b.n);
  console.log(`nucleo: ${palabras.length} palabras · ${suma} apariciones hoy · media por palabra ${(suma/palabras.length).toFixed(2)}`);
  for (const f of filas) console.log(`  ${f.n}  ${f.w.padEnd(12)} ${f.donde.slice(0,6).join(', ')}`);
  await p.$disconnect();
})();
