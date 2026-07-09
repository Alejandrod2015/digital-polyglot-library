import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
import * as fs from "fs";
const J = "cmrdbz11t000032asrvo832i9";
const SLUGS: Record<string,Record<number,string>> = { "vereine-und-freundschaft": {
  1: "erst-die-satzung-dann-die-see", 2: "am-millerntor-wird-geschrien", 3: "merles-zweiter-schluessel",
} };
(async()=>{
  const p=new PrismaClient();
  const data=JSON.parse(fs.readFileSync("scripts/_hamburgT6_data.json","utf8"));
  for(const d of data){
    if(d.topic==="vereine-und-freundschaft" && d.slotIndex===1){ console.log("SKIP #16 (reescrito; fuente = _hamburgRW_data.json)"); continue; }
    const slot=await p.journeyStory.findFirst({where:{journeyId:J, topic:d.topic, slotIndex:d.slotIndex}});
    if(!slot){ console.log("NO slot",d.topic,d.slotIndex); continue; }
    const slug=SLUGS[d.topic][d.slotIndex];
    await p.journeyStory.update({where:{id:slot.id}, data:{ title:d.title, slug, text:d.text, vocab:d.vocab, arcType:d.arcType, synopsis:d.synopsis }});
    console.log(`saved ${d.topic}#${d.slotIndex} -> ${slug}`);
  }
  await p.$disconnect();
})().catch(e=>{console.error(e);process.exit(1);});
