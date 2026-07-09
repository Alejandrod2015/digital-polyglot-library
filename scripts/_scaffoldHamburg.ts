import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const TOPICS = ["ankommen-im-norden","wohnen-in-der-hansestadt","das-kontor","hanseatische-formen","alltag-an-der-elbe","vereine-und-freundschaft","sturm-und-gesundheit"];
(async()=>{
  const p=new PrismaClient();
  const dup=await p.journey.findFirst({where:{language:"german",variant:"germany",name:"Hanseat"}});
  if(dup){ console.log("ya existe:",dup.id); await p.$disconnect(); return; }
  const j=await p.journey.create({data:{ name:"Hanseat", language:"german", variant:"germany", levels:["c1"], topics:TOPICS, storiesPerTopic:3, status:"archived" }});
  let n=0;
  for(const topic of TOPICS){ for(let slot=1;slot<=3;slot++){ await p.journeyStory.create({data:{journeyId:j.id, level:"c1", topic, slotIndex:slot, status:"draft"}}); n++; } }
  console.log(`created journey ${j.id} with ${n} slots (archived)`);
  console.log("HAMBURG_ID="+j.id);
  await p.$disconnect();
})().catch(e=>{console.error(e);process.exit(1);});
