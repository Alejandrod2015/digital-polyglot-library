import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p=new PrismaClient();
(async()=>{
  // 1) qué HISTORIA tiene "Der Käse ist warm und salzig" en su texto
  const stories=await p.journeyStory.findMany({ where:{ text:{contains:"Käse ist warm"} }, select:{slug:true, journey:{select:{language:true,name:true,status:true}}} });
  console.log("historias con 'Käse ist warm' en el texto:", stories.length);
  for(const s of stories) console.log(`  [${s.journey?.language}/${s.journey?.name} ${s.journey?.status}] ${s.slug}`);
  // 2) el ejercicio de práctica de "salzig": qué oración/clip tiene y en qué historia
  console.log("\n=== ejercicios de práctica con word 'salzig' ===");
  const exs=await p.storyPracticeExercise.findMany({ where:{word:"salzig"}, select:{type:true,sentence:true,payload:true,set:{select:{story:{select:{slug:true,journey:{select:{name:true}}}}}}} });
  for(const e of exs){ const st=e.set?.story; console.log(`  [${st?.journey?.name}] ${st?.slug} ${e.type} col="${e.sentence}" clip="${(e.payload as any)?.audioClip?.sentence}"`); }
  // 3) el favorito que el usuario guardó (Favorite table) para "salzig"
  console.log("\n=== Favorite 'salzig' (lo que guardó el usuario) ===");
  const favs=await p.favorite.findMany({ where:{word:"salzig"}, select:{exampleSentence:true,storySlug:true,language:true} });
  for(const f of favs) console.log(`  storySlug=${f.storySlug} lang=${f.language} sentence="${f.exampleSentence}"`);
})().finally(()=>p.$disconnect());
