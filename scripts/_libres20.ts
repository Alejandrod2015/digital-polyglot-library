import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "/Users/alejandrodelcarpio/digital-polyglot-library/src/generated/prisma";
import * as fs from "fs";
const p = new PrismaClient();
const SEP=["an","auf","aus","ein","nach","vor","zu","ab","mit","bei"], COM=["ge","ver","be","er","ent"], ART=["der ","die ","das "];
function sp(w:string){let l=w.toLowerCase();for(const a of ART)if(l.startsWith(a)){l=l.slice(a.length);break;}
  for(const q of [...SEP,...COM])if(l.startsWith(q)&&l.length>q.length+3)return l.slice(q.length);return l;}
const lema=(w:string)=>sp(w).normalize("NFD").replace(/[̀-ͯ]/g,"").trim();
(async()=>{
  const J="cmt0a8vb1000m32p1x7r5ba28";
  const mio=await p.journey.findUnique({where:{id:J},select:{language:true,typeSlug:true}});
  const otras=await p.journeyStory.findMany({where:{journey:{language:mio!.language,status:{not:"archived"}},journeyId:{not:J}},select:{vocab:true,journey:{select:{typeSlug:true}}}});
  const duro=new Set<string>(), blando=new Set<string>();
  for(const r of otras){const d=r.journey?.typeSlug===mio!.typeSlug?duro:blando;
    for(const v of ((r.vocab as any[])??[])) if(v?.word) d.add(lema(String(v.word)));}
  const a0=JSON.parse(fs.readFileSync("/Users/alejandrodelcarpio/digital-polyglot-library/.claude/worktrees/practical-austin-02dea1/scripts/_deA0Rewrite/de-a0-v9.json","utf8"));
  const usos=new Map<string,number>();
  for(const s of a0) for(const v of (s.vocab??[])) usos.set(lema(v.word),(usos.get(lema(v.word))??0)+1);
  const t=a0[19].text as string;
  const out:string[]=[];
  for(const tok of new Set((t.match(/\p{L}+/gu)??[]))){
    const k=lema(tok.toLowerCase());
    if(tok.length<4||duro.has(k)||blando.has(k)) continue;
    if((usos.get(k)??0)>=2) continue;
    out.push(`${tok}(usos=${usos.get(k)??0})`);
  }
  console.log(out.join(" "));
  await p.$disconnect();
})();
