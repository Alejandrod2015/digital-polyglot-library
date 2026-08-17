import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
import * as fs from "fs";
const p=new PrismaClient();
(async()=>{
  const slugs=fs.readFileSync("/tmp/friends_slugs.txt","utf8").trim().split("\n");
  let withSet=0, exTotal=0;
  for(const slug of slugs){
    const st=await p.journeyStory.findFirst({where:{slug}, select:{id:true, practiceSet:{select:{id:true, exercises:{select:{id:true}}}}}});
    const ex=st?.practiceSet?.exercises?.length ?? 0;
    if(st?.practiceSet){ withSet++; exTotal+=ex; }
    else console.log("  NO practiceSet:", slug);
  }
  console.log(`practice sets: ${withSet}/${slugs.length} slugs | total exercises: ${exTotal} (expect ~${slugs.length*18})`);
})().catch(e=>console.log("ERR",e.message)).finally(()=>p.$disconnect());
