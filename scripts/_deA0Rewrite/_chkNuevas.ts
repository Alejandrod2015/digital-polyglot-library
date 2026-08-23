import * as fs from "fs";
const SEP=["an","auf","aus","ein","nach","vor","zu","ab","mit","bei"], COM=["ge","ver","be","er","ent"], ART=["der ","die ","das "];
function sp(w:string){let l=w.toLowerCase();for(const a of ART)if(l.startsWith(a)){l=l.slice(a.length);break;}
  for(const q of [...SEP,...COM])if(l.startsWith(q)&&l.length>q.length+3)return l.slice(q.length);return l;}
const lema=(w:string)=>sp(w).normalize("NFD").replace(/[̀-ͯ]/g,"").trim();
const a0=JSON.parse(fs.readFileSync("" + __dirname + "/de-a0-all.json","utf8"));
const a1=JSON.parse(fs.readFileSync("/tmp/de-a1-all.json","utf8"));
const ext=new Map<string,string>(); for(const s of a1) for(const v of (s.vocab??[])) ext.set(lema(v.word), s.title);
const mio=new Map<string,string>(); for(const s of a0) for(const v of (s.vocab??[])) mio.set(lema(v.word), s.title);
const props: Record<number,string[]> = {
 1:[],
 2:[],
 3:["kommen","sehen","gern","alt","die Welle","stehen","nehmen","warum","einige"],
};
for(const [n,ws] of Object.entries(props)){
  const s=a0[Number(n)-1];
  console.log(`\n--- historia ${n}: ${s.title}`);
  for(const w of ws){
    const k=lema(w);
    const enTexto = new RegExp(w.replace(/^(der|die|das) /,"").slice(0,Math.max(4,w.length-6)),"i").test(s.text);
    console.log(`${w.padEnd(18)} lema=${k.padEnd(14)} yaSlotEnA0=${mio.has(k)?"SI ("+mio.get(k)+")":"no"}  enA1=${ext.has(k)?"SI":"no"}  raizEnTexto=${enTexto?"si":"NO"}`);
  }
}
