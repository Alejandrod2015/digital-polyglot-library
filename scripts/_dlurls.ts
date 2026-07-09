import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async()=>{const r=await p.journeyStory.findMany({where:{journeyId:"cmr92f0qz000032ff1dfd4fgx"},select:{slug:true,coverUrl:true,createdAt:true},orderBy:{createdAt:"asc"}});
r.forEach((x:any,i:number)=>console.log(`${String(i+1).padStart(2,"0")}\t${x.slug}\t${x.coverUrl}`));})().finally(()=>p.$disconnect());
