import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p=new PrismaClient();
(async()=>{
  // usuario del favorito salzig
  const salz=await p.favorite.findFirst({where:{word:"salzig"},select:{userId:true}});
  const userId=salz?.userId;
  const favs=await p.favorite.findMany({where:{userId},select:{word:true,storySlug:true,language:true}});
  console.log(`usuario ${userId?.slice(0,10)} | favoritos: ${favs.length}`);
  let live=0, orphanDeleted=0, orphanArchived=0, noSlug=0, standalone=0;
  const samples:string[]=[];
  for(const f of favs){
    const slug=f.storySlug||"";
    if(!slug){ noSlug++; continue; }
    if(slug.startsWith("journey-")){
      const id=slug.slice("journey-".length);
      const st=await p.journeyStory.findUnique({where:{id},select:{status:true,journey:{select:{status:true}}}});
      if(!st){ orphanDeleted++; if(samples.length<6)samples.push(`BORRADA  ${f.word} (${slug.slice(0,24)})`); }
      else if(st.status!=="published"||st.journey?.status==="archived"){ orphanArchived++; if(samples.length<6)samples.push(`MUERTA   ${f.word} story=${st.status} journey=${st.journey?.status}`); }
      else live++;
    } else {
      const ss=await p.standaloneStory.findFirst({where:{slug},select:{id:true}}).catch(()=>null);
      if(ss) standalone++; else { orphanDeleted++; if(samples.length<6)samples.push(`STANDALONE? ${f.word} (${slug.slice(0,24)})`); }
    }
  }
  console.log(`  live (historia publicada + journey vivo): ${live}`);
  console.log(`  standalone ok: ${standalone}`);
  console.log(`  ORPHAN borrada (story id no existe): ${orphanDeleted}`);
  console.log(`  ORPHAN muerta (story no-published / journey archived): ${orphanArchived}`);
  console.log(`  sin storySlug: ${noSlug}`);
  console.log("\nmuestras de orphans:"); for(const s of samples) console.log("  "+s);
})().finally(()=>p.$disconnect());
