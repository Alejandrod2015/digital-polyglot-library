import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
import * as fs from "fs";
const p=new PrismaClient();
const TOPICS=["ankommen-im-norden","wohnen-in-der-hansestadt","das-kontor","hanseatische-formen","alltag-an-der-elbe","vereine-und-freundschaft","sturm-und-gesundheit"];
(async()=>{
  const rows=await p.journeyStory.findMany({where:{journeyId:"cmrdbz11t000032asrvo832i9", NOT:{title:null}}, select:{slug:true,topic:true,slotIndex:true,vocab:true}});
  rows.sort((a:any,b:any)=>TOPICS.indexOf(a.topic)-TOPICS.indexOf(b.topic)||a.slotIndex-b.slotIndex);
  const out:any={};
  for(const r of rows) out[r.slug!]=(r.vocab as any[]).map(v=>({w:v.word,s:v.surface||null,t:v.type}));
  fs.writeFileSync(process.env.SC+"/hh_vocab.json", JSON.stringify(out,null,1));
  console.log("dumped", rows.length, "stories");
})().finally(()=>p.$disconnect());
