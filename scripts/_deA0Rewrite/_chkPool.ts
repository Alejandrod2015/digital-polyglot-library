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
  const duro=new Set<string>(), blando=new Set<string>();
  for(const r of otras){ const d=r.journey?.typeSlug===mio!.typeSlug?duro:blando;
    for(const v of ((r.vocab as any[])??[])) if(v?.word) d.add(lema(String(v.word))); }
  const nivel=new Set([...(GERMAN_A1_A2_LEMMAS as unknown as Set<string>)].map(w=>lema(String(w))));
  const cand=[...new Set(fs.readFileSync("" + __dirname + "/portables.txt","utf8").trim().split("|").map(s=>s.trim()).filter(Boolean))];
  const ok:string[]=[], mal:string[]=[];
  for(const w of cand){ const k=lema(w);
    if(duro.has(k)) { mal.push(`${w}[A1]`); continue; }
    if(blando.has(k)) { mal.push(`${w}[otro tipo]`); continue; }
    if(!nivel.has(k)) { mal.push(`${w}[fuera de nivel]`); continue; }
    ok.push(w); }
  console.log(`candidatas ${cand.length} · limpias ${ok.length}`);
  console.log("\nLIMPIAS:", ok.join(" | "));
  console.log("\nDESCARTADAS:", mal.join(" · "));
  fs.writeFileSync("" + __dirname + "/portables-ok.json", JSON.stringify(ok,null,1));
  await p.$disconnect();
})();
