import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p=new PrismaClient();
(async()=>{
  const grab=async(jid:string)=>{ const st=await p.journeyStory.findMany({where:{journeyId:jid,status:"published"},select:{practiceSet:{select:{exercises:{select:{payload:true}}}}}});
    for(const s of st) for(const e of (s.practiceSet?.exercises??[])){ const u=(e.payload as any)?.audioClip?.clipUrl; if(typeof u==="string"&&u) return u; } return ""; };
  console.log("DE_CTRL "+await grab("cmroo4w4v0000324ow1o9qlcp"));   // german Friends
  console.log("ES_CTRL "+await grab("cmrdqk484000032r4rt2vw4ej"));   // latam Friends
})().finally(()=>p.$disconnect());
