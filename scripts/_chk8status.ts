import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p=new PrismaClient();
const strip=(s:string)=>s.normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-zß ]/g,"").trim();
const OCHO:Array<[string,string]>=[
  ["cmroo4w4v0000324ow1o9qlcp","abwinken"],["cmroo4w4v0000324ow1o9qlcp","Strüßjer"],
  ["cmroo4w4v0000324ow1o9qlcp","wat willze"],["cmroo4w4v0000324ow1o9qlcp","hajanoi"],
  ["cmrdqk484000032r4rt2vw4ej","show"],["cmrdqk484000032r4rt2vw4ej","cuático"],
  ["cmrdqk484000032r4rt2vw4ej","guata"],["cmrdqk484000032r4rt2vw4ej","dejar huella"],
];
(async()=>{
  for(const [jid,word] of OCHO){
    const st=await p.journeyStory.findMany({where:{journeyId:jid,status:"published"},select:{practiceSet:{select:{exercises:{select:{word:true,payload:true}}}}}});
    let s="(no encontrado)";
    for(const x of st) for(const e of (x.practiceSet?.exercises??[])){ if(strip(e.word||"")===strip(word)){ const u=(e.payload as any)?.audioClip?.clipUrl; s=(typeof u==="string"&&u)?"CON audio (live)":"sin audio"; } }
    console.log(`${word.padEnd(15)} -> ${s}`);
  }
})().finally(()=>p.$disconnect());
