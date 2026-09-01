/** Recrea los 21 huecos vacios del A2 bajo los siete slugs actuales del journey. */
import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p=new PrismaClient();
(async()=>{
  const J="cmtgelq560007j84n3ujx9bpd";
  const j=await p.journey.findUnique({where:{id:J},select:{topics:true}});
  let n=0;
  for (const t of j!.topics) for (let i=1;i<=3;i++){
    const ya=await p.journeyStory.findFirst({where:{journeyId:J,topic:t,slotIndex:i}});
    if (ya) continue;
    await p.journeyStory.create({data:{journeyId:J,level:"a2",topic:t,slotIndex:i,status:"draft"}});
    n++;
  }
  console.log(`huecos creados: ${n} · total ahora: ${await p.journeyStory.count({where:{journeyId:J}})}`);
})().finally(()=>p.$disconnect());
