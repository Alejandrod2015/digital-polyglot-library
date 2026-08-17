import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
import crypto from "node:crypto";
const p=new PrismaClient();
const key=(voice:string,sentence:string,rev:number)=>crypto.createHash("sha256").update(`v4|${voice}|${sentence}${rev?`|r${rev}`:""}`).digest("hex").slice(0,16);
(async()=>{
  const rows=await p.storyPracticeExercise.findMany({
    where:{ OR:[{sentence:{contains:"Der Käse ist warm"}},{sentence:{contains:"Käse ist warm"}}] },
    select:{ type:true, word:true, sentence:true, payload:true,
      set:{select:{story:{select:{slug:true,voiceId:true,practiceVoiceId:true,journey:{select:{language:true,variant:true,name:true,status:true}}}}}} },
  });
  console.log("encontrados:", rows.length);
  for(const r of rows){
    const ac=(r.payload as any)?.audioClip; const st=r.set?.story;
    const voice=st?.practiceVoiceId||st?.voiceId||"";
    const sent=ac?.sentence||""; const rev=ac?.rev||0; const url=ac?.clipUrl||"";
    const storedHash=url.split("/").pop()?.replace(".mp3","")||"";
    const expected=voice&&sent?key(voice,sent,rev):"?";
    console.log(`\n[${st?.journey?.language}/${st?.journey?.name} ${st?.journey?.status}] ${st?.slug}`);
    console.log(`  type=${r.type} answer/word="${r.word}"`);
    console.log(`  columna sentence (lo que se muestra): "${r.sentence}"`);
    console.log(`  audioClip.sentence (lo que suena): "${sent}"`);
    console.log(`  voice=${voice}`);
    console.log(`  clipUrl=${url}`);
    console.log(`  hash guardado=${storedHash} | esperado=${expected} | ${storedHash===expected?"OK ✓ (clip corresponde a su oración)":"✗ MISMATCH"}`);
  }
})().finally(()=>p.$disconnect());
