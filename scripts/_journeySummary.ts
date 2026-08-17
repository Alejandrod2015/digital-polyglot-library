import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p=new PrismaClient();
(async()=>{
  const journeys=await p.journey.findMany({
    where:{ status:{ notIn:["archived","draft"] } },
    select:{ id:true, language:true, variant:true, name:true, status:true },
    orderBy:[{language:"asc"},{variant:"asc"},{name:"asc"}],
  });
  const rows:string[]=[];
  for(const j of journeys){
    const stories=await p.journeyStory.findMany({ where:{journeyId:j.id, status:"published"}, select:{audioUrl:true, coverUrl:true, practiceSet:{select:{exercises:{select:{type:true,payload:true}}}}} });
    let narr=0, cov=0, need=0, clip=0;
    for(const s of stories){ if(s.audioUrl)narr++; if(s.coverUrl)cov++;
      for(const e of (s.practiceSet?.exercises??[])){ if(e.type!=="meaning_in_context"&&e.type!=="fill_blank")continue; const ac=(e.payload as any)?.audioClip; if(!ac?.sentence)continue; need++; if(typeof ac.clipUrl==="string"&&ac.clipUrl)clip++; } }
    const pub=stories.length;
    rows.push(`${j.language}/${j.variant}|${j.name}|${pub}|${narr}/${pub}|${cov}/${pub}|${clip}/${need}`);
  }
  console.log("LANG/VARIANT|JOURNEY|PUB|NARRACIÓN|COVERS|CLIPS");
  for(const r of rows) console.log(r);
})().finally(()=>p.$disconnect());
