import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
import * as fs from "fs";
const p = new PrismaClient();
const TOK=/\p{L}+(?:-\p{L}+)*/u;
const TOPICS=["el-cotorreo","la-carrilla","el-chisme","la-vacilada","el-desahogo","la-jerga","el-weveo"];
(async()=>{
  const rows=await p.journeyStory.findMany({where:{journeyId:"cmrdqk484000032r4rt2vw4ej", NOT:{title:null}}, select:{slug:true,text:true,topic:true,slotIndex:true}});
  rows.sort((a:any,b:any)=>TOPICS.indexOf(a.topic)-TOPICS.indexOf(b.topic)||a.slotIndex-b.slotIndex);
  const slugs=rows.map((r:any)=>r.slug);
  // merge 6 gloss chunks
  const merged:Record<string,any>={};
  for(let i=1;i<=14;i++){
    const part=JSON.parse(fs.readFileSync(`scripts/_friends_gloss_chunk_${i}.json`,"utf8"));
    for(const [k,v] of Object.entries(part)) merged[k.normalize("NFC")]=v;
  }
  // all tokens across 21 stories
  const toks=new Set<string>();
  for(const r of rows) for(const chunk of (r.text as string).split(/\s+/)){ const m=chunk.toLowerCase().match(TOK); if(m) toks.add(m[0].normalize("NFC")); }
  const glosses:Record<string,any>={};
  const uncovered:string[]=[];
  const badType:string[]=[];
  const OK=new Set(["verb","noun","adjective","adverb","pronoun","preposition","conjunction","article","number","expression","other"]);
  for(const t of toks){
    const g=merged[t];
    if(!g||!g.g||!g.t){ uncovered.push(t); continue; }
    if(!OK.has(g.t)) badType.push(`${t}=${g.t}`);
    glosses[t]={g:String(g.g),t:String(g.t)};
  }
  console.log("slugs:",slugs.length,"| tokens:",toks.size,"| glosses:",Object.keys(glosses).length);
  console.log("UNCOVERED:",uncovered.length, uncovered.slice(0,60));
  console.log("BAD TYPE:",badType.length, badType.slice(0,30));
  if(uncovered.length===0 && badType.length===0){
    fs.writeFileSync("src/data/tapGlosses/spanish-friends.json", JSON.stringify({slugs,glosses},null,1));
    console.log("WROTE src/data/tapGlosses/spanish-friends.json");
  } else { console.log("NOT written: fix uncovered/badType first"); }
})().finally(()=>p.$disconnect());
