import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
import { isVoiceApproved } from "../src/lib/approvedVoices";
import * as fs from "fs";
const p=new PrismaClient();
(async()=>{
  const rows=await p.journeyStory.findMany({ where:{journeyId:"cmrdqk484000032r4rt2vw4ej", status:"published"}, select:{slug:true, voiceId:true, practiceVoiceId:true}, orderBy:{createdAt:"asc"} });
  const voices=new Set<string>();
  const lines:string[]=[];
  for(const r of rows){
    const v=r.practiceVoiceId || r.voiceId || "";
    voices.add(v);
    lines.push(r.slug!);
  }
  fs.writeFileSync("/tmp/latam_friends_slugs.txt", lines.join("\n")+"\n");
  console.log("slugs:", rows.length);
  for(const v of voices) console.log(`  voice ${v} approved=${isVoiceApproved(v)}`);
  // _sets existence
  let ok=0, miss:string[]=[];
  for(const s of lines){ if(fs.existsSync(`scripts/_sets/${s}.json`)) ok++; else miss.push(s); }
  console.log(`_sets presentes: ${ok}/${lines.length}${miss.length?` | faltan: ${miss.join(", ")}`:""}`);
})().finally(()=>p.$disconnect());
