import * as fs from "fs";
const DIR = "/Users/alejandrodelcarpio/digital-polyglot-library/.claude/worktrees/de-b1-friends-texto/scripts/_deB1Friends";
const last = (t:string) => { const p=t.trim().split(/\n{2,}/).pop()??""; const s=p.split(/(?<=[.!?])\s/); return (s[s.length-1]??p).trim(); };
const rows:any[]=[]; for(let i=1;i<=7;i++) for(const s of JSON.parse(fs.readFileSync(`${DIR}/t${i}.json`,"utf8"))) rows.push({...s,t:i});
let nebenIni=0, nebenAny=0, plusName=0; const slots:string[]=[];
for (const s of rows){ const l=last(s.text);
  if(/^Neben\b/.test(l)){nebenIni++; slots.push(`t${s.t}#${s.slotIndex}`);}
  if(/\bneben\b/i.test(l)) nebenAny++;
  if(/\b[Nn]eben (Bastian|Tobias|Miriam|Verena|Lena)/.test(l)) plusName++; }
console.log(`ultima oracion que EMPIEZA por "Neben": ${nebenIni}/21  -> ${slots.join(", ")}`);
console.log(`ultima oracion que contiene "neben":    ${nebenAny}/21`);
console.log(`"neben + nombre del reparto" en la ultima: ${plusName}/21`);
// y en el cuerpo entero
let cuerpo=0; for(const s of rows) if(/\bneben\b/i.test(s.text)) cuerpo++;
console.log(`historias con "neben" en cualquier sitio: ${cuerpo}/21`);
// arranque de la ultima: primera palabra
const m=new Map<string,number>(); for(const s of rows){const w=last(s.text).split(/\s+/)[0]?.replace(/[:,]$/,"")??""; m.set(w,(m.get(w)||0)+1);}
console.log("primera palabra de la ULTIMA oracion, 2+:");
for(const [k,v] of [...m].sort((a,b)=>b[1]-a[1])) if(v>=2) console.log(`  ${String(v).padStart(2)}/21  "${k}"`);
