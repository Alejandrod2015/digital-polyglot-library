import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
import * as fs from "fs";
const p=new PrismaClient();
const T=["el-cotorreo","la-carrilla","el-chisme","la-vacilada","el-desahogo","la-jerga","el-weveo"];
(async()=>{
  const rows=await p.journeyStory.findMany({where:{journeyId:"cmrdqk484000032r4rt2vw4ej",NOT:{title:null}},select:{title:true,text:true,topic:true,slotIndex:true,arcType:true,vocab:true}});
  rows.sort((a:any,b:any)=>T.indexOf(a.topic)-T.indexOf(b.topic)||a.slotIndex-b.slotIndex);
  let out="";
  for(const r of rows as any[]){
    out+=`\n===== ${r.topic} #${r.slotIndex} — "${r.title}" [${r.arcType}] =====\n${r.text}\nVOCAB: ${(r.vocab as any[]).map(v=>v.word).join(", ")}\n`;
  }
  fs.writeFileSync("/tmp/friends_dump.txt",out);
  console.log("wrote /tmp/friends_dump.txt", out.length, "chars");
})().finally(()=>p.$disconnect());
