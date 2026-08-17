import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p=new PrismaClient();
(async()=>{
  const st=await p.journeyStory.findFirst({where:{slug:"im-keller-wohnt-die-hausordnung"},select:{voiceId:true,practiceVoiceId:true,practiceSet:{select:{exercises:{select:{type:true,word:true,payload:true},orderBy:{orderIndex:"asc"}}}}}});
  const exs=st?.practiceSet?.exercises??[];
  console.log(`ejercicios: ${exs.length} | story voiceId=${st?.voiceId}`);
  // OLD fileUri key del build actual. meaning -> por WORD; context/fill_blank -> por SENTENCE.
  const oldKey=(lang:string,voiceId:string|undefined,text:string)=>{
    const vs=(voiceId??"v").replace(/[^a-z0-9]+/gi,"_");
    return `${lang}-${vs}-cached-${text.replace(/[^a-z0-9]+/gi,"_").slice(0,48)}`;
  };
  const seen=new Map<string,string[]>();
  for(const e of exs){
    const ac=(e.payload as any)?.audioClip;
    const vId=ac?.voiceId; // lo que lee el mobile
    let playText="";
    if(e.type==="meaning_in_context") playText=e.word||"";       // meaning: audio = palabra
    else if(e.type==="fill_blank") playText=ac?.sentence||"";     // context: audio = oración
    else continue; // match_meaning/listen_choose distinto
    const k=oldKey("german",vId,playText);
    if(!seen.has(k))seen.set(k,[]);
    seen.get(k)!.push(`${e.type} "${e.word}" -> reproduce "${playText.slice(0,45)}"`);
    console.log(`  [${e.type}] word="${e.word}" voiceId=${vId} key=${k.slice(0,60)}`);
  }
  console.log("\n=== COLISIONES (misma fileUri, ejercicios distintos) ===");
  let n=0;
  for(const [k,v] of seen){ if(v.length>1){ n++; console.log(`  KEY ${k.slice(0,55)}`); for(const x of v)console.log(`     ${x}`); } }
  console.log(n?`\n${n} colisiones`:"\nsin colisiones dentro de la historia");
})().finally(()=>p.$disconnect());
