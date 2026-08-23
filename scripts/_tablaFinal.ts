import * as fs from "fs";
const B="/Users/alejandrodelcarpio/digital-polyglot-library/.claude/worktrees/practical-austin-02dea1/scripts/_deA0Rewrite";
const a0=JSON.parse(fs.readFileSync(B+"/de-a0-v9.json","utf8"));
const tok=(t:string)=>(t.toLowerCase().match(/\p{L}+/gu)??[]);
const cuerpos=a0.map((s:any)=>new Set(tok(String(s.text))));
const clave=(x:string)=>x.toLowerCase().replace(/^(der|die|das)\s+/,"");
const enc=(x:string)=>cuerpos.filter((c:Set<string>)=>c.has(clave(x))).length;
let tot=0, una=0;
a0.forEach((s:any,i:number)=>{
  const w=String(s.text).split(/\s+/).length;
  const q=(String(s.text).match(/“([^”]*)”/g)??[]).join(" ").split(/\s+/).filter(Boolean).length;
  const es=s.vocab.map((v:any)=>enc(String(v.surface)));
  tot+=es.reduce((a:number,b:number)=>a+b,0); una+=es.filter((n:number)=>n<=1).length;
  console.log([i+1, s.slug, s.title, w, Math.round(100*q/w), s.vocab.length,
    (es.reduce((a:number,b:number)=>a+b,0)/es.length).toFixed(2), es.filter((n:number)=>n<=1).length].join("\t"));
});
console.log(`TOTAL media ${(tot/420).toFixed(2)} · ${una}/420 salen una vez`);
