import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p=new PrismaClient();
async function sample(lang:string, variant:string, name:string, expect:string, n:number){
  const j=await p.journey.findFirst({where:{language:lang,variant,name},select:{id:true}});
  if(!j) return [];
  const st=await p.journeyStory.findMany({where:{journeyId:j.id,status:"published"},select:{slug:true,practiceSet:{select:{exercises:{select:{payload:true}}}}},orderBy:{createdAt:"asc"}});
  const urls:string[]=[];
  for(const s of st){ for(const e of (s.practiceSet?.exercises??[])){ const u=(e.payload as any)?.audioClip?.clipUrl; if(typeof u==="string"&&u){ urls.push(u); break; } } } // 1 por historia
  return urls.slice(0,n).map(u=>`${expect}|${name}|${u}`);
}
(async()=>{
  const out:string[]=[];
  out.push(...await sample("german","germany","Expat","de",21));
  out.push(...await sample("spanish","colombia","Friends","es",12));
  out.push(...await sample("spanish","latam","Traveler","es",12));
  console.log(out.join("\n"));
})().finally(()=>p.$disconnect());
