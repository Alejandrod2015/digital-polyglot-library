import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p=new PrismaClient();
(async()=>{
  const j=await p.journey.findFirst({where:{language:"german",variant:"germany",name:"Expat"},select:{id:true}});
  const st=await p.journeyStory.findMany({where:{journeyId:j?.id,status:"published"},select:{practiceSet:{select:{exercises:{select:{type:true,payload:true}}}}}});
  let total=0, withUrl=0;
  for(const s of st) for(const e of (s.practiceSet?.exercises??[])){ if(e.type!=="meaning_in_context")continue; total++; if((e.payload as any)?.audioClip?.wordClipUrl) withUrl++; }
  console.log(`meaning_in_context: ${withUrl}/${total} con wordClipUrl`);
})().finally(()=>p.$disconnect());
