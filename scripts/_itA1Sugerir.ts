/** Por historia: superficies ya enseñadas que NO estan en el cuerpo, y en que bloque hace falta. */
import * as fs from "fs";
import { renderedParagraphs } from "../src/lib/readerParagraphs";
const TOPICS = ["roads-and-driving","phones-and-signal","rooms-and-keys","forest-and-hiking","village-festivals","pharmacy-emergencies","bureaucracy-and-paperwork"];
const st = (JSON.parse(fs.readFileSync("scripts/_itA1/ALL.json","utf8")) as any[])
  .sort((a,b)=>(TOPICS.indexOf(a.topic)-TOPICS.indexOf(b.topic))||(a.slotIndex-b.slotIndex));
const tok=(t:string)=>(t.toLowerCase().match(/\p{L}+/gu)??[]) as string[];
const cuerpos = st.map(s=>new Set(tok(s.text)));
const sup=(v:any)=>String(v.surface??v.word).toLowerCase();
const cuenta=(t:string)=>cuerpos.filter(c=>c.has(t)).length;
const todas = new Map<string,number>();
st.forEach((s,i)=>s.vocab.forEach((v:any)=>todas.set(sup(v), i)));
for (const [i,s] of st.entries()) {
  const bl = renderedParagraphs(s.text);
  const per = bl.map(b=>s.vocab.filter((v:any)=>b.includes(v.surface??v.word)).length);
  const flaco = per.indexOf(Math.min(...per));
  const falta = [...todas].filter(([t,o])=>o!==i && !cuerpos[i].has(t))
    .map(([t])=>({t,n:cuenta(t)})).filter(x=>x.n>=3).sort((a,b)=>b.n-a.n).slice(0,14);
  console.log(`${s.slug.padEnd(32)} bloques[${per.join(",")}] flaco=b${flaco+1} · meter: ${falta.map(x=>`${x.t}(${x.n})`).join(" ")}`);
}
