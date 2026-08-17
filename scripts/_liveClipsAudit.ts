import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p=new PrismaClient();
(async()=>{
  // journeys "live" = servidos: no archived, no draft
  const journeys=await p.journey.findMany({
    where:{ status:{ notIn:["archived","draft"] } },
    select:{ id:true, language:true, variant:true, status:true, name:true },
    orderBy:[{language:"asc"},{variant:"asc"}],
  });
  for(const j of journeys){
    const stories=await p.journeyStory.findMany({
      where:{ journeyId:j.id, status:"published" },
      select:{ practiceSet:{ select:{ exercises:{ select:{ type:true, payload:true } } } } },
    });
    let need=0, withUrl=0, pub=stories.length;
    for(const s of stories){
      for(const e of (s.practiceSet?.exercises??[])){
        if(e.type!=="meaning_in_context"&&e.type!=="fill_blank") continue;
        const ac=(e.payload as any)?.audioClip;
        if(!ac?.sentence) continue;
        need++;
        if(typeof ac.clipUrl==="string"&&ac.clipUrl) withUrl++;
      }
    }
    const gap=need-withUrl;
    const flag = pub===0 ? "" : (gap===0 ? "  ✓" : `  ⚠️ faltan ${gap}`);
    console.log(`${j.language}/${j.variant} "${j.name}" [${j.status}] pub=${pub} clips ${withUrl}/${need}${flag}`);
  }
})().finally(()=>p.$disconnect());
