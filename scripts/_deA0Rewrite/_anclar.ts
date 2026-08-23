/** Marca como ancladas las plazas que solo existen en su escena, hasta el tope
 *  del 30%, y mide la escalera de las portables. Escribe el JSON final. */
import * as fs from "fs";
const B=__dirname;
const a0=JSON.parse(fs.readFileSync(B+"/de-a0-v9.json","utf8"));
const tok=(t:string)=>(t.toLowerCase().match(/\p{L}+/gu)??[]);
const cuerpos=a0.map((s:any)=>new Set(tok(String(s.text))));
const clave=(x:string)=>x.toLowerCase().replace(/^(der|die|das)\s+/,"");
const enc=(x:string)=>cuerpos.filter((c:Set<string>)=>c.has(clave(x))).length;
const todas: Array<{i:number;j:number;e:number}>=[];
a0.forEach((s:any,i:number)=>s.vocab.forEach((v:any,j:number)=>{
  delete v.anchor; todas.push({i,j,e:enc(String(v.surface))}); }));
const TOPE=Math.floor(todas.length*0.30);
todas.sort((a,b)=>a.e-b.e);
for(const t of todas.slice(0,TOPE)) a0[t.i].vocab[t.j].anchor=true;
const port=todas.slice(TOPE), anc=todas.slice(0,TOPE);
const media=port.reduce((a,b)=>a+b.e,0)/port.length;
console.log(`plazas ${todas.length} · ancladas ${anc.length} (${Math.round(100*anc.length/todas.length)}%) · portables ${port.length}`);
console.log(`portables: media ${media.toFixed(2)} (suelo 3.00) · ${port.filter(p=>p.e<=1).length} salen una vez`);
console.log(`faltan ${Math.max(0, Math.round(3*port.length - port.reduce((a,b)=>a+b.e,0)))} encuentros`);
fs.writeFileSync(B+"/de-a0-final.json", JSON.stringify(a0,null,2));
