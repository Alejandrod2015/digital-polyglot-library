import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p=new PrismaClient();
(async()=>{
  const ex=await p.storyPracticeExercise.findMany({where:{set:{story:{slug:"im-keller-wohnt-die-hausordnung"}},type:"meaning_in_context"},select:{word:true,payload:true}});
  let withUrl=0; for(const e of ex){ if((e.payload as any)?.audioClip?.wordClipUrl) withUrl++; }
  console.log(`meaning_in_context: ${withUrl}/${ex.length} con wordClipUrl`);
})().finally(()=>p.$disconnect());
