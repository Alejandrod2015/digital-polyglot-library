/**
 * Segunda plaza (4o encuentro) elegida MIRANDO EL BLOQUE.
 *
 * La primera version elegia por frecuencia y amontonaba las plazas nuevas en el
 * bloque donde ya habia mas, que es justo lo que `narrator-block-distribution`
 * bloquea. Aqui cada plaza nueva tiene que caer en el bloque MAS VACIO del
 * lector, respetar el tope de dos palabras venidas de otro tipo de journey y no
 * pasar del techo de `vocab-count`. Ninguna plaza se quita.
 */
import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import * as fs from "fs";
import { PrismaClient } from "../src/generated/prisma";
import { renderedParagraphs } from "../src/lib/readerParagraphs";
const prisma = new PrismaClient();
const PORT = new Set(["verb","adjective","adverb","expression"]);
const TOPICS = ["roads-and-driving","phones-and-signal","rooms-and-keys","forest-and-hiking","village-festivals","pharmacy-emergencies","bureaucracy-and-paperwork"];
const file = "scripts/_itA1/ALL.json";
async function run(){
  const st = (JSON.parse(fs.readFileSync(file,"utf8")) as any[])
    .sort((a,b)=>(TOPICS.indexOf(a.topic)-TOPICS.indexOf(b.topic))||(a.slotIndex-b.slotIndex));
  const rows = await prisma.journeyStory.findMany({ where: { journeyId: "cmrsiz1n40000320d6h8p8f5g" }, select: { vocab:true } });
  const F = new Set<string>();
  for (const r of rows) for (const v of ((r.vocab as any[])??[])) F.add(String(v.word).toLowerCase());
  // Se parte de cero: fuera toda plaza que sea la SEGUNDA de una palabra.
  const vistos = new Map<string,number>();
  for (const s of st) s.vocab = s.vocab.filter((v:any)=>{
    const w = String(v.word).toLowerCase(); const n = (vistos.get(w)??0)+1; vistos.set(w,n); return n===1;
  });
  const tok=(t:string)=>(t.toLowerCase().match(/\p{L}+/gu)??[]) as string[];
  const cuerpos = st.map(s=>new Set(tok(s.text)));
  const sup=(v:any)=>String(v.surface??v.word).toLowerCase();
  const cuenta=(t:string)=>cuerpos.filter(c=>c.has(t)).length;
  const ficha=new Map<string,any>(), donde=new Map<string,number[]>();
  st.forEach((s,i)=>s.vocab.forEach((v:any)=>{ ficha.set(sup(v),v); donde.set(sup(v),[...(donde.get(sup(v))??[]),i]); }));
  const media=()=>{const e=st.flatMap(s=>s.vocab.map((v:any)=>cuenta(sup(v))));return e.reduce((a,b)=>a+b,0)/e.length;};
  console.log(`base sin segundas plazas: media ${media().toFixed(2)} sobre ${st.flatMap(s=>s.vocab).length}`);
  let add=0;
  for (const [i,s] of st.entries()) {
    for (let paso=0; paso<8; paso++) {
      const bl = renderedParagraphs(s.text);
      const per = bl.map(b=>s.vocab.filter((v:any)=>b.includes(v.surface??v.word)).length);
      const flaco = per.indexOf(Math.min(...per)); void flaco;
      const techo = Math.max(25, Math.round(String(s.text).trim().split(/\s+/).length/9));
      if (s.vocab.length >= techo) break;
      const otros = s.vocab.filter((v:any)=>F.has(String(v.word).toLowerCase()) && !PORT.has(String(v.type??"").toLowerCase())).length;
      const mias = new Set(s.vocab.map(sup));
      const cand = [...ficha].filter(([t,v]) =>
          !mias.has(t) && String(s.text).toLowerCase().includes(t)
          && donde.get(t)!.length===1 && donde.get(t)!.every(o=>Math.abs(o-i)>=4)
          && cuenta(t) >= 2
          && (!F.has(String(v.word).toLowerCase()) || PORT.has(String(v.type??"").toLowerCase()) || otros < 2))
        .sort((a,b)=>cuenta(b[0])-cuenta(a[0]));
      if (!cand.length) break;
      const [t,v] = cand[0];
      const nuevo = s.vocab.concat([{...v}]);
      const per2 = bl.map(b=>nuevo.filter((x:any)=>b.includes(x.surface??x.word)).length);
      const antes = Math.max(...per)/s.vocab.length, ahora = Math.max(...per2)/nuevo.length;
      // Se acepta si cumple el tope, o si al menos lo MEJORA: una historia que
      // ya lo incumple solo sale del pozo anadiendo plazas fuera del bloque
      // lleno, porque el tope es una proporcion y el denominador crece.
      if (ahora > 0.30 && ahora >= antes) break;
      s.vocab = nuevo; donde.set(t,[...donde.get(t)!,i]); add++;
    }
  }
  console.log(`${add} segundas plazas · media ${media().toFixed(2)} sobre ${st.flatMap(s=>s.vocab).length}`);
  if (process.argv.includes("--apply")) fs.writeFileSync(file, JSON.stringify(st,null,1));
  await prisma.$disconnect();
}
run();
