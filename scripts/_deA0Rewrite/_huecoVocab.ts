/** ¿Hay palabras libres en cada cuerpo para sustituir las plazas duplicadas?
 *  Solo lectura. Dice si esto es una edicion o una reescritura. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import * as fs from "fs";
const p = new PrismaClient();
const SEP=["an","auf","aus","ein","nach","vor","zu","ab","mit","bei"], COM=["ge","ver","be","er","ent"], ART=["der ","die ","das "];
function sp(w:string){let l=w.toLowerCase();for(const a of ART)if(l.startsWith(a)){l=l.slice(a.length);break;}
  for(const q of [...SEP,...COM])if(l.startsWith(q)&&l.length>q.length+3)return l.slice(q.length);return l;}
const lema=(w:string)=>sp(w).normalize("NFD").replace(/[̀-ͯ]/g,"").trim();
const STOP = new Set(("der die das ein eine einen einem einer eines und oder aber denn sondern nicht kein keine ist sind war waren sein hat habe haben hatte ich du er sie es wir ihr mich dich sich uns euch mein dein ihre seine unser von zu mit nach bei aus vor über unter auf an in im am zum zur als wie wenn dass weil dann noch schon nur auch sehr mehr sehr man wer was wo hier dort jetzt heute morgen immer nie oft doch ja nein bis durch für gegen ohne um seit dem den des dieser diese dieses jede jeder jedes alle alles etwas nichts viel viele wieder ganz gut").split(/\s+/));
(async()=>{
  const a1 = await p.journeyStory.findMany({ where: { journeyId: "cmqfnp3tf000032afygkqp8z2" }, select: { vocab: true } });
  const ext = new Set<string>();
  for (const r of a1) for (const v of ((r.vocab as any[])??[])) if (v?.word) ext.add(lema(String(v.word)));
  const data = JSON.parse(fs.readFileSync("" + __dirname + "/de-a0-all.json","utf8"));
  const mias = new Map<string, number>();
  for (const s of data) for (const v of (s.vocab??[])) mias.set(lema(v.word), (mias.get(lema(v.word))??0)+1);
  console.log("n\thistoria\tplazas\tdup\tchoqueA1\thuecos libres en el cuerpo");
  data.forEach((s:any,i:number)=>{
    const ws = s.vocab.map((v:any)=>v.word);
    const dup = ws.filter((w:string)=>(mias.get(lema(w))??0)>1).length;
    const cho = ws.filter((w:string)=>ext.has(lema(w))).length;
    const toks = new Set((String(s.text).toLowerCase().match(/\p{L}+/gu)??[])
      .filter((t:string)=>t.length>=4 && !STOP.has(t)));
    const libres = [...toks].filter((t)=> !mias.has(lema(t)) && !ext.has(lema(t)));
    console.log([i+1, String(s.title).slice(0,34), ws.length, dup, cho, libres.length].join("\t"));
  });
  await p.$disconnect();
})();
