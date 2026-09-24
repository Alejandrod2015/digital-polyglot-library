/** La escalera cuenta TODAS las formas de un verbo, asi que una plaza de verbo
 *  recircula sola. Propone, por historia, verbos presentes que aun no ocupan
 *  plaza y cuentan mas que la plaza mas floja que tiene. */
import { PrismaClient } from '../../src/generated/prisma';
import { formasDeVerbo } from '../../src/lib/cefr/spanishConjugations';
import fs from 'fs';
const p = new PrismaClient();
const INF = /(ar|er|ir)$/;
(async () => {
  const files = process.argv.slice(2);
  const st = await p.journeyStory.findMany({ where: { journeyId: 'cmud5qhu00006j81cmkl4u5ks', text: { not: null } }, select: { slug:true, text:true, vocab:true } });
  const t7 = JSON.parse(fs.readFileSync('scripts/_esA0Mexico/t7.json','utf8'));
  const todas = [...st.map(s=>({slug:String(s.slug),text:String(s.text),vocab:(s.vocab as any[])??[]})), ...t7.map((s:any)=>({slug:s.slug,text:s.text,vocab:s.vocab}))];
  const cuerpos = todas.map(s=>new Set(s.text.toLowerCase().replace(/[^\p{L}\s]/gu,' ').split(/\s+/)));
  const ocup = new Set(todas.flatMap(s=>s.vocab.map((v:any)=>String(v.word).toLowerCase())));
  const cuenta = (w: string) => {
    if (INF.test(w)) { const f = formasDeVerbo(w); return cuerpos.filter(c=>[...f].some(x=>c.has(x))).length; }
    return cuerpos.filter(c=>c.has(w.toLowerCase())).length;
  };
  const bl = new Set<string>(JSON.parse(fs.readFileSync('scripts/_mxa0-bloqueadas.json','utf8')).tope2);
  // verbos candidatos: infinitivos frecuentes del espanol A0 cuyas formas salgan aqui
  const CAND = 'entrar salir subir bajar mirar tomar dejar llevar traer poner sacar meter abrir cerrar buscar encontrar llegar llamar pasar quedar volver seguir contar esperar tocar pedir decir hacer querer poder saber ver dar ir venir oir sentir preguntar contestar reir sonreir pensar creer entender aprender ensenar guardar quitar juntar juntar limpiar lavar secar colgar tender doblar cortar pintar cargar apuntar revisar prestar prender apagar romper arreglar cuidar ayudar trabajar descansar caminar correr comer beber dormir vivir'.split(' ');
  for (const f of files) {
    const d = JSON.parse(fs.readFileSync(f,'utf8'));
    for (const s of d) {
      const cuerpo = new Set(String(s.text).toLowerCase().replace(/[^\p{L}\s]/gu,' ').split(/\s+/));
      const flojas = s.vocab.map((v:any)=>({w:v.word, n:cuenta(String(v.surface??v.word))})).sort((a:any,b:any)=>a.n-b.n).slice(0,6);
      const cands = CAND.filter(v=>!ocup.has(v) && !bl.has(v) && [...formasDeVerbo(v)].some(x=>cuerpo.has(x)))
        .map(v=>({v, n:cuenta(v)})).filter(x=>x.n>=3).sort((a,b)=>b.n-a.n).slice(0,6);
      console.log(`${s.slug}\n   flojas: ${flojas.map((x:any)=>`${x.w}(${x.n})`).join(' ')}\n   verbos: ${cands.map(x=>`${x.v}(${x.n})`).join(' ')}`);
    }
  }
  await p.$disconnect();
})();
