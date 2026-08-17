import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
import * as fs from "fs";
const p=new PrismaClient();
const strip=(s:string)=>s.normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-zß ]/g,"").trim();
const OCHO:Array<[string,string,string]>=[
  ["cmroo4w4v0000324ow1o9qlcp","abwinken","DE"],["cmroo4w4v0000324ow1o9qlcp","Strüßjer","DE"],
  ["cmroo4w4v0000324ow1o9qlcp","wat willze","DE"],["cmroo4w4v0000324ow1o9qlcp","hajanoi","DE"],
  ["cmrdqk484000032r4rt2vw4ej","show","ES"],["cmrdqk484000032r4rt2vw4ej","cuático","ES"],
  ["cmrdqk484000032r4rt2vw4ej","guata","ES"],["cmrdqk484000032r4rt2vw4ej","dejar huella","ES"],
];
(async()=>{
  let blocks="";
  for(const [jid,word,lang] of OCHO){
    const st=await p.journeyStory.findMany({where:{journeyId:jid,status:"published"},select:{practiceSet:{select:{exercises:{select:{word:true,payload:true}}}}}});
    let url="",sent="";
    for(const s of st) for(const e of (s.practiceSet?.exercises??[])){ if(strip(e.word||"")===strip(word)){ const ac=(e.payload as any)?.audioClip; url=ac?.clipUrl||""; sent=ac?.sentence||""; } }
    blocks+=`<div class="clip"><div class="hd"><span class="j">${lang}</span> · <b>${word}</b> ${url?'<span class="ok">live</span>':'<span class="bad">SIN AUDIO</span>'}</div><div class="sen">${sent}</div>${url?`<audio controls preload="none" src="${url}"></audio>`:""}</div>`;
  }
  const html=`<!doctype html><html lang="es"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Los 8; corregidos</title>
<style>:root{color-scheme:dark}body{margin:0;font-family:-apple-system,system-ui,sans-serif;background:#0a1424;color:#e9eef7;padding:24px;max-width:760px}
h1{font-size:20px;margin:0 0 2px}p.sub{color:#8ea0bd;font-size:13px;margin:0 0 18px}
.clip{padding:14px;margin-bottom:12px;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:rgba(255,255,255,.03)}
.hd{font-size:15px}.j{color:#8ea0bd;font-size:12px}.ok{color:#34d399;font-size:11px;margin-left:6px}.bad{color:#fb7185;font-size:11px}
.sen{color:#c7d3e6;font-size:14px;font-style:italic;margin:4px 0 10px}audio{width:100%;height:34px}</style></head>
<body><h1>Los 8 que sonaban mal; versión corregida (live)</h1><p class="sub">Versiones actuales en producción, con idioma correcto verificado. Escucha y dime si alguna aún chirría.</p>${blocks}</body></html>`;
  fs.writeFileSync("public/_los8-corregidos.html",html);
  console.log("página: public/_los8-corregidos.html");
})().finally(()=>p.$disconnect());
