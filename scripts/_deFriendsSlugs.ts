import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p=new PrismaClient();
(async()=>{
  const rows=await p.journeyStory.findMany({where:{journeyId:"cmroo4w4v0000324ow1o9qlcp", status:"published"}, select:{slug:true}, orderBy:{createdAt:"asc"}});
  for(const r of rows) console.log(r.slug);
})().finally(()=>p.$disconnect());
