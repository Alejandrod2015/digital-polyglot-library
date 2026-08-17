import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p=new PrismaClient();
(async()=>{
  const s=await p.journeyStory.findFirst({where:{slug:"el-que-se-enoja-pierde"},select:{audioUrl:true,audioStatus:true,audioFilename:true,voiceId:true}});
  console.log("audioStatus:",s?.audioStatus);
  console.log("audioUrl:",s?.audioUrl);
})().finally(()=>p.$disconnect());
