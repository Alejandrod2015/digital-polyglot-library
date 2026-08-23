/** Añade segundas plazas SIN reiniciar las que ya hay. Aditivo puro. */
import * as fs from "fs";
import { renderedParagraphs } from "../src/lib/readerParagraphs";
const file="scripts/_itA1/ALL.json";
const st=JSON.parse(fs.readFileSync(file,"utf8")) as any[];
const tok=(t:string)=>(t.toLowerCase().match(/\p{L}+/gu)??[]) as string[];
const cuerpos=st.map(s=>new Set(tok(s.text)));
const sup=(v:any)=>String(v.surface??v.word).toLowerCase();
const cuenta=(t:string)=>cuerpos.filter(c=>c.has(t)).length;
const raiz=(w:string)=>w.toLowerCase().slice(0,5);
const media=()=>{const e=st.flatMap(s=>s.vocab.map((v:any)=>cuenta(sup(v))));return e.reduce((a,b)=>a+b,0)/e.length;};
const veces=(w:string)=>st.reduce((n,s)=>n+s.vocab.filter((v:any)=>String(v.word).toLowerCase()===w).length,0);
const objetivo=Number(process.argv[2]??2.52);
console.log(`antes ${media().toFixed(3)}`);
let add=0;
for (let vuelta=0; vuelta<4 && media()<objetivo; vuelta++)
for (const [i,s] of st.entries()) {
  if (media()>=objetivo) break;
  const bl=renderedParagraphs(s.text);
  const techo=Math.max(25, Math.round(String(s.text).trim().split(/\s+/).length/9));
  if (s.vocab.length>=techo) continue;
  const mias=new Set(s.vocab.map(sup)); const raices=new Set(s.vocab.map((v:any)=>raiz(String(v.word))));
  const cand=st.flatMap((d,k)=>k===i?[]:d.vocab.map((v:any)=>({v,k})))
    .filter(({v,k}:any)=>!mias.has(sup(v)) && !raices.has(raiz(String(v.word)))
      && veces(String(v.word).toLowerCase())===1 && Math.abs(k-i)>=4 && cuerpos[i].has(sup(v)) && cuenta(sup(v))>=3)
    .sort((a:any,b:any)=>cuenta(sup(b.v))-cuenta(sup(a.v)))[0];
  if(!cand) continue;
  const nuevo=s.vocab.concat([{...cand.v}]);
  const per=bl.map(b=>nuevo.filter((x:any)=>b.includes(x.surface??x.word)).length);
  if (Math.max(...per)/nuevo.length>0.30) continue;
  s.vocab=nuevo; add++;
  console.log(`  ${s.slug}: +${sup(cand.v)}(${cuenta(sup(cand.v))}) -> ${media().toFixed(3)}`);
}
console.log(`${add} añadidas · media ${media().toFixed(3)}`);
if (process.argv.includes("--apply")) fs.writeFileSync(file, JSON.stringify(st,null,1));
