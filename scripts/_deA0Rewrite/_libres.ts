import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import { GERMAN_A1_A2_LEMMAS } from "../../src/lib/cefr/germanA1A2";
import * as fs from "fs";
const p = new PrismaClient();
const SEP=["an","auf","aus","ein","nach","vor","zu","ab","mit","bei"], COM=["ge","ver","be","er","ent"], ART=["der ","die ","das "];
function sp(w:string){let l=w.toLowerCase();for(const a of ART)if(l.startsWith(a)){l=l.slice(a.length);break;}
  for(const q of [...SEP,...COM])if(l.startsWith(q)&&l.length>q.length+3)return l.slice(q.length);return l;}
const lema=(w:string)=>sp(w).normalize("NFD").replace(/[̀-ͯ]/g,"").trim();
(async()=>{
  const J="cmt0a8vb1000m32p1x7r5ba28";
  const mio = await p.journey.findUnique({ where:{id:J}, select:{language:true, typeSlug:true}});
  const otras = await p.journeyStory.findMany({
    where:{ journey:{ language:mio!.language, status:{not:"archived"} }, journeyId:{not:J} },
    select:{ vocab:true, journey:{select:{typeSlug:true}} }});
  const oc=new Set<string>();
  for(const r of otras) for(const v of ((r.vocab as any[])??[])) if(v?.word) oc.add(lema(String(v.word)));
  const ya=new Set(JSON.parse(fs.readFileSync("" + __dirname + "/portables-ok.json","utf8")).map((w:string)=>lema(w)));
  const libres=[...new Set([...(GERMAN_A1_A2_LEMMAS as unknown as Set<string>)].map(w=>String(w)))]
    .filter(w=>!oc.has(lema(w)) && !ya.has(lema(w)) && /^[a-zäöüß]+$/i.test(w) && w.length>=4)
    .sort();
  console.log(`libres sin usar: ${libres.length}\n`);
  console.log(libres.slice(0,400).join(" "));
  await p.$disconnect();
})();
