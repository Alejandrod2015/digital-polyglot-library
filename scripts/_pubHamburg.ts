import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p=new PrismaClient();
(async()=>{
  const r=await p.journeyStory.updateMany({where:{journeyId:"cmrdbz11t000032asrvo832i9", NOT:{title:null}, status:{not:"published"}}, data:{status:"published"}});
  console.log("published:", r.count);
  // sanity: slugs intactos
  const rows=await p.journeyStory.findMany({where:{journeyId:"cmrdbz11t000032asrvo832i9"}, select:{slug:true,status:true}});
  console.log("total published:", rows.filter(x=>x.status==="published").length, "/ 21");
})().finally(()=>p.$disconnect());
