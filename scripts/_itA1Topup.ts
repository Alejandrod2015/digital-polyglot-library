/** Sube a 20 plazas las historias que se quedaron cortas, sin romper el reparto por bloques. */
import * as fs from "fs";
import { renderedParagraphs } from "../src/lib/readerParagraphs";
const TOPICS = ["roads-and-driving","phones-and-signal","rooms-and-keys","forest-and-hiking","village-festivals","pharmacy-emergencies","bureaucracy-and-paperwork"];
const file="scripts/_itA1/ALL.json";
const dic = JSON.parse(fs.readFileSync("scripts/_itA1/portables.json","utf8")) as Record<string,{type:string,forms:string[],def:string}>;
const st = (JSON.parse(fs.readFileSync(file,"utf8")) as any[])
  .sort((a,b)=>(TOPICS.indexOf(a.topic)-TOPICS.indexOf(b.topic))||(a.slotIndex-b.slotIndex));
const tok=(t:string)=>(t.toLowerCase().match(/\p{L}+/gu)??[]) as string[];
const cuerpos = st.map(s=>new Set(tok(s.text)));
const cuenta=(t:string)=>cuerpos.filter(c=>c.has(t)).length;
const raiz=(w:string)=>w.toLowerCase().slice(0,5);
const usados = new Set(st.flatMap(s=>s.vocab.map((v:any)=>String(v.word).toLowerCase())));
let add=0;
for (const [i,s] of st.entries()) {
  while (s.vocab.length < 20) {
    const bl = renderedParagraphs(s.text);
    const per = bl.map(b=>s.vocab.filter((v:any)=>b.includes(v.surface??v.word)).length);
    const flaco = per.indexOf(Math.min(...per));
    const raices = new Set(s.vocab.map((v:any)=>raiz(String(v.word))));
    const cand = Object.entries(dic)
      .filter(([lema]) => !usados.has(lema) && !raices.has(raiz(lema)))
      .map(([lema,f]) => ({lema,f,forma:f.forms.find(x=>bl[flaco].toLowerCase().includes(x))}))
      .filter(x=>!!x.forma && !raices.has(raiz(x.forma!)))
      .map(x=>({...x,n:cuenta(x.forma!)})).sort((a,b)=>b.n-a.n)[0];
    if (!cand) break;
    const nuevo = s.vocab.concat([{word:cand.lema,surface:cand.forma,type:cand.f.type,definition:cand.f.def}]);
    const per2 = bl.map(b=>nuevo.filter((x:any)=>b.includes(x.surface??x.word)).length);
    if (Math.max(...per2)/nuevo.length > 0.30) break;
    s.vocab = nuevo; usados.add(cand.lema); add++;
  }
}
console.log(`${add} plazas anadidas · ${st.filter(s=>s.vocab.length<20).length} historias siguen por debajo de 20`);
if (process.argv.includes("--apply")) fs.writeFileSync(file, JSON.stringify(st,null,1));
