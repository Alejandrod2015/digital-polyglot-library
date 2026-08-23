import * as fs from "fs";
const B="/Users/alejandrodelcarpio/digital-polyglot-library/.claude/worktrees/practical-austin-02dea1/scripts/_deA0Rewrite";
const a0=JSON.parse(fs.readFileSync(B+"/de-a0-final.json","utf8"));
const tok=(t:string)=>(t.toLowerCase().match(/\p{L}+/gu)??[]);
const cuerpos=a0.map((s:any)=>new Set(tok(String(s.text))));
const clave=(x:string)=>x.toLowerCase().replace(/^(der|die|das)\s+/,"");
const enc=(x:string)=>cuerpos.filter((c:Set<string>)=>c.has(clave(x))).length;
const sol:string[]=[];
a0.forEach((s:any,i:number)=>{ for(const v of s.vocab){
  if(v.anchor) continue;
  if(enc(String(v.surface))<=1) sol.push(`h${i+1} ${v.word} [${v.surface}]`);
}});
console.log(`portables con un solo encuentro: ${sol.length} (tope 30% de 294 = 88)`);
console.log(sol.join("\n"));
