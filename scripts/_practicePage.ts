import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import fs from "node:fs";
import { PrismaClient } from "../src/generated/prisma";
const p:any=new PrismaClient();
const esc=(s:string)=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
(async()=>{
  const slugs=process.argv.slice(3);
  let html="";
  for(const slug of slugs){
    const st=await p.journeyStory.findFirst({where:{slug},select:{id:true,title:true}});
    const set=await p.storyPracticeSet.findFirst({where:{storyId:st.id},include:{exercises:true}});
    html+=`<h2>${esc(st.title)}</h2>`;
    for(const e of set.exercises){
      const c=(e.payload as any)?.audioClip; if(!c?.clipUrl) continue;
      const feat=e.featured!==false;
      html+=`<div class="c"><div class="h"><b>${esc(e.word)}</b><span class="ty">${e.type}</span>${feat?"":"<span class=pool>pool</span>"}</div>
      <div class="s">${esc(c.sentence)}</div><audio controls preload="none" src="${c.clipUrl}"></audio>
      ${c.wordClipUrl?`<div class="wl">palabra suelta</div><audio controls preload="none" src="${c.wordClipUrl}"></audio>`:""}</div>`;
    }
  }
  fs.writeFileSync("/tmp/t.html",`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/><title>Práctica PT-BR</title>
<style>:root{color-scheme:dark}body{margin:0;padding:28px 18px 60px;background:#0a1424;color:#e9eef7;
font:15px/1.55 -apple-system,system-ui,sans-serif;max-width:700px;margin-inline:auto}
h1{font-size:19px;margin:0 0 18px}h2{font-size:16px;margin:26px 0 10px;color:#8ea0bd;
border-bottom:1px solid rgba(255,255,255,.12);padding-bottom:6px}
.c{border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:12px 14px;margin-bottom:9px;
background:rgba(255,255,255,.03)}
.h{display:flex;gap:8px;align-items:center;margin-bottom:5px}
.ty{color:#64789a;font-size:10px;text-transform:uppercase;letter-spacing:.05em}
.pool{color:#a8825a;font-size:10px;border:1px solid rgba(200,150,90,.4);border-radius:5px;padding:0 5px}
.s{color:#c7d3e6;font-size:14px;margin-bottom:7px}
.wl{color:#64789a;font-size:11px;margin-top:7px}audio{width:100%;height:32px}</style></head><body>
<h1>${process.argv[2]}</h1>${html}</body></html>`);
  await p.$disconnect();
})();
