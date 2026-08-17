import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p=new PrismaClient();
const DRAFTS: Array<[string,string,string,string]> = [
  ["spanish","argentina","Friends","C1"],
  ["spanish","mexico","Friends","C1"],
  ["spanish","mexico","Traveler","A0"],
  ["spanish","spain","Friends","A0"],
  ["italian","italy","Friends","A0"],
  ["german","germany","Hanseat","C1"],
];
(async()=>{
  console.log("LANG/VARIANT|JOURNEY|NIVEL|HISTORIAS|CON TEXTO|NARRACIÓN|COVERS|CLIPS");
  for(const [lang,variant,name,lvl] of DRAFTS){
    const j=await p.journey.findFirst({where:{language:lang,variant,name},select:{id:true}});
    if(!j){ console.log(`${lang}/${variant}|${name}|${lvl}|NO EXISTE`); continue; }
    // excluir deprecated (ruido); contar el resto como "en construcción"
    const stories=await p.journeyStory.findMany({where:{journeyId:j.id, status:{not:"deprecated"}},select:{text:true,audioUrl:true,coverUrl:true,practiceSet:{select:{exercises:{select:{type:true,payload:true}}}}}});
    let withText=0,narr=0,cov=0,need=0,clip=0;
    for(const s of stories){ if(s.text&&s.text.length>50)withText++; if(s.audioUrl)narr++; if(s.coverUrl)cov++;
      for(const e of (s.practiceSet?.exercises??[])){ if(e.type!=="meaning_in_context"&&e.type!=="fill_blank")continue; const ac=(e.payload as any)?.audioClip; if(!ac?.sentence)continue; need++; if(typeof ac.clipUrl==="string"&&ac.clipUrl)clip++; } }
    const n=stories.length;
    console.log(`${lang}/${variant}|${name}|${lvl}|${n}|${withText}/${n}|${narr}/${n}|${cov}/${n}|${clip}/${need}`);
  }
})().finally(()=>p.$disconnect());
