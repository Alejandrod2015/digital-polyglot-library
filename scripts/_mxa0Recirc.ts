/** Mide la escalera de recirculacion del journey y propone palabras candidatas:
 *  las que YA aparecen varias veces en los 21 cuerpos y no ocupan plaza. */
import { PrismaClient } from '../src/generated/prisma';
import fs from 'fs';
const p = new PrismaClient();
(async () => {
  const st = await p.journeyStory.findMany({ where: { journeyId: 'cmud5qhu00006j81cmkl4u5ks', text: { not: null } }, select: { topic:true, slotIndex:true, slug:true, text:true, vocab:true }, orderBy:[{topic:'asc'},{slotIndex:'asc'}] });
  const t7 = JSON.parse(fs.readFileSync('scripts/_esA0Mexico/t7.json','utf8'));
  const todas = [...st.map(s=>({slug:s.slug,text:String(s.text),vocab:(s.vocab as any[])??[]})), ...t7.map((s:any)=>({slug:s.slug,text:s.text,vocab:s.vocab}))];
  const corpus = todas.map(s=>s.text.toLowerCase());
  const cuenta = (k: string) => {
    const re = new RegExp(`(?<!\\p{L})${k.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?!\\p{L})`,'u');
    return corpus.filter(t=>re.test(t)).length;
  };
  const filas: Array<{slug:string,w:string,n:number}> = [];
  for (const s of todas) for (const v of s.vocab) filas.push({ slug:String(s.slug), w:String(v.surface ?? v.word), n: cuenta(String(v.surface ?? v.word)) });
  const media = filas.reduce((a,b)=>a+b.n,0)/filas.length;
  console.log(`plazas ${filas.length} · media ${media.toFixed(2)} · una sola vez ${filas.filter(f=>f.n<=1).length}`);
  // palabras del corpus que salen en 3+ historias y NO tienen plaza
  const ocup = new Set(filas.map(f=>f.w.toLowerCase()));
  const freq = new Map<string, number>();
  for (const t of corpus) {
    for (const w of new Set(t.replace(/[^\p{L}\s]/gu,' ').split(/\s+/).filter(x=>x.length>3)))
      freq.set(w, (freq.get(w)??0)+1);
  }
  const cand = [...freq.entries()].filter(([w,n])=>n>=4 && !ocup.has(w)).sort((a,b)=>b[1]-a[1]);
  console.log('\ncandidatas (salen en 4+ historias, sin plaza):');
  console.log(cand.slice(0,60).map(([w,n])=>`${w}(${n})`).join(', '));
  console.log('\nplazas que salen una sola vez, por historia:');
  const porSlug = new Map<string,string[]>();
  for (const f of filas) if (f.n<=1) porSlug.set(f.slug, [...(porSlug.get(f.slug)??[]), f.w]);
  for (const [k,v] of porSlug) console.log(`  ${k} (${v.length}): ${v.join(', ')}`);
  await p.$disconnect();
})();
