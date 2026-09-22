/** Techo sin tocar prosa: si cada historia enseñara sus 20 palabras MAS
 *  recurrentes del journey (en vez de las mas raras), que media saldria. */
import { PrismaClient } from '../../src/generated/prisma';
import fs from 'fs';
const p = new PrismaClient();
const FUNCION = new Set('el la los las un una unos unas de del al a en y o que como pero si no se lo le les su sus mi mis tu tus este esta esto ese esa eso con por para sin sobre entre hasta desde cada todo toda todos todas nada nadie nunca siempre ahora aqui ahí alli bien mas muy tambien solo ella ellos ellas usted ustedes nosotros yo el es son esta estan hay dice dicen tiene tienen va van ser estar hacer haber cuando donde quien porque entonces asi ya tan tanto otro otra otros otras mismo misma dos tres'.split(' '));
const NOMBRES = new Set(['itzel','bruno','mauricio','arturo','valeria','citlali','fernanda','omar','guadalajara','méxico','mexico']);
(async () => {
  const st = await p.journeyStory.findMany({ where: { journeyId: 'cmud5qhu00006j81cmkl4u5ks', text: { not: null } }, select: { slug:true, text:true }, orderBy:[{topic:'asc'},{slotIndex:'asc'}] });
  const t7 = JSON.parse(fs.readFileSync('scripts/_esA0Mexico/t7.json','utf8'));
  const todas = [...st.map(s=>({slug:String(s.slug),text:String(s.text)})), ...t7.map((s:any)=>({slug:s.slug,text:s.text}))];
  const bl = new Set<string>(JSON.parse(fs.readFileSync('scripts/_mxa0-bloqueadas.json','utf8')).tope2);
  const textos = todas.map(s=>s.text.toLowerCase());
  const enCuantas = new Map<string, number>();
  for (const t of textos)
    for (const w of new Set(t.replace(/[^\p{L}\s]/gu,' ').split(/\s+/).filter(x=>x.length>2)))
      enCuantas.set(w, (enCuantas.get(w)??0)+1);
  const usadas = new Set<string>();
  let total = 0, plazas = 0;
  const porHistoria: string[] = [];
  for (const [i,s] of todas.entries()) {
    const cand = [...new Set(textos[i].replace(/[^\p{L}\s]/gu,' ').split(/\s+/).filter(x=>x.length>2))]
      .filter(w=>!FUNCION.has(w) && !NOMBRES.has(w) && !bl.has(w) && !usadas.has(w))
      .sort((a,b)=>(enCuantas.get(b)!-enCuantas.get(a)!));
    const elegidas = cand.slice(0,20);
    for (const w of elegidas) { usadas.add(w); total += enCuantas.get(w)!; plazas++; }
    porHistoria.push(`${s.slug}: ${elegidas.map(w=>`${w}(${enCuantas.get(w)})`).slice(0,8).join(' ')}`);
  }
  console.log(`TECHO sin tocar prosa: ${plazas} plazas · ${total} apariciones · media ${(total/plazas).toFixed(2)}`);
  console.log(`(suelo del gate en A0: 2.5 · A0 publicados: 2.14 a 2.54)`);
  console.log('\nmuestra de lo que enseñaria cada historia:');
  console.log(porHistoria.slice(0,6).join('\n'));
  await p.$disconnect();
})();
