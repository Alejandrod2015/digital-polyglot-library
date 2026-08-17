import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p=new PrismaClient();
(async()=>{
  const stories=await p.journeyStory.findMany({where:{journeyId:"cmrdqk484000032r4rt2vw4ej", status:"published"}, select:{slug:true, practiceSet:{select:{exercises:{select:{type:true,word:true,payload:true}}}}}, orderBy:{createdAt:"asc"}});
  let need=0, withUrl=0, gap:string[]=[];
  for(const s of stories) for(const e of (s.practiceSet?.exercises??[])){
    if(e.type!=="meaning_in_context"&&e.type!=="fill_blank") continue;
    const ac=(e.payload as any)?.audioClip; if(!ac?.sentence) continue;
    need++; if(typeof ac.clipUrl==="string"&&ac.clipUrl) withUrl++; else gap.push(`${s.slug} "${e.word}" :: ${ac.sentence.slice(0,55)}`);
  }
  console.log(`clips: ${withUrl}/${need} | faltan: ${gap.length}`);
  for(const g of gap) console.log("  GAP", g);
})().finally(()=>p.$disconnect());
