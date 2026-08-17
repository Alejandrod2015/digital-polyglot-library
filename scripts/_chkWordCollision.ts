import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p=new PrismaClient();
const slug48=(w:string)=>w.replace(/[^a-z0-9]+/gi,"_").slice(0,48);
(async()=>{
  for(const [name,jid,voiceMissing] of [["german Friends","cmroo4w4v0000324ow1o9qlcp",true],["latam Friends","cmrdqk484000032r4rt2vw4ej",false]] as const){
    const stories=await p.journeyStory.findMany({where:{journeyId:jid,status:"published"},select:{slug:true,practiceSet:{select:{exercises:{select:{type:true,word:true,payload:true}}}}}});
    // fileUri key del play meaning: lang-voiceSafe-cached-<word48>. Si voiceId falta, voiceSafe="v" para todas.
    const byKey=new Map<string,Set<string>>(); // key -> set de (slug::sentence)
    for(const s of stories){
      for(const e of (s.practiceSet?.exercises??[])){
        if(e.type!=="meaning_in_context")continue; // meaning mode = key por word
        const ac=(e.payload as any)?.audioClip; const sent=ac?.sentence; if(!sent)continue;
        const voiceSafe=voiceMissing?"v":(ac?.voiceId||"v").replace(/[^a-z0-9]+/gi,"_");
        const key=`german-${voiceSafe}-cached-${slug48(e.word||"")}`; // lang fijo para la prueba
        if(!byKey.has(key))byKey.set(key,new Set());
        byKey.get(key)!.add(`${s.slug}::${sent}`);
      }
    }
    let collisions=0;
    for(const [key,vals] of byKey){
      const sentences=new Set([...vals].map(v=>v.split("::")[1]));
      if(vals.size>1 && sentences.size>1){ collisions++;
        if(collisions<=6){ console.log(`  COLISIÓN key="${key}":`); for(const v of vals) console.log(`     ${v.slice(0,80)}`); }
      }
    }
    console.log(`${name}: pares palabra-idéntica con ORACIÓN distinta (colisión de fileUri) = ${collisions}\n`);
  }
})().finally(()=>p.$disconnect());
