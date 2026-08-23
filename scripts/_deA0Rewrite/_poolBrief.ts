/** Candidatas para la escalera del A0 reescrito: lemas de la lista de nivel
 *  alemana que NADIE mas ensena y que ya aparecen en algun cuerpo actual, asi
 *  que se sabe que caben en estas escenas. Solo lectura. */
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
  const ocupado=new Set<string>();
  for(const r of otras) for(const v of ((r.vocab as any[])??[])) if(v?.word) ocupado.add(lema(String(v.word)));
  const a0=JSON.parse(fs.readFileSync("" + __dirname + "/de-a0-all.json","utf8"));
  const tok=(t:string)=>(t.toLowerCase().match(/\p{L}+/gu)??[]);
  const enCuerpos=new Map<string,number>();
  a0.forEach((s:any)=>{ for(const t of new Set(tok(String(s.text)))) enCuerpos.set(t,(enCuerpos.get(t)??0)+1); });
  const libres=[...new Set([...(GERMAN_A1_A2_LEMMAS as unknown as Set<string>)].map((w)=>String(w)))]
    .filter((w)=>!ocupado.has(lema(w)));
  const probadas=libres.filter((w)=>enCuerpos.has(lema(w)));
  console.log(`libres de la lista de nivel: ${libres.length}`);
  console.log(`de esas, ya presentes en algun cuerpo actual: ${probadas.length}\n`);
  console.log(probadas.sort().join(" "));
  await p.$disconnect();
})();
