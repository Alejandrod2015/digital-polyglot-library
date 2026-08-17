import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p=new PrismaClient();
(async()=>{
  const words=["unbehaglich","überwältigt","gelassen","salzig"];
  for(const w of words){
    const f=await p.favorite.findFirst({where:{word:{contains:w}},select:{word:true,translation:true,storySlug:true,language:true}});
    console.log(`  "${w}": ${f?`favorito guardado (${f.translation}, story=${f.storySlug})`:"NO es favorito"}`);
  }
})().finally(()=>p.$disconnect());
