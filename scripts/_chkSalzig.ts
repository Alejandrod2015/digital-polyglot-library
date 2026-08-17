import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p=new PrismaClient();
(async()=>{
  const storyId="cmp5h7y0k000132427eiq5pu1";
  const st=await p.journeyStory.findUnique({where:{id:storyId},select:{slug:true,status:true,voiceId:true,journey:{select:{language:true,name:true,variant:true,status:true}}}});
  console.log("historia:", JSON.stringify(st));
  // ¿existe ejercicio pre-horneado para "salzig" en esa historia? (lo que mi fix de favoritos usaría)
  const exs=await p.storyPracticeExercise.findMany({where:{set:{storyId}, word:{contains:"salzig"}},select:{type:true,word:true,payload:true}});
  console.log(`\nejercicios "salzig" en el set de esa historia: ${exs.length}`);
  for(const e of exs){ const ac=(e.payload as any)?.audioClip; console.log(`  [${e.type}] "${e.word}" clipUrl=${ac?.clipUrl?("SÍ "+ac.clipUrl.slice(-30)):"NO"} sentence=${JSON.stringify(ac?.sentence)}`); }
  if(exs.length===0) console.log("  → 'salzig' NO es palabra objetivo del set → la sección NO tiene clip → cae a Modal (sin voz alemana) o word-tts (voz fallback).");
})().finally(()=>p.$disconnect());
