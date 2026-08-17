import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
import crypto from "node:crypto";
const p=new PrismaClient();
const CLIP_VERSION="v4";
const key=(voice:string,sentence:string,rev:number)=>crypto.createHash("sha256").update(`${CLIP_VERSION}|${voice}|${sentence}${rev?`|r${rev}`:""}`).digest("hex").slice(0,16);
(async()=>{
  const targets=["Sechser im Lotto","der Haken","Haken"];
  const rows=await p.storyPracticeExercise.findMany({
    where:{ OR: targets.map(w=>({word:{contains:w}})) },
    select:{ word:true, type:true, sentence:true, payload:true,
      set:{ select:{ story:{ select:{ slug:true, voiceId:true, practiceVoiceId:true, journey:{select:{language:true,variant:true,name:true}} } } } } },
  });
  console.log(`encontrados: ${rows.length}`);
  for(const r of rows){
    const ac=(r.payload as any)?.audioClip;
    const st=r.set?.story;
    const voice=st?.practiceVoiceId||st?.voiceId||"";
    const sent=ac?.sentence||"";
    const rev=ac?.rev||0;
    const clipUrl=ac?.clipUrl||"";
    const storedHash=clipUrl.split("/").pop()?.replace(".mp3","")||"";
    const expected=voice&&sent?key(voice,sent,rev):"(no voice/sent)";
    const ok = storedHash===expected;
    console.log(`\n[${st?.journey?.language}/${st?.journey?.name}] ${st?.slug} | word="${r.word}" type=${r.type}`);
    console.log(`  audioClip.sentence: "${sent}"`);
    console.log(`  voice=${voice} rev=${rev}`);
    console.log(`  clipUrl hash=${storedHash} | esperado(hash de la oración)=${expected} | ${ok?"OK ✓":"✗ MISMATCH → suena OTRA frase"}`);
  }
})().finally(()=>p.$disconnect());
