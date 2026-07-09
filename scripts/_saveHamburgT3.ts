import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
import * as fs from "fs";
const J = "cmrdbz11t000032asrvo832i9";
const SLUGS: Record<string,Record<number,string>> = { "das-kontor": {
  1: "ein-kaufmann-ein-wort", 2: "understatement-verkauft", 3: "feierabend-an-der-elbe",
} };
(async()=>{
  const p=new PrismaClient();
  const data=JSON.parse(fs.readFileSync("scripts/_hamburgT3_data.json","utf8"));
  for(const d of data){
    const slot=await p.journeyStory.findFirst({where:{journeyId:J, topic:d.topic, slotIndex:d.slotIndex}});
    if(!slot){ console.log("NO slot",d.topic,d.slotIndex); continue; }
    const slug=SLUGS[d.topic][d.slotIndex];
    await p.journeyStory.update({where:{id:slot.id}, data:{ title:d.title, slug, text:d.text, vocab:d.vocab, arcType:d.arcType, synopsis:d.synopsis }});
    console.log(`saved ${d.topic}#${d.slotIndex} -> ${slug} (${d.vocab.length} vocab)`);
  }
  await p.$disconnect();
})().catch(e=>{console.error(e);process.exit(1);});
