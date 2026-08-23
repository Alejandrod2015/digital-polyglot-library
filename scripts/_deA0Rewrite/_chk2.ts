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
(async()=>{
  const mio = await p.journey.findUnique({ where:{id:J}, select:{language:true, typeSlug:true}});
  const otras = await p.journeyStory.findMany({
    where:{ journey:{ language:mio!.language, status:{not:"archived"} }, journeyId:{not:J} },
    select:{ vocab:true, journey:{select:{typeSlug:true}} }});
  const duro=new Set<string>(), blando=new Set<string>();
  for(const r of otras){ const d = r.journey?.typeSlug===mio!.typeSlug ? duro : blando;
    for(const v of ((r.vocab as any[])??[])) if(v?.word) d.add(lema(String(v.word))); }
  const a0=JSON.parse(fs.readFileSync("" + __dirname + "/de-a0-v2.json","utf8"));
  const yaSlot=new Map<string,string>(); for(const s of a0) for(const v of (s.vocab??[])) yaSlot.set(lema(v.word), s.title);
  const cand = process.argv.slice(2);
  for(const w of cand){ const k=lema(w);
    console.log(`${w.padEnd(18)} mismoTipo(A1)=${duro.has(k)?"SI":"no"}  otroTipo=${blando.has(k)?"SI":"no"}  yaEnA0=${yaSlot.has(k)?"SI ("+yaSlot.get(k)+")":"no"}`); }
  await p.$disconnect();
})();
