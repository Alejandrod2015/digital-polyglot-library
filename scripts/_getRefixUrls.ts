import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p=new PrismaClient();
const strip=(s:string)=>s.normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-zß ]/g,"").trim();
const T:Array<[string,string,string]>=[
  ["cmroo4w4v0000324ow1o9qlcp","dahoam","de"],["cmroo4w4v0000324ow1o9qlcp","gschwind","de"],
  ["cmroo4w4v0000324ow1o9qlcp","des goht","de"],["cmroo4w4v0000324ow1o9qlcp","abwinken","de"],
  ["cmrdqk484000032r4rt2vw4ej","show","es"],["cmrdqk484000032r4rt2vw4ej","guata","es"],["cmrdqk484000032r4rt2vw4ej","dejar huella","es"],
];
(async()=>{
  for(const [jid,word,exp] of T){
    const st=await p.journeyStory.findMany({where:{journeyId:jid,status:"published"},select:{practiceSet:{select:{exercises:{select:{word:true,payload:true}}}}}});
    for(const s of st) for(const e of (s.practiceSet?.exercises??[])){ if(strip(e.word||"")===strip(word)){ const u=(e.payload as any)?.audioClip?.clipUrl; if(typeof u==="string"&&u) console.log(`${exp}|${word}|${u}`); } }
  }
})().finally(()=>p.$disconnect());
