import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
(async()=>{
  // covers de journeys activos (español) + alemán
  const rows=await prisma.journeyStory.findMany({
    where:{ status:"published", coverUrl:{ not:null }, journey:{ status:"active" } },
    select:{ slug:true, coverUrl:true, journey:{ select:{ name:true, language:true } }, updatedAt:true },
    orderBy:{ updatedAt:"desc" }, take:8,
  }) as any[];
  for(const r of rows) console.log(`${r.journey.language.slice(0,3)}/${r.journey.name.slice(0,8)}  ${r.slug.slice(0,28).padEnd(29)} ${r.coverUrl}`);
})().finally(()=>prisma.$disconnect());
