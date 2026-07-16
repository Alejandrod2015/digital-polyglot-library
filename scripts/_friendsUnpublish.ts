import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p=new PrismaClient();
(async()=>{
  const r=await p.journeyStory.updateMany({where:{journeyId:"cmrdqk484000032r4rt2vw4ej"},data:{status:"draft"}});
  console.log("Friends stories -> draft:", r.count);
  const pub=await p.journeyStory.count({where:{journeyId:"cmrdqk484000032r4rt2vw4ej", status:"published"}});
  console.log("aun published:", pub);
})().finally(()=>p.$disconnect());
