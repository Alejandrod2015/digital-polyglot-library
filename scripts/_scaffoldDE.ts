import { config } from "dotenv";
config({ path: ".env.local" }); config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";

const TOPICS = ["food-everyday-life","home-family","meeting-new-people","places-getting-around","community-celebrations","nature-adventure","legends-folklore"];

async function run(){
  const p=new PrismaClient();
  // Guard: don't double-create.
  const existing=await p.journey.findFirst({where:{language:"German",variant:"germany",status:"active"}});
  if(existing){ console.log("active german/germany journey already exists:",existing.id); await p.$disconnect(); return; }
  const j=await p.journey.create({data:{
    name:"Traveler", language:"German", variant:"germany",
    levels:["a1"], topics:TOPICS, storiesPerTopic:3, status:"active",
  }});
  console.log("created journey:",j.id);
  let n=0;
  for(const topic of TOPICS){
    for(let slot=1;slot<=3;slot++){
      await p.journeyStory.create({data:{journeyId:j.id, level:"a1", topic, slotIndex:slot, status:"draft"}});
      n++;
    }
  }
  console.log(`created ${n} draft slots`);
  console.log("JOURNEY_ID="+j.id);
  await p.$disconnect();
}
run().catch(e=>{console.error(e);process.exit(1);});
