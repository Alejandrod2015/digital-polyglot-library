import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p=new PrismaClient();
(async()=>{
  // buscar por respuesta salzig / distractores / Käse en sentence o payload
  const rows=await p.storyPracticeExercise.findMany({
    where:{ OR:[
      {word:"salzig"},{word:{contains:"salzig"}},
      {sentence:{contains:"Käse"}},{sentence:{contains:"salzig"}},
      {sentence:{contains:"unbehaglich"}},
    ]},
    select:{ type:true, word:true, sentence:true, payload:true,
      set:{select:{story:{select:{slug:true,journey:{select:{language:true,name:true,status:true}}}}}} },
    take:15,
  });
  console.log("por word/sentence:", rows.length);
  for(const r of rows){
    const st=r.set?.story;
    console.log(`  [${st?.journey?.language}/${st?.journey?.name}] ${st?.slug} | ${r.type} word="${r.word}" sent="${(r.sentence||"").slice(0,50)}"`);
  }
  // también buscar en payload.options (los distractores)
  const all=await p.storyPracticeExercise.findMany({ where:{ type:"fill_blank" }, select:{ word:true, sentence:true, payload:true, set:{select:{story:{select:{slug:true,journey:{select:{name:true}}}}}} } });
  const hit=all.filter(r=>{ const o=(r.payload as any)?.options; return Array.isArray(o)&&o.includes("salzig")&&o.includes("unbehaglich"); });
  console.log("\nfill_blank con options [salzig, unbehaglich, ...]:", hit.length);
  for(const r of hit){ const st=r.set?.story; console.log(`  ${st?.journey?.name} | ${st?.slug} | word="${r.word}" sent="${r.sentence}" | audioClip.sentence="${(r.payload as any)?.audioClip?.sentence}"`); }
})().finally(()=>p.$disconnect());
