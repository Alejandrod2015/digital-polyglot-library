/**
 * Validate + save German journey stories into their slots (topic+slotIndex).
 * Usage: tsx scripts/_saveDEStory.ts <file1.json> [file2.json ...]
 * Processes in arg order, accumulating journey context for cross-story checks.
 * Saves (status=generated) only when the validator reports no hard fails.
 */
import { config } from "dotenv";
config({ path: ".env.local" }); config({ path: ".env" });
import { readFileSync } from "node:fs";
import { PrismaClient } from "../src/generated/prisma";
import { validateGeneratedStory, type ExistingStorySummary } from "../src/lib/validateGeneratedStory";

const JOURNEY_ID = "cmqfnp3tf000032afygkqp8z2";
const slugify = (s:string)=>s.normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,60);
const firstSentence=(t:string)=>{const p=t.split(/\n+/)[0]??"";return (p.match(/^.*?[.!?…]/)?.[0]??p).trim();};
const lemmas=(v:any[])=>v.map(x=>String(x.word).toLowerCase());
const names=(t:string)=>{const s=new Set<string>();for(const l of t.split(/\n+/)){const m=l.match(/^([A-ZÄÖÜ][\wäöüß]+):\s/);if(m)s.add(m[1]);}return[...s];};

async function run(){
  const files=process.argv.slice(2);
  if(!files.length){console.error("usage: _saveDEStory.ts <json...>");process.exit(2);}
  const p=new PrismaClient();
  for(const file of files){
    const d=JSON.parse(readFileSync(file,"utf8"));
    const allRaw=await p.journeyStory.findMany({where:{journeyId:JOURNEY_ID,status:{not:"draft"}},
      select:{title:true,topic:true,slotIndex:true,arcType:true,vocab:true,text:true}});
    const all=allRaw.filter(s=>!(s.topic===d.topic&&s.slotIndex===d.slotIndex));
    const journeyTitles=all.map(s=>s.title!).filter(Boolean);
    const existing:ExistingStorySummary[]=all.filter(s=>s.topic===d.topic).map(s=>({
      title:s.title!,arcType:s.arcType,vocabLemmas:lemmas((s.vocab as any[])??[]),
      characterNames:names(s.text??""),openingFirstSentence:firstSentence(s.text??"")}));
    const res=await validateGeneratedStory(d,{language:"DE",level:"a1",topic:d.topic,variant:"germany",existing,journeyTitles});
    const fails=res.checks.filter(c=>c.status==="fail");
    const warns=res.checks.filter(c=>c.status==="warn");
    console.log(`\n=== ${d.topic}#${d.slotIndex} "${d.title}" === ${fails.length} fail / ${warns.length} warn`);
    for(const c of fails) console.log(`  FAIL ${c.id}: ${c.detail??""}`);
    for(const c of warns) console.log(`  warn ${c.id}: ${c.detail??""}`);
    if(fails.length){console.log("  -> NOT saved (fix fails)");continue;}
    const slot=await p.journeyStory.findFirst({where:{journeyId:JOURNEY_ID,topic:d.topic,slotIndex:d.slotIndex},select:{id:true}});
    if(!slot){console.error(`  no slot ${d.topic}#${d.slotIndex}`);continue;}
    const wordCount=(d.text as string).trim().split(/\s+/).length;
    await p.journeyStory.update({where:{id:slot.id},data:{
      title:d.title,slug:slugify(d.title),synopsis:d.synopsis,text:d.text,vocab:d.vocab,
      arcType:d.arcType,wordCount,vocabCount:d.vocab.length,status:"generated"}});
    console.log(`  SAVED (${wordCount}w, ${d.vocab.length} vocab)`);
  }
  await p.$disconnect();
}
run().catch(e=>{console.error(e);process.exit(1);});
