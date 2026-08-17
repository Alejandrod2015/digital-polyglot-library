import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p=new PrismaClient();
const JID="cmroo4w4v0000324ow1o9qlcp";
(async()=>{
  const stories=await p.journeyStory.findMany({where:{journeyId:JID}, select:{slug:true, practiceSet:{select:{exercises:{select:{type:true, word:true, payload:true}}}}}, orderBy:{createdAt:"asc"}});
  let noSentence=0, hasSentenceNoUrl=0;
  for(const s of stories){
    for(const e of (s.practiceSet?.exercises??[])){
      if(e.type!=="meaning_in_context"&&e.type!=="fill_blank") continue;
      const ac=(e.payload as any)?.audioClip;
      const hasSent = ac && typeof ac.sentence==="string" && ac.sentence.length>0;
      const hasUrl = ac && typeof ac.clipUrl==="string" && ac.clipUrl.length>0;
      if(!hasUrl){
        if(!hasSent){ noSentence++; console.log(`  n/a (no sentence) ${s.slug} [${e.type}] "${e.word}"`); }
        else { hasSentenceNoUrl++; console.log(`  REAL GAP ${s.slug} [${e.type}] "${e.word}" :: ${ac.sentence.slice(0,60)}`); }
      }
    }
  }
  console.log(`\nno audioClip.sentence (no audio by design): ${noSentence}`);
  console.log(`has sentence but NO clipUrl (real render gap): ${hasSentenceNoUrl}`);
})().finally(()=>p.$disconnect());
