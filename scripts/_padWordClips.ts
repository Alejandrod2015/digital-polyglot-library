import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "../src/generated/prisma";
import { getPublicObjectUrl, uploadPublicObject } from "../src/lib/objectStorage";
const prisma = new PrismaClient();
const J="cmrrqjd2n000032nvnp2tryzg";
const VER="w4";
function ff(args:string[]):Promise<void>{return new Promise((res,rej)=>{const p=spawn("ffmpeg",args);let e="";p.stderr.on("data",c=>e+=c);p.on("error",rej);p.on("close",c=>c===0?res():rej(new Error(e.slice(0,150))));});}
function key(voice:string,word:string){const h=crypto.createHash("sha256").update(`${VER}|${voice}|${word.toLowerCase()}`).digest("hex").slice(0,20);return `media/practice/word-clip/${h}.mp3`;}
(async()=>{
  const rows=await prisma.storyPracticeExercise.findMany({ where:{ type:"meaning_in_context", set:{story:{journeyId:J}} }, select:{ id:true, word:true, payload:true } });
  let ok=0, skip=0, fail=0;
  for(const e of rows){
    const ac:any=(e.payload as any)?.audioClip;
    if(!ac?.wordClipUrl){ skip++; continue; }
    const voice=ac.wordVoiceId || ""; const word=e.word!;
    const d=mkdtempSync(join(tmpdir(),"pad-")); const inp=join(d,"i.mp3"), out=join(d,"o.mp3");
    try{
      const r=await fetch(ac.wordClipUrl); if(!r.ok) throw new Error(`dl ${r.status}`);
      writeFileSync(inp, Buffer.from(await r.arrayBuffer()));
      await ff(["-y","-loglevel","error","-i",inp,"-af","adelay=90:all=1","-codec:a","libmp3lame","-b:a","128k",out]);
      const k=key(voice,word);
      await uploadPublicObject({ key:k, body:readFileSync(out), contentType:"audio/mpeg" });
      const url=getPublicObjectUrl(k);
      const np={ ...(e.payload as any), audioClip:{ ...ac, wordClipUrl:url } };
      await prisma.$executeRawUnsafe(`UPDATE dp_story_practice_exercises_v1 SET payload=$1::jsonb, "updatedAt"=CURRENT_TIMESTAMP WHERE id=$2`, JSON.stringify(np), e.id);
      ok++; if(ok%50===0) console.log(`  ...${ok}`);
    }catch(err){ fail++; console.log(`  ✗ ${word}: ${err instanceof Error?err.message:err}`); }
    finally{ rmSync(d,{recursive:true,force:true}); }
  }
  console.log(`\npadded ok=${ok} skip=${skip} fail=${fail} (de ${rows.length})`);
  await prisma.$disconnect();
})();
