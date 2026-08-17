import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p=new PrismaClient();
(async()=>{
  const all=await p.journey.findMany({ select:{language:true,variant:true,name:true,status:true, _count:{select:{stories:true}}}, orderBy:[{status:"asc"},{language:"asc"},{variant:"asc"}] });
  // publicadas por journey
  const grouped:Record<string,string[]>={};
  for(const j of all){
    const pub=await p.journeyStory.count({where:{journey:{is:{language:j.language,variant:j.variant,name:j.name}}, status:"published"}}).catch(()=>-1);
    (grouped[j.status] ||= []).push(`${j.language}/${j.variant} "${j.name}"`);
  }
  const statuses=[...new Set(all.map(j=>j.status))];
  console.log("distinct statuses:", JSON.stringify(statuses));
  for(const s of Object.keys(grouped)){
    console.log(`\n[${s}] (${grouped[s].length})`);
    for(const line of grouped[s]) console.log("  "+line);
  }
})().finally(()=>p.$disconnect());
