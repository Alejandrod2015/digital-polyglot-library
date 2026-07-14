import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
import * as fs from "fs";
const p = new PrismaClient();
const TOK=/\p{L}+(?:-\p{L}+)*/u;
(async()=>{
  const rows=await p.journeyStory.findMany({where:{journeyId:"cmrdqk484000032r4rt2vw4ej", NOT:{title:null}}, select:{text:true}});
  const toks=new Set<string>();
  for(const r of rows) for(const chunk of (r.text as string).split(/\s+/)){ const m=chunk.toLowerCase().match(TOK); if(m) toks.add(m[0].normalize("NFC")); }
  const sorted=[...toks].sort();
  console.log("stories:",rows.length,"| unique tokens:",toks.size);
  fs.writeFileSync("scripts/_friends_tokens.json", JSON.stringify(sorted,null,0));
  console.log("wrote scripts/_friends_tokens.json");
})().finally(()=>p.$disconnect());
