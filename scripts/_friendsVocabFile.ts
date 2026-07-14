import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
import * as fs from "fs";
const p=new PrismaClient();
(async()=>{
  const rows=await p.journeyStory.findMany({where:{journeyId:"cmrdqk484000032r4rt2vw4ej",NOT:{title:null}},select:{slug:true,vocab:true}});
  const out:Record<string,any[]>={};
  for(const r of rows) out[r.slug!]=((r.vocab as any[])??[]).map(v=>({w:v.word,...(v.surface?{s:v.surface}:{})}));
  fs.writeFileSync("scripts/_friends_vocab.json",JSON.stringify(out));
  console.log("wrote _friends_vocab.json for",rows.length,"slugs");
})().finally(()=>p.$disconnect());
