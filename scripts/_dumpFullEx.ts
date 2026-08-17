import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p=new PrismaClient();
(async()=>{
  const rows=await p.storyPracticeExercise.findMany({
    where:{ set:{ story:{ slug:"im-keller-wohnt-die-hausordnung" } }, OR:[{word:{contains:"Sechser"}},{word:{contains:"Haken"}},{type:"fill_blank"}] },
    select:{ type:true, word:true, sentence:true, payload:true }, take:5,
  });
  for(const r of rows){
    const pl=r.payload as any;
    console.log(`\n===== [${r.type}] word="${r.word}" =====`);
    console.log(`  columna sentence: ${JSON.stringify(r.sentence)}`);
    console.log(`  payload.prompt: ${JSON.stringify(pl?.prompt)}`);
    console.log(`  payload.sentence: ${JSON.stringify(pl?.sentence)}`);
    console.log(`  payload.answer: ${JSON.stringify(pl?.answer)}`);
    console.log(`  payload.options: ${JSON.stringify(pl?.options)}`);
    console.log(`  audioClip.sentence: ${JSON.stringify(pl?.audioClip?.sentence)}`);
    console.log(`  audioClip.targetWord: ${JSON.stringify(pl?.audioClip?.targetWord)}`);
  }
})().finally(()=>p.$disconnect());
