import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p=new PrismaClient();
(async()=>{
  const all=await p.storyPracticeExercise.findMany({ where:{type:"fill_blank"}, select:{ word:true, sentence:true, payload:true, set:{select:{story:{select:{slug:true,journey:{select:{language:true,name:true,variant:true,status:true}}}}}} } });
  console.log("total fill_blank:", all.length);
  const norm=(s:string)=>s.toLowerCase();
  // 1) audioClip.sentence o column sentence menciona "käse" + "warm"
  console.log("\n=== sentence/audioClip menciona Käse+warm ===");
  for(const r of all){
    const acS=((r.payload as any)?.audioClip?.sentence)||"";
    const cs=r.sentence||"";
    if((norm(acS).includes("käse")||norm(cs).includes("käse"))&&(norm(acS).includes("warm")||norm(cs).includes("warm"))){
      const st=r.set?.story;
      console.log(`  [${st?.journey?.name}] ${st?.slug} word="${r.word}"\n     col:  "${cs}"\n     clip: "${acS}"\n     opts: ${JSON.stringify((r.payload as any)?.options)}`);
    }
  }
  // 2) options contienen "unbehaglich" (distractor del screenshot)
  console.log("\n=== options incluyen 'unbehaglich' ===");
  for(const r of all){
    const o=(r.payload as any)?.options;
    if(Array.isArray(o)&&o.includes("unbehaglich")){
      const st=r.set?.story;
      console.log(`  [${st?.journey?.name}] ${st?.slug} word="${r.word}" col="${r.sentence}" clip="${(r.payload as any)?.audioClip?.sentence}" opts=${JSON.stringify(o)}`);
    }
  }
})().finally(()=>p.$disconnect());
