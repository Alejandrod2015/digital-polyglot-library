import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
import * as fs from "fs";
const p = new PrismaClient();
const TOK=/\p{L}+(?:-\p{L}+)*/u;
(async()=>{
  const rows=await p.journeyStory.findMany({where:{journeyId:"cmrdbz11t000032asrvo832i9", NOT:{title:null}}, select:{slug:true,text:true,topic:true,slotIndex:true}});
  const TOPICS=["ankommen-im-norden","wohnen-in-der-hansestadt","das-kontor","hanseatische-formen","alltag-an-der-elbe","vereine-und-freundschaft","sturm-und-gesundheit"];
  rows.sort((a:any,b:any)=>TOPICS.indexOf(a.topic)-TOPICS.indexOf(b.topic)||a.slotIndex-b.slotIndex);
  const slugs=rows.map((r:any)=>r.slug);
  // all tokens
  const toks=new Set<string>();
  for(const r of rows) for(const chunk of (r.text as string).split(/\s+/)){ const m=chunk.toLowerCase().match(TOK); if(m) toks.add(m[0].normalize("NFC")); }
  const berlin=JSON.parse(fs.readFileSync("src/data/tapGlosses/german-expat.json","utf8")).glosses;
  const mine=JSON.parse(fs.readFileSync("scripts/_hh_missing_glosses.json","utf8"));
  const glosses:Record<string,any>={};
  const uncovered:string[]=[];
  for(const t of toks){
    if(berlin[t]) glosses[t]={g:berlin[t].g,t:berlin[t].t,...(berlin[t].r?{r:berlin[t].r}:{})};
    else if(mine[t]) glosses[t]=mine[t];
    else uncovered.push(t);
  }
  const extra=Object.keys(mine).filter(k=>!toks.has(k));
  console.log("slugs:",slugs.length,"| tokens:",toks.size,"| glosses:",Object.keys(glosses).length);
  console.log("UNCOVERED (typos/faltan):",uncovered.length, uncovered.slice(0,40));
  console.log("EXTRA en mi archivo (no en tokens):",extra.length, extra.slice(0,40));
  if(uncovered.length===0){
    fs.writeFileSync("src/data/tapGlosses/german-hamburg.json", JSON.stringify({slugs,glosses},null,1));
    console.log("WROTE src/data/tapGlosses/german-hamburg.json");
  } else { console.log("NO escrito: hay uncovered"); }
})().finally(()=>p.$disconnect());
