import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p=new PrismaClient();
(async()=>{
  const needle="warm und salzig";
  const rows=await p.storyPracticeExercise.findMany({
    where:{ OR:[{sentence:{contains:needle}}, {payload:{path:["audioClip","sentence"],string_contains:needle}}] },
    select:{ type:true, word:true, sentence:true, payload:true,
      set:{select:{story:{select:{slug:true,voiceId:true,practiceVoiceId:true,journey:{select:{language:true,name:true,variant:true,status:true}}}}}} },
  }).catch(async(e)=>{
    // fallback si el path json no soporta string_contains
    return p.storyPracticeExercise.findMany({ where:{ sentence:{contains:needle} }, select:{ type:true, word:true, sentence:true, payload:true, set:{select:{story:{select:{slug:true,voiceId:true,practiceVoiceId:true,journey:{select:{language:true,name:true,variant:true,status:true}}}}}} } });
  });
  console.log(`encontrados: ${rows.length}`);
  for(const r of rows){
    const pl=r.payload as any; const st=r.set?.story;
    console.log(`\n===== [${r.type}] word="${r.word}" =====`);
    console.log(`  journey: ${st?.journey?.language}/${st?.journey?.name} (${st?.journey?.variant}, ${st?.journey?.status}) | story=${st?.slug}`);
    console.log(`  column sentence: ${JSON.stringify(r.sentence)}`);
    console.log(`  prompt: ${JSON.stringify(pl?.prompt)}`);
    console.log(`  answer: ${JSON.stringify(pl?.answer)} | options: ${JSON.stringify(pl?.options)}`);
    console.log(`  audioClip.sentence: ${JSON.stringify(pl?.audioClip?.sentence)}`);
    console.log(`  audioClip.clipUrl: ${(pl?.audioClip?.clipUrl||"").slice(-40)}`);
    console.log(`  audioClip.voiceId: ${pl?.audioClip?.voiceId} | story voiceId: ${st?.voiceId}`);
  }
})().finally(()=>p.$disconnect());
