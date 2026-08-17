import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
import * as fs from "fs";
const p=new PrismaClient();
(async()=>{
  const specs:Record<string,any[]>=JSON.parse(fs.readFileSync("scripts/_friends_dialoguespecs.json","utf8"));
  let n=0;
  for(const [slug,spec] of Object.entries(specs)){
    const row=await p.journeyStory.findFirst({where:{slug},select:{id:true}});
    if(!row){ console.log("NO row",slug); continue; }
    await p.journeyStory.update({where:{id:row.id}, data:{dialogueSpec:spec as any}});
    n++;
  }
  console.log(`applied dialogueSpec to ${n}/${Object.keys(specs).length} stories`);
})().finally(()=>p.$disconnect());
