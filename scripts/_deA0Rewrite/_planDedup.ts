/** Plan de limpieza: que plaza duplicada se queda y cuales se van.
 *  La plaza se queda en la PRIMERA historia donde aparece, para que el alumno
 *  la conozca pronto y la reencuentre despues en los cuerpos, que es justo lo
 *  que premia la escalera. Solo lectura: escribe un JSON, no toca la base. */
import * as fs from "fs";
const SEP=["an","auf","aus","ein","nach","vor","zu","ab","mit","bei"], COM=["ge","ver","be","er","ent"], ART=["der ","die ","das "];
function sp(w:string){let l=w.toLowerCase();for(const a of ART)if(l.startsWith(a)){l=l.slice(a.length);break;}
  for(const q of [...SEP,...COM])if(l.startsWith(q)&&l.length>q.length+3)return l.slice(q.length);return l;}
const lema=(w:string)=>sp(w).normalize("NFD").replace(/[̀-ͯ]/g,"").trim();
const data = JSON.parse(fs.readFileSync("" + __dirname + "/de-a0-all.json","utf8"));
const first = new Map<string, number>();
data.forEach((s:any,i:number)=>{ for(const v of (s.vocab??[])) { const k=lema(v.word); if(!first.has(k)) first.set(k,i); } });
const plan = data.map((s:any,i:number)=>({
  n: i+1, topic: s.topic, slotIndex: s.slotIndex, title: s.title, plazas: s.vocab.length,
  quitar: s.vocab.filter((v:any)=>first.get(lema(v.word))!==i).map((v:any)=>v.word),
}));
fs.writeFileSync("" + __dirname + "/de-a0-dedup-plan.json", JSON.stringify(plan,null,2));
let tot=0; for(const r of plan){ tot+=r.quitar.length;
  console.log(`${String(r.n).padStart(2)}  ${String(r.title).slice(0,36).padEnd(36)} quita ${String(r.quitar.length).padStart(2)} de ${r.plazas}: ${r.quitar.slice(0,7).join(", ")}`); }
console.log(`\nplazas a liberar: ${tot}`);
