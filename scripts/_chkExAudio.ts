import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p=new PrismaClient();
(async()=>{
  const js=await p.journey.findMany({where:{OR:[{status:"active"},{name:{in:["Friends","Hanseat"]}}]},select:{id:true,name:true,language:true,levels:true,status:true}});
  for(const j of js){
    const stories=await p.journeyStory.findMany({where:{journeyId:j.id},select:{id:true}});
    const ids=stories.map(s=>s.id);
    const sets=await p.storyPracticeSet.findMany({where:{storyId:{in:ids}},select:{exercises:{select:{audioUrl:true,payload:true}}}});
    let total=0,colUrl=0,payloadClip=0,hasText=0,hasVoice=0;
    for(const s of sets) for(const e of s.exercises){
      total++;
      if(e.audioUrl) colUrl++;
      const pl:any=e.payload;
      const clip = pl?.audioClip?.clipUrl || pl?.audioClip?.url || pl?.clipUrl;
      if(clip) payloadClip++;
    }
    console.log(`${j.name}(${j.language}/${(j.levels||[]).join(",")}/${j.status}): ex=${total} | col.audioUrl=${colUrl} | payload.clipUrl=${payloadClip}`);
  }
})().finally(()=>p.$disconnect());
