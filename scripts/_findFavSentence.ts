import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p=new PrismaClient();
(async()=>{
  const rows=await p.favorite.findMany({
    where:{ OR:[{exampleSentence:{contains:"warm und salzig"}},{exampleSentence:{contains:"Käse"}},{word:{contains:"Käse"}}] },
    select:{ word:true, translation:true, exampleSentence:true, storySlug:true, language:true },
    take:15,
  });
  console.log(`favoritos con Käse/salzig: ${rows.length}`);
  for(const r of rows){
    console.log(`  word="${r.word}" (${r.language}) story=${r.storySlug} :: ${JSON.stringify(r.exampleSentence)}`);
  }
  // además, ¿algún ejercicio con "Die Käse" (error de género) en cualquier lado?
  const bad=await p.storyPracticeExercise.findMany({where:{OR:[{sentence:{contains:"Die Käse"}},{sentence:{contains:"wird warm"}}]},select:{sentence:true,set:{select:{story:{select:{slug:true}}}}}});
  console.log(`\nejercicios con "Die Käse" o "wird warm": ${bad.length}`);
  for(const b of bad) console.log(`  ${b.set?.story?.slug}: ${JSON.stringify(b.sentence)}`);
})().finally(()=>p.$disconnect());
