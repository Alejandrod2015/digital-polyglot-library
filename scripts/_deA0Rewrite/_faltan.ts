import * as fs from "fs";
const B="/Users/alejandrodelcarpio/digital-polyglot-library/.claude/worktrees/practical-austin-02dea1/scripts/_deA0Rewrite";
const a0=JSON.parse(fs.readFileSync(B+"/de-a0-v9.json","utf8"));
const tok=(t:string)=>(t.toLowerCase().match(/\p{L}+/gu)??[]);
const cuerpos=a0.map((s:any)=>new Set(tok(String(s.text))));
const clave=(x:string)=>x.toLowerCase().replace(/^(der|die|das)\s+/,"");
const uso=new Map<string,{slots:number;sup:string}>();
a0.forEach((s:any)=>{for(const v of s.vocab){const k=clave(String(v.surface));
  const e=uso.get(k)??{slots:0,sup:String(v.surface)}; e.slots++; uso.set(k,e);}});
const enc=(k:string)=>cuerpos.filter((c:Set<string>)=>c.has(k)).length;
const dobles=[...uso.entries()].filter(([k,e])=>e.slots===2&&enc(k)<4);
a0.forEach((s:any,i:number)=>{
  const faltan=dobles.filter(([k])=>!cuerpos[i].has(k)).map(([k,e])=>e.sup);
  console.log(`${i+1} ${s.title}\n   ${faltan.join(" ")}`);
});
