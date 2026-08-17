import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p=new PrismaClient();
(async()=>{
  const js=await p.journey.findMany({select:{id:true,name:true,language:true,variant:true,levels:true,status:true}});
  const out:any[]=[];
  for(const j of js){
    const stories=await p.journeyStory.findMany({where:{journeyId:j.id},select:{id:true,title:true,status:true,audioUrl:true}});
    const total=stories.length;
    const written=stories.filter(s=>s.title).length;
    const published=stories.filter(s=>s.status==="published").length;
    const narr=stories.filter(s=>s.audioUrl).length;
    // exercises w/ practice set + button audio coverage
    const storyIds=stories.map(s=>s.id);
    const sets=await p.storyPracticeSet.findMany({where:{storyId:{in:storyIds}},select:{storyId:true, exercises:{select:{audioUrl:true}}}});
    const withSet=sets.length;
    let exTotal=0, exWithAudio=0;
    for(const s of sets) for(const e of s.exercises){ exTotal++; if(e.audioUrl) exWithAudio++; }
    out.push({name:j.name,lang:j.language,variant:j.variant,levels:(j.levels||[]).join("/"),status:j.status,total,written,published,narr,withSet,exTotal,exWithAudio});
  }
  out.sort((a,b)=> (a.status===b.status?0:a.status==="active"?-1:1) || a.lang.localeCompare(b.lang));
  out.forEach((o:any)=>console.log([o.status.padEnd(9),o.lang.slice(0,3),o.variant.slice(0,6).padEnd(6),o.levels.padEnd(20),String(o.total).padStart(3),"pub="+o.published,"narr="+o.narr,"sets="+o.withSet,"exAudio="+o.exWithAudio+"/"+o.exTotal,o.name].join(" | ")));
})().finally(()=>p.$disconnect());
