import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p=new PrismaClient();
(async()=>{const j=await p.journey.findUnique({where:{id:"cmr92f0qz000032ff1dfd4fgx"},select:{name:true,language:true,variant:true,levels:true,status:true}}) as any;
const pub=await p.journeyStory.count({where:{journeyId:"cmr92f0qz000032ff1dfd4fgx",status:"published"}});
console.log("Expat:",JSON.stringify(j),"| published:",pub);})().finally(()=>p.$disconnect());
