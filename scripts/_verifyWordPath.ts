import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p=new PrismaClient();
(async()=>{
  const e=await p.storyPracticeExercise.findFirst({where:{word:"der Sechser im Lotto",type:"meaning_in_context"},select:{payload:true}});
  const ac=(e?.payload as any)?.audioClip;
  console.log("audioClip keys:", ac?Object.keys(ac).join(","):"?");
  console.log("wordClipUrl:", (ac?.wordClipUrl||"").slice(-24));
  console.log("cachedUrl(clipUrl/oración):", (ac?.clipUrl||"").slice(-24));
})().finally(()=>p.$disconnect());
