import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p=new PrismaClient();
(async()=>{
  // ¿ejercicio curado con esta oración / word Bissen / distractores?
  const ex=await p.storyPracticeExercise.findMany({
    where:{ OR:[{sentence:{contains:"packt die Brezel"}},{sentence:{contains:"nimmt einen"}},{word:"Bissen"}] },
    select:{type:true,word:true,sentence:true,payload:true,set:{select:{story:{select:{slug:true,journey:{select:{name:true}}}}}}},
  });
  console.log("ejercicios curados que matchean:", ex.length);
  for(const e of ex){ const st=e.set?.story; console.log(`  [${st?.journey?.name}] ${st?.slug} ${e.type} word="${e.word}" col="${e.sentence}" clip="${(e.payload as any)?.audioClip?.sentence}" opts=${JSON.stringify((e.payload as any)?.options)}`); }
  // ¿favorito Bissen? (sería sección)
  const fav=await p.favorite.findMany({where:{word:"Bissen"},select:{storySlug:true,language:true,exampleSentence:true}});
  console.log("\nFavorite 'Bissen':", fav.length);
  for(const f of fav) console.log(`  storySlug=${f.storySlug} lang=${f.language} sent="${f.exampleSentence}"`);
})().finally(()=>p.$disconnect());
