import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p=new PrismaClient();
(async()=>{
  for(const slug of ["la-cuenta-del-jueves","la-reina-de-la-impuntualidad","la-foto-del-refri"]){
    const s=await p.journeyStory.findFirst({where:{slug},select:{title:true,audioUrl:true,audioStatus:true}});
    console.log(`${slug}|${s?.audioStatus}|${s?.audioUrl}`);
  }
})().finally(()=>p.$disconnect());
