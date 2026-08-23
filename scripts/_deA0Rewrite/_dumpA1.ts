import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
import * as fs from "fs";
const p = new PrismaClient();
(async()=>{
  const A="cmqfnp3tf000032afygkqp8z2";
  const j = await p.journey.findUnique({ where:{id:A}, select:{topics:true, variant:true}});
  const orden:string[] = (j?.topics as string[]) ?? [];
  const ss = await p.journeyStory.findMany({ where:{journeyId:A},
    select:{ topic:true, slotIndex:true, title:true, slug:true, synopsis:true, text:true, vocab:true, arcType:true, dialogueSpec:true }});
  ss.sort((a,b)=>(orden.indexOf(a.topic)-orden.indexOf(b.topic))||(a.slotIndex-b.slotIndex));
  console.log("variant:", j?.variant, "| con dialogueSpec:", ss.filter(s=>s.dialogueSpec).length, "de", ss.length);
  fs.writeFileSync("/tmp/de-a1-all.json", JSON.stringify(ss.map(({dialogueSpec, ...r})=>r), null, 2));
  await p.$disconnect();
})();
