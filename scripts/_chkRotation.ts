import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const COMFORT = new Set(["daily-encounter","harmonic-close"]);
const VALID = new Set(["reframe-turn","juxtaposition-discovery","harmonic-close","mini-cliffhanger","recurring-character-callback","late-reveal","daily-encounter"]);
const TOPICS = ["ankommen-im-norden","wohnen-in-der-hansestadt","das-kontor","hanseatische-formen","alltag-an-der-elbe","vereine-und-freundschaft","sturm-und-gesundheit"];
(async()=>{
  const rows = await p.journeyStory.findMany({ where:{journeyId:"cmrdbz11t000032asrvo832i9", NOT:{title:null}}, select:{topic:true,slotIndex:true,arcType:true,synopsis:true,slug:true} });
  rows.sort((a:any,b:any)=> TOPICS.indexOf(a.topic)-TOPICS.indexOf(b.topic) || a.slotIndex-b.slotIndex);
  const seq = rows.map((r:any)=>r.arcType);
  let ok=true;
  rows.forEach((r:any,i:number)=>{
    const recent = seq.slice(Math.max(0,i-3), i);
    const isComfort = COMFORT.has(r.arcType);
    const consecComfort = isComfort && recent.filter((a:string)=>COMFORT.has(a)).length>=2;
    const isRepeat = !isComfort && recent.includes(r.arcType);
    const validArc = VALID.has(r.arcType);
    const hasSyn = !!r.synopsis;
    const status = (!validArc?"BADARC ":"")+(consecComfort?"COMFORTx3 ":"")+(isRepeat?"REPEAT ":"")+(!hasSyn?"NOSYN ":"");
    if(status) ok=false;
    console.log(`${String(i+1).padStart(2)} ${r.arcType.padEnd(24)} syn:${hasSyn?"✓":"✗"} ${status||"ok"}  ${r.slug}`);
  });
  console.log(ok?"\nROTATION + SYNOPSIS: ALL OK":"\nISSUES FOUND");
})().finally(()=>p.$disconnect());
