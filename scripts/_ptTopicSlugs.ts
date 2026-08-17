import { config } from "dotenv"; config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async()=>{
  const j = await p.journey.findFirst({ where:{ language:{ equals:"portuguese", mode:"insensitive" } }, select:{ id:true } });
  const s = await p.journeyStory.findMany({ where:{ journeyId:j!.id, status:"published", topic: process.argv[2] }, select:{ slug:true, title:true, slotIndex:true }, orderBy:{ slotIndex:"asc" } });
  console.log(s.map(x=>x.slug).join(" "));
  s.forEach(x=>console.error(`${x.slotIndex}. ${x.title} (${x.slug})`));
})().finally(()=>p.$disconnect());
