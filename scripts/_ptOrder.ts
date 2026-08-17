import { config } from "dotenv"; config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async()=>{
  const j = await p.journey.findFirst({ where:{ language:{ equals:"portuguese", mode:"insensitive" } }, select:{ id:true, topics:true } });
  const s = await p.journeyStory.findMany({
    where:{ journeyId:j!.id, status:"published" },
    select:{ slug:true, title:true, topic:true, slotIndex:true },
  });
  const orden = (j!.topics ?? []).map(t=>t.toLowerCase());
  s.sort((a,b)=> (orden.indexOf(a.topic.toLowerCase()) - orden.indexOf(b.topic.toLowerCase())) || a.slotIndex-b.slotIndex);
  s.slice(0,5).forEach((x,i)=>console.log(`${i+1}. ${x.slug}\t${x.title}\t(${x.topic} #${x.slotIndex})`));
})().finally(()=>p.$disconnect());
