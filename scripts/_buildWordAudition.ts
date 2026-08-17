import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
import * as fs from "fs";
const p=new PrismaClient();
(async()=>{
  const ex=await p.storyPracticeExercise.findMany({where:{set:{story:{slug:"im-keller-wohnt-die-hausordnung"}},type:"meaning_in_context"},select:{word:true,payload:true},orderBy:{orderIndex:"asc"}});
  let blocks="";
  for(const e of ex){ const ac=(e.payload as any)?.audioClip; const url=ac?.wordClipUrl; if(!url)continue;
    blocks+=`<div class="clip"><div class="w">${e.word}</div><audio controls preload="none" src="${url}"></audio></div>`; }
  const html=`<!doctype html><html lang="es"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Palabras piloto; Expat</title>
<style>:root{color-scheme:dark}body{margin:0;font-family:-apple-system,system-ui,sans-serif;background:#0a1424;color:#e9eef7;padding:24px;max-width:640px}
h1{font-size:20px;margin:0 0 2px}p.sub{color:#8ea0bd;font-size:13px;margin:0 0 18px}
.clip{display:flex;align-items:center;gap:14px;padding:10px 12px;margin-bottom:8px;border:1px solid rgba(255,255,255,.12);border-radius:12px;background:rgba(255,255,255,.03)}
.w{flex:0 0 210px;font-size:16px;font-weight:700}audio{flex:1;height:36px}</style></head>
<body><h1>14 clips de PALABRA (piloto Expat)</h1><p class="sub">Lo que debería sonar en meaning: solo la palabra, voz del narrador alemán. Confirma que suenan bien antes de generar el resto.</p>${blocks}</body></html>`;
  fs.writeFileSync("public/_word-audition.html",html);
  console.log("página: public/_word-audition.html");
})().finally(()=>p.$disconnect());
