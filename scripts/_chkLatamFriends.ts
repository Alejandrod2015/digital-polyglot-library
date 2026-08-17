import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p=new PrismaClient();
(async()=>{
  // encontrar el/los journeys spanish/latam Friends
  const js=await p.journey.findMany({ where:{ language:"spanish", variant:"latam", name:"Friends" }, select:{id:true,status:true,name:true,createdAt:true,updatedAt:true} });
  for(const j of js){
    const stories=await p.journeyStory.findMany({ where:{journeyId:j.id, status:"published"}, select:{slug:true, audioUrl:true, audioStatus:true, practiceVoiceId:true, voiceId:true, practiceSet:{select:{exercises:{select:{type:true,payload:true}}}}} });
    let narr=0, clipNeed=0, clipUrl=0; const pv=new Set<string>();
    for(const s of stories){
      if(s.audioUrl) narr++;
      if(s.practiceVoiceId) pv.add(s.practiceVoiceId);
      for(const e of (s.practiceSet?.exercises??[])){
        if(e.type!=="meaning_in_context"&&e.type!=="fill_blank") continue;
        const ac=(e.payload as any)?.audioClip; if(!ac?.sentence) continue;
        clipNeed++; if(typeof ac.clipUrl==="string"&&ac.clipUrl) clipUrl++;
      }
    }
    console.log(`JOURNEY ${j.id} status=${j.status} created=${j.createdAt.toISOString().slice(0,10)}`);
    console.log(`  historias publicadas: ${stories.length}`);
    console.log(`  narración de historia (audioUrl): ${narr}/${stories.length}`);
    console.log(`  practice clips: ${clipUrl}/${clipNeed}  | practiceVoiceIds: ${JSON.stringify([...pv])}`);
    // muestra de slugs
    console.log(`  slugs: ${stories.slice(0,5).map(s=>s.slug).join(", ")} ...`);
  }
})().finally(()=>p.$disconnect());
