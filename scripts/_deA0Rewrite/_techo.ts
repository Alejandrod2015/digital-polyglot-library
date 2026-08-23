import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import * as fs from "fs";
const p = new PrismaClient();
const SEP=["an","auf","aus","ein","nach","vor","zu","ab","mit","bei"], COM=["ge","ver","be","er","ent"], ART=["der ","die ","das "];
function sp(w:string){let l=w.toLowerCase();for(const a of ART)if(l.startsWith(a)){l=l.slice(a.length);break;}
  for(const q of [...SEP,...COM])if(l.startsWith(q)&&l.length>q.length+3)return l.slice(q.length);return l;}
const lema=(w:string)=>sp(w).normalize("NFD").replace(/[̀-ͯ]/g,"").trim();
const J="cmt0a8vb1000m32p1x7r5ba28";
const STOP=new Set(("der die das ein eine einen einem einer eines und oder aber denn sondern nicht kein keine ist sind war waren sein hat habe haben hatte ich du er sie es wir ihr mich dich sich uns euch mein dein ihre seine unser von zu mit nach bei aus vor über unter auf an in im am zum zur als wie wenn dass weil dann noch schon nur auch sehr mehr man wer was wo hier dort jetzt heute immer nie oft doch ja nein bis durch für gegen ohne um seit dem den des dieser diese dieses jede jeder jedes alle alles etwas nichts viel viele wieder ganz ihm ihn wird werden kann können muss müssen will wollen soll sollen darf dürfen mag mögen").split(/\s+/));
(async()=>{
  const mio = await p.journey.findUnique({ where:{id:J}, select:{language:true, typeSlug:true}});
  const otras = await p.journeyStory.findMany({
    where:{ journey:{ language:mio!.language, status:{not:"archived"} }, journeyId:{not:J} },
    select:{ vocab:true, journey:{select:{typeSlug:true}} }});
  const duro=new Set<string>(), blando=new Set<string>();
  for(const r of otras){ const d = r.journey?.typeSlug===mio!.typeSlug ? duro : blando;
    for(const v of ((r.vocab as any[])??[])) if(v?.word) d.add(lema(String(v.word))); }
  const a0=JSON.parse(fs.readFileSync("" + __dirname + "/de-a0-all.json","utf8"));
  let sumaPorHistoria=0; const global=new Set<string>();
  console.log("n\thistoria\tlimpias en su cuerpo");
  a0.forEach((s:any,i:number)=>{
    const l=new Set<string>();
    for(const t of (String(s.text).match(/\p{L}+/gu)??[])){
      const k=lema(t.toLowerCase());
      if(t.length>=4 && !STOP.has(t.toLowerCase()) && !duro.has(k) && !blando.has(k)) { l.add(k); global.add(k); }
    }
    sumaPorHistoria+=l.size;
    console.log(`${i+1}\t${String(s.title).slice(0,32)}\t${l.size}`);
  });
  console.log(`\nsuma por historia (con repeticion entre historias): ${sumaPorHistoria}`);
  console.log(`lemas limpios DISTINTOS en todo el journey: ${global.size}`);
  console.log(`plazas que hacen falta para 21 historias al suelo de 20: 420`);
  await p.$disconnect();
})();
