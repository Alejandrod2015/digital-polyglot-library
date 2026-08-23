import * as fs from "fs";
const SEP=["an","auf","aus","ein","nach","vor","zu","ab","mit","bei"], COM=["ge","ver","be","er","ent"], ART=["der ","die ","das "];
function sp(w:string){let l=w.toLowerCase();for(const a of ART)if(l.startsWith(a)){l=l.slice(a.length);break;}
  for(const q of [...SEP,...COM])if(l.startsWith(q)&&l.length>q.length+3)return l.slice(q.length);return l;}
const lema=(w:string)=>sp(w).normalize("NFD").replace(/[̀-ͯ]/g,"").trim();
const a0=JSON.parse(fs.readFileSync("" + __dirname + "/de-a0-all.json","utf8"));
const a1=JSON.parse(fs.readFileSync("/tmp/de-a1-all.json","utf8"));
const ext=new Set<string>(); for(const s of a1) for(const v of (s.vocab??[])) ext.add(lema(v.word));
const first=new Map<string,number>();
a0.forEach((s:any,i:number)=>{for(const v of (s.vocab??[])){const k=lema(v.word); if(!first.has(k)) first.set(k,i);}});
let tot=0;
console.log("n\thistoria\tplazas\ta rehacer\tquedan");
a0.forEach((s:any,i:number)=>{
  const fuera=s.vocab.filter((v:any)=>first.get(lema(v.word))!==i || ext.has(lema(v.word)));
  tot+=fuera.length;
  console.log([i+1, String(s.title).slice(0,34), s.vocab.length, fuera.length, s.vocab.length-fuera.length].join("\t"));
});
console.log("TOTAL plazas a rehacer:", tot, "de 494");
