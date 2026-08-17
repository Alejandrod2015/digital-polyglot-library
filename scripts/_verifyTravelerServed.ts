import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p=new PrismaClient();
(async()=>{
  const live=await p.journey.findMany({where:{language:"spanish",variant:"latam",name:"Traveler",status:{notIn:["archived","draft"]}},select:{id:true}});
  const ids=live.map(j=>j.id);
  const pub=await p.journeyStory.count({where:{journeyId:{in:ids},status:"published"}});
  const byTopic=await p.journeyStory.groupBy({by:["topic"],where:{journeyId:{in:ids},status:"published"},_count:true});
  console.log(`journeys Traveler latam servidos: ${ids.length} | historias publicadas: ${pub}`);
  console.log("por tema:", byTopic.map(t=>`${t.topic}=${t._count}`).join(", "));
})().finally(()=>p.$disconnect());
