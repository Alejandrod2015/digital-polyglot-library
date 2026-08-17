import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p=new PrismaClient();
(async()=>{
  // 1 historia alemana + 1 latam, primeros ejercicios con su audioClip crudo
  for(const [name,slug] of [["DE","nadia-kriegt-eine-schnauze"],["ES","diez-intentos"]]){
    console.log(`\n===== ${name}: ${slug} =====`);
    const st=await p.journeyStory.findFirst({where:{slug},select:{practiceSet:{select:{exercises:{select:{type:true,word:true,payload:true,audioUrl:true},take:4}}}}});
    for(const e of (st?.practiceSet?.exercises??[])){
      const ac=(e.payload as any)?.audioClip;
      console.log(`[${e.type}] word="${e.word}" audioUrl(col)=${e.audioUrl===null?"NULL":e.audioUrl}`);
      console.log(`   audioClip keys: ${ac?Object.keys(ac).join(","):"(sin audioClip)"}`);
      if(ac) console.log(`   clipUrl=${(ac.clipUrl||"").slice(-30)} | language=${ac.language} | voiceId=${ac.voiceId} | sentence="${(ac.sentence||"").slice(0,40)}"`);
    }
  }
})().finally(()=>p.$disconnect());
