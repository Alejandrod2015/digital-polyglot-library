import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
import * as fs from "fs";
const p=new PrismaClient();
(async()=>{
  const slugs=["buergeramt-neukoelln-sieben-uhr","umzug-ohne-aufzug","ganz-berlin-wartet-auf-einen-mord"];
  let blocks="";
  for(const slug of slugs){
    const st=await p.journeyStory.findFirst({where:{slug},select:{practiceSet:{select:{exercises:{select:{word:true,type:true,payload:true}}}}}});
    const ms=(st?.practiceSet?.exercises??[]).filter(e=>e.type==="meaning_in_context").slice(0,4);
    for(const e of ms){ const url=(e.payload as any)?.audioClip?.wordClipUrl; if(!url)continue;
      blocks+=`<div class="clip"><div class="w">${e.word}</div><div class="s">${slug.slice(0,20)}</div><audio controls preload="none" src="${url}"></audio></div>`; }
  }
  const html=`<!doctype html><html lang="es"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Spot-check Expat</title>
<style>:root{color-scheme:dark}body{margin:0;font-family:-apple-system,system-ui,sans-serif;background:#0a1424;color:#e9eef7;padding:24px;max-width:640px}
h1{font-size:20px;margin:0 0 2px}p.sub{color:#8ea0bd;font-size:13px;margin:0 0 18px}
.clip{display:flex;align-items:center;gap:12px;padding:8px 12px;margin-bottom:7px;border:1px solid rgba(255,255,255,.12);border-radius:12px}
.w{flex:0 0 180px;font-size:15px;font-weight:700}.s{flex:0 0 90px;color:#8ea0bd;font-size:11px}audio{flex:1;height:34px}</style></head>
<body><h1>Spot-check Expat (3 historias distintas)</h1><p class="sub">Muestra de otras historias para confirmar que todo el journey quedó como afirmación.</p>${blocks}</body></html>`;
  fs.writeFileSync("public/_expat-spotcheck.html",html);
  console.log("página: public/_expat-spotcheck.html");
})().finally(()=>p.$disconnect());
