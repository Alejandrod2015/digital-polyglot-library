import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
const J="cmovi4cvi000032q37a4823h3";
const SPK=/^\s*([\p{Lu}][\p{L}\p{M}.'-]*(?:\s+[\p{Lu}][\p{L}\p{M}.'-]*){0,3})\s*:\s+/u;
function speakers(text:string){ const s=new Set<string>(); for(const l of (text||"").split(/\r?\n/)){const m=l.match(SPK); if(m)s.add(m[1].trim());} return [...s]; }
(async()=>{
  const rows = await prisma.journeyStory.findMany({ where:{journeyId:J, level:{in:["a1","a2"]}}, select:{slug:true,level:true,topic:true,slotIndex:true,text:true}, orderBy:[{topic:"asc"},{level:"asc"},{slotIndex:"asc"}] });
  const byTopic: Record<string, any[]> = {};
  for (const r of rows) (byTopic[r.topic] ||= []).push(r);
  for (const topic of Object.keys(byTopic)) {
    console.log(`\n### ${topic}`);
    for (const r of byTopic[topic]) {
      console.log(`  [${r.level}] ${(r.slug||"").padEnd(34)} ${speakers(r.text||"").join(", ")}`);
    }
  }
  await prisma.$disconnect();
})().catch(e=>{console.log("FATAL",e.message);process.exit(1);});
