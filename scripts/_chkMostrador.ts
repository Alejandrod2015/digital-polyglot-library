import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p=new PrismaClient();
(async()=>{
  for(const w of ["mostrador","multitud"]){
    const ex=await p.storyPracticeExercise.findMany({where:{word:w,type:"meaning_in_context"},select:{payload:true,set:{select:{story:{select:{slug:true,journey:{select:{language:true,name:true}}}}}}},take:2});
    for(const e of ex){ const ac=(e.payload as any)?.audioClip; const st=e.set?.story;
      console.log(`${w} [${st?.journey?.language}/${st?.journey?.name}] ${st?.slug} | wordClipUrl=${ac?.wordClipUrl?"SÍ":"NO"} | clipUrl(oración)=${ac?.clipUrl?"SÍ":"NO"}`); }
  }
})().finally(()=>p.$disconnect());
