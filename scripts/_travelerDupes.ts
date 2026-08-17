import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p=new PrismaClient();
(async()=>{
  const js=await p.journey.findMany({
    where:{ language:"spanish", variant:"latam", name:"Traveler" },
    select:{ id:true, status:true, createdAt:true, updatedAt:true, topics:true, storiesPerTopic:true, levels:true },
    orderBy:{ createdAt:"asc" },
  });
  for(const j of js){
    const stories=await p.journeyStory.findMany({ where:{journeyId:j.id}, select:{status:true, slug:true, topic:true, coverUrl:true} });
    const byStatus:Record<string,number>={};
    for(const s of stories) byStatus[s.status]=(byStatus[s.status]||0)+1;
    const pub=stories.filter(s=>s.status==="published");
    console.log(`\nID ${j.id}`);
    console.log(`  status=${j.status} created=${j.createdAt.toISOString().slice(0,10)} updated=${j.updatedAt.toISOString().slice(0,10)}`);
    console.log(`  stories: ${stories.length} | byStatus=${JSON.stringify(byStatus)}`);
    console.log(`  topics=${JSON.stringify(j.topics)}`);
    console.log(`  sample published slugs: ${pub.slice(0,6).map(s=>s.slug).join(", ")}`);
  }
})().finally(()=>p.$disconnect());
