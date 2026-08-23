import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import * as fs from "fs";
const p = new PrismaClient();
const J = "cmt0a8vb1000m32p1x7r5ba28";
const SEP=["an","auf","aus","ein","nach","vor","zu","ab","mit","bei"], COM=["ge","ver","be","er","ent"], ART=["der ","die ","das "];
function sp(w:string){let l=w.toLowerCase();for(const a of ART)if(l.startsWith(a)){l=l.slice(a.length);break;}
  for(const q of [...SEP,...COM])if(l.startsWith(q)&&l.length>q.length+3)return l.slice(q.length);return l;}
const lema=(w:string)=>sp(w).normalize("NFD").replace(/[̀-ͯ]/g,"").trim();
(async()=>{
  const a1 = await p.journeyStory.findMany({ where: { journeyId: "cmqfnp3tf000032afygkqp8z2" }, select: { vocab: true } });
  const set = new Set<string>();
  for (const r of a1) for (const v of ((r.vocab as any[]) ?? [])) if (v?.word) set.add(lema(String(v.word)));
  console.log("plazas de vocab del A1 aleman:", set.size);
  const data = JSON.parse(fs.readFileSync("" + __dirname + "/de-a0-all.json","utf8"));
  let tot=0; const todas=new Set<string>();
  for (const s of data) {
    const hit = s.vocab.map((v:any)=>v.word).filter((w:string)=>set.has(lema(w)));
    tot += hit.length; hit.forEach((w:string)=>todas.add(w));
    console.log(`${String(s.title).slice(0,38).padEnd(38)}\t${hit.length}/${s.vocab.length}\t${hit.slice(0,6).join(", ")}`);
  }
  console.log(`\nTOTAL ${tot} plazas de 494 chocan con el A1 · ${todas.size} palabras distintas`);
  await p.$disconnect();
})();
