import { config } from "dotenv";
config({ path: ".env.local" }); config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
async function run(){
  const p=new PrismaClient();
  const s=await p.journeyStory.findMany({
    where:{journeyId:"cmovi4cvi000032q37a4823h3",topic:"food-everyday-life",status:"published"},
    select:{slotIndex:true,title:true,audioUrl:true,audioStatus:true,audioWordTimings:true,audioFilename:true,voiceId:true,audioSegments:true},
    orderBy:{slotIndex:"asc"}
  });
  for(const x of s){
    const segs = (x.audioSegments as any[])?.length ?? 0;
    console.log(`s${x.slotIndex} "${x.title}" | status=${x.audioStatus} | wt=${x.audioWordTimings?"yes":"no"} | segs=${segs} | voiceId=${x.voiceId??"-"}`);
    console.log(`   url=${x.audioUrl ?? "NONE"}`);
  }
  await p.$disconnect();
}
run();
