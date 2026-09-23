import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p=new PrismaClient();
const isDef=(s:string)=>/^[A-Z]/.test(s)&&/[.;]/.test(s);
const syl=(w:string)=>(w.toLowerCase().match(/[aeiouáéíóúàèìòùâêîôûäöüãõ]+/g)||[]).length;
(async()=>{
  const ex=await p.storyPracticeExercise.findMany({
    where:{set:{story:{journey:{status:"active"}}}},
    select:{id:true,setId:true,type:true,word:true,sentence:true,payload:true,
      set:{select:{story:{select:{journey:{select:{id:true,name:true,language:true,levels:true,variant:true}}}}}}}
  });
  type R={n:number,mic:number,defOnly:number,longest:number,padded:number,fixedPool:number,fb:number,fbGram:number,lc:number,lcSyl:number,cognate:number};
  const J:Record<string,R>={}; const label:Record<string,string>={};
  const distFreq:Record<string,Record<string,number>>={};
  for(const e of ex){
    const j=e.set.story.journey; const k=j.id; label[k]=`${j.language} ${JSON.parse(JSON.stringify(j.levels))[0]} ${j.variant} ${j.name}`;
    const r=J[k]??=({n:0,mic:0,defOnly:0,longest:0,padded:0,fixedPool:0,fb:0,fbGram:0,lc:0,lcSyl:0,cognate:0});
    r.n++;
    const pl:any=e.payload; const opts:string[]=pl.options||[]; const ans:string=pl.answer||"";
    if(!opts.length) continue;
    const dis=opts.filter(o=>o!==ans);
    if(e.type==="meaning_in_context"){
      r.mic++;
      if(isDef(ans)&&!dis.some(isDef)) r.defOnly++;
      const L=ans.length, mx=Math.max(...dis.map(d=>d.length)); if(L>=mx*1.5 && L-mx>=6) r.longest++;
      if(opts.some(o=>/today today/.test(o))) r.padded++;
      const f=distFreq[e.setId]??={}; for(const d of dis) f[d]=(f[d]||0)+1;
      // cognate: answer's first 4 letters equal word's first 4 letters (after stripping article/to)
      const a=ans.replace(/^(a|an|the|to)\s+/,"").toLowerCase().slice(0,4); const w=e.word.replace(/^(el|la|le|les|der|die|das|il|lo|o|a)\s+/,"").toLowerCase().slice(0,4);
      if(a.length===4&&a===w&&!dis.some(d=>d.replace(/^(a|an|the|to)\s+/,"").toLowerCase().slice(0,4)===a)) r.cognate++;
    }
    if(e.type==="fill_blank"){
      r.fb++;
      const tail=(s:string)=>s.slice(-2);
      if(dis.every(d=>tail(d)!==tail(ans))) r.fbGram++;
    }
    if(e.type==="listen_choose"){
      r.lc++;
      const s=syl(ans); if(dis.every(d=>Math.abs(syl(d)-s)>=1)) r.lcSyl++;
    }
  }
  // fixed pool: per set, a distractor string reused in >=3 exercises
  const setJ:Record<string,string>={}; for(const e of ex) setJ[e.setId]=e.set.story.journey.id;
  for(const [sid,f] of Object.entries(distFreq)){ const reused=Object.values(f).filter(c=>c>=3).length; if(reused>0) J[setJ[sid]].fixedPool++; }
  const rows=Object.entries(J).sort((a,b)=>label[a[0]].localeCompare(label[b[0]]));
  console.log("| journey | n | mic | defOnly | longest | padded | cognate | fb | fbGram | lc | lcSyl | setsFixedPool |");
  console.log("|---|---|---|---|---|---|---|---|---|---|---|---|");
  const T:any={n:0,mic:0,defOnly:0,longest:0,padded:0,cognate:0,fb:0,fbGram:0,lc:0,lcSyl:0,fixedPool:0};
  for(const [k,r] of rows){ for(const q in T) T[q]+=(r as any)[q];
    console.log(`| ${label[k]} | ${r.n} | ${r.mic} | ${r.defOnly} | ${r.longest} | ${r.padded} | ${r.cognate} | ${r.fb} | ${r.fbGram} | ${r.lc} | ${r.lcSyl} | ${r.fixedPool} |`); }
  console.log(`| TOTAL | ${T.n} | ${T.mic} | ${T.defOnly} | ${T.longest} | ${T.padded} | ${T.cognate} | ${T.fb} | ${T.fbGram} | ${T.lc} | ${T.lcSyl} | ${T.fixedPool} |`);
})().finally(()=>p.$disconnect());
