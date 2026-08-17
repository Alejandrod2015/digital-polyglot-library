import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
import * as fs from "fs";
const p=new PrismaClient();
const DIALECT=/strüßjer|willze|hajanoi|dahoam|gschwind|goht|cuático|guata|weveo|curao/i;
(async()=>{
  // 10 practice clips ESTÁNDAR de german Friends
  const stories=await p.journeyStory.findMany({where:{journeyId:"cmroo4w4v0000324ow1o9qlcp",status:"published"},select:{slug:true,title:true,audioUrl:true,practiceSet:{select:{exercises:{select:{type:true,word:true,payload:true}}}}},orderBy:{createdAt:"asc"}});
  const clips:Array<{word:string,sent:string,url:string,slug:string}>=[];
  for(const s of stories){
    for(const e of (s.practiceSet?.exercises??[])){
      if(e.type!=="meaning_in_context"&&e.type!=="fill_blank")continue;
      const ac=(e.payload as any)?.audioClip; const url=ac?.clipUrl;
      if(typeof url==="string"&&url&&!DIALECT.test(e.word||"")&&!DIALECT.test(ac.sentence||"")){
        clips.push({word:e.word,sent:ac.sentence,url,slug:s.slug!});
      }
    }
  }
  // muestra: 1 por historia, primeras 10
  const seen=new Set<string>(); const sample:typeof clips=[];
  for(const c of clips){ if(seen.has(c.slug))continue; seen.add(c.slug); sample.push(c); if(sample.length>=10)break; }
  // 2 narraciones del Expat (referencia); historia completa
  const expat=await p.journeyStory.findMany({where:{journeyId:"cmrag1dfd4fgx000032abcdefghij".slice(0,0)||undefined},select:{slug:true}}).catch(()=>[]);
  // buscar Expat por lenguaje/variant/name
  const ej=await p.journey.findFirst({where:{language:"german",variant:"germany",name:"Expat"},select:{id:true}});
  const enar=ej?await p.journeyStory.findMany({where:{journeyId:ej.id,status:"published",audioUrl:{not:null}},select:{slug:true,title:true,audioUrl:true},take:2}):[];

  const clipBlocks=sample.map((c,i)=>`<div class="clip"><div class="hd">${i+1}. <b>${c.word}</b> <span>· ${c.slug}</span></div><div class="sen">${c.sent}</div><audio controls preload="none" src="${c.url}"></audio></div>`).join("");
  const narBlocks=enar.map(n=>`<div class="clip nar"><div class="hd">NARRACIÓN Expat · ${n.title}</div><audio controls preload="none" src="${n.audioUrl}"></audio></div>`).join("");
  const html=`<!doctype html><html lang="es"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Muestra alemán; calidad</title>
<style>:root{color-scheme:dark}body{margin:0;font-family:-apple-system,system-ui,sans-serif;background:#0a1424;color:#e9eef7;padding:24px;max-width:760px}
h1{font-size:20px;margin:0 0 2px}h2{font-size:14px;color:#8ea0bd;margin:22px 0 8px}p.sub{color:#8ea0bd;font-size:13px;margin:0 0 12px}
.clip{padding:12px;margin-bottom:10px;border:1px solid rgba(255,255,255,.12);border-radius:12px;background:rgba(255,255,255,.03)}
.clip.nar{background:rgba(52,211,153,.08)}.hd{font-size:14px}.hd span{color:#8ea0bd;font-size:12px}.sen{color:#c7d3e6;font-size:13px;font-style:italic;margin:4px 0 8px}audio{width:100%;height:34px}</style></head>
<body><h1>¿Suena a alemán?; muestra estándar</h1><p class="sub">10 practice clips NORMALES de german Friends (sin dialecto) + narración del Expat, misma voz (${"Ww7Sq9tx9CCOiNOwWgsx"}), mismo modelo v2. Juzga si el acento es aceptable o hay que cambiar modelo/voz para alemán.</p>
<h2>PRACTICE CLIPS (german Friends)</h2>${clipBlocks}
<h2>NARRACIÓN (Expat; referencia que ya usas)</h2>${narBlocks}
</body></html>`;
  fs.writeFileSync("public/_aleman-calidad.html",html);
  console.log(`página: public/_aleman-calidad.html | clips=${sample.length} narración=${enar.length}`);
})().finally(()=>p.$disconnect());
