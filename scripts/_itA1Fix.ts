/**
 * Cambia una plaza del bloque LLENO por otra del bloque VACIO, sin tocar el
 * numero de plazas ni las ancladas. Es lo que pide `narrator-block-distribution`,
 * que mide sobre los bloques que el lector pinta y no sobre los parrafos.
 */
import * as fs from "fs";
import { renderedParagraphs } from "../src/lib/readerParagraphs";
const TOPICS = ["roads-and-driving","phones-and-signal","rooms-and-keys","forest-and-hiking","village-festivals","pharmacy-emergencies","bureaucracy-and-paperwork"];
const PORT = new Set(["verb","adjective","adverb","expression"]);
const file="scripts/_itA1/ALL.json";
const st = (JSON.parse(fs.readFileSync(file,"utf8")) as any[])
  .sort((a,b)=>(TOPICS.indexOf(a.topic)-TOPICS.indexOf(b.topic))||(a.slotIndex-b.slotIndex));
const tok=(t:string)=>(t.toLowerCase().match(/\p{L}+/gu)??[]) as string[];
const cuerpos=st.map(s=>new Set(tok(s.text)));
const sup=(v:any)=>String(v.surface??v.word).toLowerCase();
const cuenta=(t:string)=>cuerpos.filter(c=>c.has(t)).length;
const raiz=(w:string)=>w.toLowerCase().slice(0,5);
const ficha=new Map<string,any>(), donde=new Map<string,number[]>();
st.forEach((s,i)=>s.vocab.forEach((v:any)=>{ ficha.set(sup(v),v); donde.set(sup(v),[...(donde.get(sup(v))??[]),i]); }));
const media=()=>{const e=st.flatMap(s=>s.vocab.map((v:any)=>cuenta(sup(v))));return e.reduce((a,b)=>a+b,0)/e.length;};
console.log(`antes ${media().toFixed(2)} sobre ${st.flatMap(s=>s.vocab).length}`);
for (const [i,s] of st.entries()) {
  for (let paso=0; paso<10; paso++) {
    const bl=renderedParagraphs(s.text);
    const per=bl.map(b=>s.vocab.filter((v:any)=>b.includes(v.surface??v.word)));
    const share=Math.max(...per.map(p=>p.length))/s.vocab.length;
    if (share<=0.30) break;
    const iMax=per.reduce((a,b,k)=>per[a].length>=b.length?a:k,0);
    const iMin=per.reduce((a,b,k)=>per[a].length<=b.length?a:k,0);
    const mias=new Set(s.vocab.map(sup));
    const raices=new Set(s.vocab.map((v:any)=>raiz(String(v.word))));
    // Entra: cualquier plaza ya enseñada lejos cuya forma viva SOLO en el bloque vacio.
    const entra=[...ficha].filter(([t,v])=>!mias.has(t) && bl[iMin].toLowerCase().includes(t)
        && !bl[iMax].toLowerCase().includes(t) && !raices.has(raiz(t))
        && donde.get(t)!.length===1 && donde.get(t)!.every(o=>Math.abs(o-i)>=4) && cuenta(t)>=2)
      .sort((a,b)=>cuenta(b[0])-cuenta(a[0]))[0];
    // Sale: del bloque lleno, una portable o una plaza repetida; nunca un ancla.
    const sale=per[iMax].filter((v:any)=>PORT.has(v.type) || (donde.get(sup(v))?.length??1)>1)
      .sort((a:any,b:any)=>cuenta(sup(a))-cuenta(sup(b)))[0];
    if (!sale) break;
    s.vocab=s.vocab.filter((x:any)=>x!==sale);
    if (entra) { s.vocab=s.vocab.concat([{...entra[1]}]); donde.set(entra[0],[...donde.get(entra[0])!,i]); }
    if (s.vocab.length<20) { s.vocab=s.vocab.concat([{...sale}]); break; }
  }
}
console.log(`despues ${media().toFixed(2)} sobre ${st.flatMap(s=>s.vocab).length} · fuera de reparto: ${st.filter(s=>{const bl=renderedParagraphs(s.text);const per=bl.map(b=>s.vocab.filter((v:any)=>b.includes(v.surface??v.word)).length);return Math.max(...per)/s.vocab.length>0.30;}).length}`);
if (process.argv.includes("--apply")) fs.writeFileSync(file, JSON.stringify(st,null,1));
