import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p=new PrismaClient();
const META:Record<string,string>={cmovi4cvi000032q37a4823h3:"07-may (12 deprecated)",cmqp6hal8000032cb4ywfs0gc:"22-jun (2 deprecated)",cmqrtaj1p000032qtda86z6um:"24-jun (limpia 21/21)"};
(async()=>{
  for(const [id,label] of Object.entries(META)){
    const stories=await p.journeyStory.findMany({where:{journeyId:id,status:"published"},select:{audioUrl:true,coverUrl:true,practiceSet:{select:{exercises:{select:{type:true,payload:true}}}}}});
    let need=0,url=0,narr=0,cov=0;
    for(const s of stories){ if(s.audioUrl)narr++; if(s.coverUrl)cov++;
      for(const e of (s.practiceSet?.exercises??[])){ if(e.type!=="meaning_in_context"&&e.type!=="fill_blank")continue; const ac=(e.payload as any)?.audioClip; if(!ac?.sentence)continue; need++; if(typeof ac.clipUrl==="string"&&ac.clipUrl)url++; } }
    console.log(`${label}  [${id.slice(-6)}]`);
    console.log(`   narración ${narr}/${stories.length} | covers ${cov}/${stories.length} | clips ${url}/${need}`);
  }
})().finally(()=>p.$disconnect());
