import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
import * as fs from "fs";
const p=new PrismaClient();
const strip=(s:string)=>s.trim().toLowerCase();
const FIVE=["der Sechser im Lotto","der Haken","verraten","friedlich","der Vorlauf"];
(async()=>{
  const ex=await p.storyPracticeExercise.findMany({where:{set:{story:{slug:"im-keller-wohnt-die-hausordnung"}},type:"meaning_in_context"},select:{word:true,payload:true}});
  let blocks="";
  for(const w of FIVE){ const e=ex.find(x=>strip(x.word||"")===strip(w)); const url=(e?.payload as any)?.audioClip?.wordClipUrl; if(!url)continue;
    blocks+=`<div class="clip"><div class="w">${w}</div><audio controls preload="none" src="${url}"></audio></div>`; }
  const html=`<!doctype html><html lang="es"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>5 palabras corregidas</title>
<style>:root{color-scheme:dark}body{margin:0;font-family:-apple-system,system-ui,sans-serif;background:#0a1424;color:#e9eef7;padding:24px;max-width:640px}
h1{font-size:20px;margin:0 0 2px}p.sub{color:#8ea0bd;font-size:13px;margin:0 0 18px}
.clip{display:flex;align-items:center;gap:14px;padding:10px 12px;margin-bottom:8px;border:1px solid rgba(52,211,153,.25);border-radius:12px;background:rgba(52,211,153,.06)}
.w{flex:0 0 210px;font-size:16px;font-weight:700}audio{flex:1;height:36px}</style></head>
<body><h1>5 palabras; corregidas (afirmación, no pregunta)</h1><p class="sub">Marco declarativo + gate F0 (final baja). ¿Suenan como afirmación ya, sin el "?" del final?</p>${blocks}</body></html>`;
  fs.writeFileSync("public/_5word-corregidas.html",html);
  console.log("página: public/_5word-corregidas.html");
})().finally(()=>p.$disconnect());
