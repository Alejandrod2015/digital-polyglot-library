/** Mide que palabras del corpus de las 21 ya vuelven solas, y cuantas
 *  apariciones daria un nucleo formado por ellas. No escribe nada. */
import { PrismaClient } from '../../src/generated/prisma';
import fs from 'fs';
const p = new PrismaClient();
const FUNCION = new Set('dice dicen está están tiene tienen hay para con por que como pero desde cada otra otro mismo misma todo toda todos todas nada nadie nunca siempre ahora aqui aquí ahí alli allí bien mas más muy sin sobre entre hasta cuando donde dónde quien quién porque entonces tambien también solo sólo ella ellos ellas usted ustedes nosotros este esta esto ese esa eso aquel una unos unas los las del las sus mis tus les lada'.split(' '));
(async () => {
  const st = await p.journeyStory.findMany({ where: { journeyId: 'cmud5qhu00006j81cmkl4u5ks', text: { not: null } }, select: { slug:true, text:true, vocab:true }, orderBy:[{topic:'asc'},{slotIndex:'asc'}] });
  const t7 = JSON.parse(fs.readFileSync('scripts/_esA0Mexico/t7.json','utf8'));
  const todas = [...st.map(s=>({slug:String(s.slug),text:String(s.text),vocab:(s.vocab as any[])??[]})), ...t7.map((s:any)=>({slug:s.slug,text:s.text,vocab:s.vocab}))];
  const bl = new Set<string>(JSON.parse(fs.readFileSync('scripts/_mxa0-bloqueadas.json','utf8')).tope2);
  const textos = todas.map(s=>s.text.toLowerCase());
  const enCuantas = new Map<string, number>();
  for (const t of textos)
    for (const w of new Set(t.replace(/[^\p{L}\s]/gu,' ').split(/\s+/).filter(x=>x.length>2)))
      enCuantas.set(w, (enCuantas.get(w)??0)+1);
  const recurrentes = [...enCuantas.entries()]
    .filter(([w,n]) => n>=3 && !FUNCION.has(w))
    .sort((a,b)=>b[1]-a[1]);
  console.log(`palabras del corpus en 3+ historias (sin palabras de funcion): ${recurrentes.length}`);
  const libres = recurrentes.filter(([w])=>!bl.has(w));
  console.log(`de esas, LIBRES (no las ensena otro journey del pool): ${libres.length}`);
  console.log(`apariciones que sumarian esas libres: ${libres.reduce((a,b)=>a+b[1],0)}`);
  console.log('\n' + libres.map(([w,n])=>`${w}:${n}`).join(' '));
  await p.$disconnect();
})();
