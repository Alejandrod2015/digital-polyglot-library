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
const yaSlot=new Set<string>(); for(const s of a0) for(const v of (s.vocab??[])) yaSlot.add(lema(v.word));
const STOP=new Set(("der die das ein eine einen einem einer eines und oder aber denn sondern nicht kein keine ist sind war waren sein hat habe haben hatte ich du er sie es wir ihr mich dich sich uns euch mein dein ihre ihr seine unser von zu mit nach bei aus vor über unter auf an in im am zum zur als wie wenn dass weil dann noch schon nur auch sehr mehr man wer was wo hier dort jetzt heute immer nie oft doch ja nein bis durch für gegen ohne um seit dem den des dieser diese dieses jede jeder jedes alle alles etwas nichts viel viele wieder ganz gut ihm ihn wird werden kann können muss müssen will wollen soll sollen darf dürfen mag mögen dass").split(/\s+/));
for(const i of [0,1,2]){
  const s=a0[i];
  console.log(`\n########## ${i+1} ${s.title} (${s.vocab.length} plazas)`);
  for(const v of s.vocab){
    const k=lema(v.word);
    const fuera = first.get(k)!==i || ext.has(k);
    const por = first.get(k)!==i ? `dup(1a en h${(first.get(k)??0)+1})` : "";
    const por2 = ext.has(k) ? "choca A1" : "";
    console.log(`${fuera?"QUITA":"queda"}\t${v.type}\t${v.word}\t${v.surface}\t${[por,por2].filter(Boolean).join(" ")}`);
  }
  const toks=[...new Set((String(s.text).toLowerCase().match(/\p{L}+/gu)??[]).filter((t:string)=>t.length>=4&&!STOP.has(t)))];
  const libres=toks.filter(t=>!yaSlot.has(lema(t))&&!ext.has(lema(t)));
  console.log("LIBRES:", libres.join(" "));
}
