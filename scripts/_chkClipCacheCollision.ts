import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p=new PrismaClient();
// replica EXACTA del safeName del mobile
const safe=(lang:string,voice:string,sent:string)=>{
  const voiceSafe=(voice||"v").replace(/[^a-z0-9]+/gi,"_");
  return `${lang}-${voiceSafe}-${sent.replace(/[^a-z0-9]+/gi,"_").slice(0,48)}`;
};
(async()=>{
  const journeys=[["german Friends","cmroo4w4v0000324ow1o9qlcp"],["latam Friends","cmrdqk484000032r4rt2vw4ej"]];
  for(const [name,jid] of journeys){
    const stories=await p.journeyStory.findMany({where:{journeyId:jid,status:"published"},select:{slug:true,practiceSet:{select:{exercises:{select:{type:true,payload:true}}}}}});
    let totalColl=0;
    for(const s of stories){
      const keys=new Map<string,string[]>();
      for(const e of (s.practiceSet?.exercises??[])){
        if(e.type!=="meaning_in_context"&&e.type!=="fill_blank")continue;
        const ac=(e.payload as any)?.audioClip; const sent=ac?.sentence; if(!sent)continue;
        const lang=ac?.language??"italian"; const voice=ac?.voiceId??"";  // defaults como en el mobile
        const k=safe(lang,voice,sent);
        (keys.get(k)||keys.set(k,[]).get(k)!).push(sent);
      }
      for(const [k,sents] of keys){ if(sents.length>1){ totalColl++; console.log(`  COLISIÓN en ${s.slug}:`); for(const x of sents) console.log(`     "${x}"`); } }
    }
    console.log(`${name}: colisiones dentro de una historia = ${totalColl}`);
  }
})().finally(()=>p.$disconnect());
