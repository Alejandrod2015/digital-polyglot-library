/** Cambia, en cada historia, su plaza mas floja por un VERBO del cuerpo que aun
 *  no ocupa plaza. La escalera cuenta todas las formas del verbo, asi que una
 *  plaza de verbo recircula sola, sin tocar una linea de prosa. */
import { PrismaClient } from '../../src/generated/prisma';
import { formasDeVerbo } from '../../src/lib/cefr/spanishConjugations';
import fs from 'fs';
const p = new PrismaClient();
const DEF: Record<string,string> = {
  decir: 'To say; to put something into words.',
  dar: 'To give; to hand something to another person.',
  tomar: 'To take something, or to drink it.',
  llevar: 'To carry something with you from one place to another.',
  dejar: 'To leave something in a place and not take it.',
  querer: 'To want something, or to love a person.',
  secar: 'To dry; to take the water out of something.',
  juntar: 'To put things together in one place.',
  mirar: 'To look at something for a while.',
  poner: 'To place something somewhere.',
  sacar: 'To take something out of a place.',
  pasar: 'To go past, or to happen.',
  volver: 'To go back to the place you were.',
  contar: 'To tell somebody what happened.',
  llamar: 'To call somebody by name or by phone.',
  cerrar: 'To close something that was open.',
  cargar: 'To carry something heavy.',
  caminar: 'To walk; to go on foot.',
  ayudar: 'To do part of the work with another person.',
  dormir: 'To sleep; to rest with your eyes closed.',
  comer: 'To eat; to put food in your mouth.',
  ver: 'To see; to notice with your eyes.',
  hacer: 'To make or to do something.',
  llegar: 'To arrive; to get to a place.',
  salir: 'To go out of a place.',
  subir: 'To go up.',
  bajar: 'To go down.',
  abrir: 'To open something that was closed.',
  buscar: 'To look for something you want to find.',
  quedar: 'To stay, or to end up a certain way.',
  pedir: 'To ask for something you want.',
  saber: 'To know a thing, or to know how to do it.',
  venir: 'To come to the place where you are.',
  trabajar: 'To do a job for money.',
  esperar: 'To wait until the right moment.',
  entrar: 'To go inside a place.',
  vivir: 'To live; to have your home somewhere.',
  oir: 'To hear a sound with your ears.',
  correr: 'To move fast on your feet.',
  cuidar: 'To take care of a person or a thing.',
  limpiar: 'To take the dirt off something.',
};
(async () => {
  const st = await p.journeyStory.findMany({ where: { journeyId: 'cmud5qhu00006j81cmkl4u5ks', text: { not: null } }, select: { text:true, vocab:true } });
  const t7 = JSON.parse(fs.readFileSync('scripts/_esA0Mexico/t7.json','utf8'));
  const cuerpos = [...st.map(s=>String(s.text)), ...t7.map((s:any)=>s.text)]
    .map(t=>new Set(t.toLowerCase().replace(/[^\p{L}\s]/gu,' ').split(/\s+/)));
  const ocup = new Set([...st.flatMap(s=>((s.vocab as any[])??[]).map(v=>String(v.word).toLowerCase())),
                        ...t7.flatMap((s:any)=>s.vocab.map((v:any)=>String(v.word).toLowerCase()))]);
  const bl = new Set<string>(JSON.parse(fs.readFileSync('scripts/_mxa0-bloqueadas.json','utf8')).tope2);
  const cuenta = (w: string) => /(ar|er|ir)$/.test(w)
    ? cuerpos.filter(c=>[...formasDeVerbo(w)].some(x=>c.has(x))).length
    : cuerpos.filter(c=>c.has(w.toLowerCase())).length;
  for (const f of process.argv.slice(2)) {
    const d = JSON.parse(fs.readFileSync(f,'utf8'));
    for (const s of d) {
      const cuerpo = new Set(String(s.text).toLowerCase().replace(/[^\p{L}\s]/gu,' ').split(/\s+/));
      const cands = Object.keys(DEF)
        .filter(v=>!ocup.has(v) && !bl.has(v) && [...formasDeVerbo(v)].some(x=>cuerpo.has(x)))
        .map(v=>({v, n:cuenta(v), forma:[...formasDeVerbo(v)].find(x=>cuerpo.has(x))!}))
        .sort((a,b)=>b.n-a.n);
      const floja = [...s.vocab].map((v:any)=>({v, n:cuenta(String(v.surface??v.word))})).sort((a,b)=>a.n-b.n)[0];
      if (!cands.length) { console.log(`${s.slug}: sin verbo libre`); continue; }
      const c = cands[0];
      s.vocab = s.vocab.filter((v:any)=>v.word !== floja.v.word);
      s.vocab.push({ type:'verb', word:c.v, surface:c.forma, definition:DEF[c.v] });
      ocup.add(c.v);
      console.log(`${s.slug}: -${floja.v.word}(${floja.n}) +${c.v}(${c.n}) [${c.forma}]`);
    }
    fs.writeFileSync(f, JSON.stringify(d, null, 1));
  }
  await p.$disconnect();
})();
