import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async()=>{
  const berlin = await p.journeyStory.findMany({ where:{journeyId:"cmr92f0qz000032ff1dfd4fgx"}, select:{slug:true, arcType:true, synopsis:true, title:true}, take:6 });
  console.log("BERLIN sample:");
  for(const b of berlin) console.log(`  arc=${JSON.stringify(b.arcType)} syn=${b.synopsis?("'"+String(b.synopsis).slice(0,30)+"...'"):"NULL"} ${b.slug}`);
  const ham = await p.journeyStory.findMany({ where:{journeyId:"cmrdbz11t000032asrvo832i9", NOT:{title:null} }, select:{slug:true, arcType:true, synopsis:true} });
  console.log("HAMBURG:");
  for(const h of ham) console.log(`  arc=${JSON.stringify(h.arcType)} syn=${h.synopsis?"set":"NULL"} ${h.slug}`);
})().finally(()=>p.$disconnect());
