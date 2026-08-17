import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p=new PrismaClient();
(async()=>{
  const s=await p.journeyStory.findFirst({where:{dialogueSpec:{not:undefined as any}}, select:{slug:true,dialogueSpec:true}});
  console.log("example slug:", s?.slug);
  console.log("dialogueSpec:", JSON.stringify(s?.dialogueSpec));
})().finally(()=>p.$disconnect());
