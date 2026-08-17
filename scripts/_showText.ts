import { config } from "dotenv"; config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async()=>{
  const s = await p.journeyStory.findFirst({ where:{ slug: process.argv[2] }, select:{ title:true, synopsis:true, text:true, vocab:true, arcType:true, topic:true, slotIndex:true } });
  console.log(JSON.stringify(s, null, 1));
})().finally(()=>p.$disconnect());
