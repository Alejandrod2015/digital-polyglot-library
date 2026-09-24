/** Cuanto sube la media si (a) cambio plazas de una sola aparicion por
 *  palabras que YA vuelven solas, y (b) bajo a 20 plazas por historia.
 *  Solo mide; no escribe. */
import { PrismaClient } from '../../src/generated/prisma';
import fs from 'fs';
const p = new PrismaClient();
const FUNCION = new Set('dice dicen está están tiene tienen hay para con por que como pero desde cada otra otro mismo misma todo toda todos todas nada nadie nunca siempre ahora aqui aquí ahí alli allí bien mas más muy sin sobre entre hasta cuando donde dónde quien quién porque entonces también ella ellos ellas usted ustedes este esta esto ese esa eso una unos unas los las del sus mis son tengo veo quiero gracias hoy fuera final'.split(' '));
const NOMBRES = new Set(['itzel','bruno','mauricio','arturo','valeria','citlali','fernanda','omar']);
(async () => {
  const st = await p.journeyStory.findMany({ where: { journeyId: 'cmud5qhu00006j81cmkl4u5ks', text: { not: null } }, select: { slug:true, text:true, vocab:true }, orderBy:[{topic:'asc'},{slotIndex:'asc'}] });
  const t7 = JSON.parse(fs.readFileSync('scripts/_esA0Mexico/t7.json','utf8'));
  const todas = [...st.map(s=>({slug:String(s.slug),text:String(s.text),vocab:(s.vocab as any[])??[]})), ...t7.map((s:any)=>({slug:s.slug,text:s.text,vocab:s.vocab}))];
  const bl = new Set<string>(JSON.parse(fs.readFileSync('scripts/_mxa0-bloqueadas.json','utf8')).tope2);
  const textos = todas.map(s=>s.text.toLowerCase());
  const n = (k: string) => {
    const re = new RegExp(`(?<!\\p{L})${k.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?!\\p{L})`,'u');
    return textos.filter(t=>re.test(t)).length;
  };
  const ocupadas = new Set(todas.flatMap(s=>s.vocab.map((v:any)=>String(v.surface ?? v.word).toLowerCase())));
  const enCuantas = new Map<string, number>();
  for (const t of textos)
    for (const w of new Set(t.replace(/[^\p{L}\s]/gu,' ').split(/\s+/).filter(x=>x.length>2)))
      enCuantas.set(w, (enCuantas.get(w)??0)+1);
  const disponibles = [...enCuantas.entries()]
    .filter(([w,c]) => c>=2 && !FUNCION.has(w) && !NOMBRES.has(w) && !bl.has(w) && !ocupadas.has(w))
    .sort((a,b)=>b[1]-a[1]);
  const plazas = todas.flatMap(s=>s.vocab.map((v:any)=>({slug:s.slug, w:String(v.surface ?? v.word)})));
  const conN = plazas.map(x=>({...x, n:n(x.w)}));
  const total = conN.reduce((a,b)=>a+b.n,0);
  console.log(`HOY: ${conN.length} plazas · ${total} apariciones · media ${(total/conN.length).toFixed(2)}`);
  console.log(`OBJETIVO a 2.5 con 420 plazas: ${Math.ceil(420*2.5)} apariciones\n`);
  console.log(`palabras libres, sin plaza, que ya salen en 2+ historias: ${disponibles.length} (suman ${disponibles.reduce((a,b)=>a+b[1],0)} apariciones)`);
  const deUnaVez = conN.filter(x=>x.n<=1).sort((a,b)=>a.n-b.n);
  console.log(`plazas de una sola aparicion: ${deUnaVez.length}`);
  // simulacion: cambio las de una vez por las disponibles mas frecuentes
  let sim = [...conN];
  const pool = [...disponibles];
  let cambios = 0;
  for (const x of deUnaVez) {
    const i = pool.findIndex(([w,c]) => c >= 2 && textos[todas.findIndex(s=>s.slug===x.slug)].includes(w));
    if (i < 0) continue;
    const [w,c] = pool.splice(i,1)[0];
    const j = sim.findIndex(y=>y.slug===x.slug && y.w===x.w);
    sim[j] = { slug:x.slug, w, n:c }; cambios++;
  }
  const t2 = sim.reduce((a,b)=>a+b.n,0);
  console.log(`\nSIMULACION cambiando ${cambios} plazas por palabras que ya vuelven:`);
  console.log(`  ${sim.length} plazas · ${t2} apariciones · media ${(t2/sim.length).toFixed(2)}`);
  const recorte = sim.slice().sort((a,b)=>a.n-b.n).slice(0, Math.max(0, sim.length-420));
  const t3 = t2 - recorte.reduce((a,b)=>a+b.n,0);
  console.log(`  y bajando a 420 plazas (quito las ${recorte.length} peores): media ${(t3/420).toFixed(2)}`);
  console.log('\ncandidatas mas frecuentes sin plaza:');
  console.log(disponibles.slice(0,70).map(([w,c])=>`${w}:${c}`).join(' '));
  await p.$disconnect();
})();
