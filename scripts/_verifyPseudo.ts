import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p=new PrismaClient();
(async()=>{
  const id="cmp5h7y0k000132427eiq5pu1";
  const st=await p.journeyStory.findUnique({where:{id},select:{slug:true,status:true,journey:{select:{language:true,name:true,variant:true,status:true}}}});
  console.log("historia real del favorito:", JSON.stringify(st));
  // ¿mi join (story.slug IN ["journey-<id>"]) matchea? NO, porque slug real != pseudo-slug
  console.log(`\nfavorito.storySlug = "journey-${id}"  vs  slug real = "${st?.slug}"  -> match por slug: ${("journey-"+id)===st?.slug?"SÍ":"NO (mi join falla)"}`);
  // ¿esa historia tiene ejercicio 'salzig'?
  const ex=await p.storyPracticeExercise.findFirst({where:{word:"salzig", set:{story:{id}}},select:{type:true,sentence:true,payload:true}});
  console.log("ejercicio 'salzig' en ESA historia:", ex?`${ex.type} clip="${(ex.payload as any)?.audioClip?.sentence}"`:"NINGUNO");
})().finally(()=>p.$disconnect());
