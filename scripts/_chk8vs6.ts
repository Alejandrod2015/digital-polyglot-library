import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p=new PrismaClient();
const strip=(s:string)=>s.normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-zß ]/g,"").trim();
// los 8 que oíste (página de audición)
const OCHO:Array<[string,string,string]>=[
  ["cmroo4w4v0000324ow1o9qlcp","Strüßjer","DE"],["cmroo4w4v0000324ow1o9qlcp","abwinken","DE"],
  ["cmroo4w4v0000324ow1o9qlcp","wat willze","DE"],["cmroo4w4v0000324ow1o9qlcp","hajanoi","DE"],
  ["cmrdqk484000032r4rt2vw4ej","show","ES"],["cmrdqk484000032r4rt2vw4ej","cuático","ES"],
  ["cmrdqk484000032r4rt2vw4ej","guata","ES"],["cmrdqk484000032r4rt2vw4ej","dejar huella","ES"],
];
const SEIS=["dahoam","ruhig","des goht","wohlig","gschwind","die Currywurst"];
(async()=>{
  console.log("=== LOS 8 (los que oíste): ¿tienen clipUrl en DB (= shipped)? ===");
  for(const [jid,word] of OCHO){
    const stories=await p.journeyStory.findMany({where:{journeyId:jid,status:"published"},select:{practiceSet:{select:{exercises:{select:{word:true,payload:true}}}}}});
    let found:string|null=null;
    for(const s of stories) for(const e of (s.practiceSet?.exercises??[])){ if(strip(e.word||"")===strip(word)){ const u=(e.payload as any)?.audioClip?.clipUrl; found=(typeof u==="string"&&u)?"SÍ shipped":"NO (sin clipUrl = falló gate)"; } }
    console.log(`  ${word.padEnd(16)} -> ${found}`);
  }
  console.log("\n=== LOS 6 (los que sí shipearon mal): ¿tienen clipUrl? ===");
  const de=await p.journeyStory.findMany({where:{journeyId:"cmroo4w4v0000324ow1o9qlcp",status:"published"},select:{practiceSet:{select:{exercises:{select:{word:true,payload:true}}}}}});
  for(const w of SEIS){ let f="NO"; for(const s of de) for(const e of (s.practiceSet?.exercises??[])){ if(strip(e.word||"")===strip(w)){ const u=(e.payload as any)?.audioClip?.clipUrl; f=(typeof u==="string"&&u)?"SÍ shipped":"NO"; } } console.log(`  ${w.padEnd(16)} -> ${f}`); }
})().finally(()=>p.$disconnect());
