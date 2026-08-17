import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p=new PrismaClient();
(async()=>{
  const rows=await p.storyPracticeExercise.findMany({
    where:{ OR:[{sentence:{contains:"Käse"}},{sentence:{contains:"Kase"}}] },
    select:{ type:true, word:true, sentence:true, payload:true,
      set:{select:{story:{select:{slug:true,journey:{select:{language:true,name:true,variant:true,status:true}}}}}} },
  });
  console.log(`ejercicios con "Käse": ${rows.length}`);
  for(const r of rows){
    const pl=r.payload as any; const st=r.set?.story;
    const j=st?.journey;
    console.log(`\n[${r.type}] "${r.word}" | ${j?.language}/${j?.name} (${j?.variant}, ${j?.status}) ${st?.slug}`);
    console.log(`  column sentence: ${JSON.stringify(r.sentence)}`);
    console.log(`  audioClip.sentence: ${JSON.stringify(pl?.audioClip?.sentence)}`);
    console.log(`  answer: ${JSON.stringify(pl?.answer)} options: ${JSON.stringify(pl?.options)}`);
  }
})().finally(()=>p.$disconnect());
