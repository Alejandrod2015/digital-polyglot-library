import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p=new PrismaClient();
const IDS=["cmovi4cvi000032q37a4823h3","cmqp6hal8000032cb4ywfs0gc","cmqrtaj1p000032qtda86z6um"];
(async()=>{
  // ¿journey stories tienen journeyOrder? (col existe?)
  const sample=await p.journeyStory.findFirst({ where:{journeyId:IDS[2]}, select:{ id:true, topic:true, journeyOrder:true } as any }).catch((e:any)=>({__err:e.message}));
  console.log("sample story fields:", JSON.stringify(sample));
  // por topic, cuántas historias publicadas aporta cada journey (si todas aparecen = triplicado)
  const byTopic:Record<string,Record<string,number>>={};
  for(const id of IDS){
    const rows=await p.journeyStory.findMany({ where:{journeyId:id, status:"published"}, select:{topic:true} });
    for(const r of rows){ (byTopic[r.topic] ||= {})[id.slice(-6)]=(byTopic[r.topic]?.[id.slice(-6)]||0)+1; }
  }
  console.log("\npublished stories per topic per journey (últimos 6 del id):");
  for(const [t,m] of Object.entries(byTopic)) console.log(`  ${t}: ${JSON.stringify(m)}`);
  const totalPub=Object.values(byTopic).reduce((a,m)=>a+Object.values(m).reduce((x,y)=>x+y,0),0);
  console.log(`\nTOTAL published across the 3: ${totalPub} (si el reader no dedupa, el usuario ve ~${totalPub})`);
})().finally(()=>p.$disconnect());
