/**
 * Quita ejercicios de práctica huérfanos: los que enseñan una palabra que ya
 * no cubre el vocab (reducido) de la historia. Re-balancea featured=10
 * (promueve pool si un featured se cae). Valida con validateSet antes de
 * escribir. NO toca match_meaning (el validador lo considera cubierto por la
 * leniencia de artículo). Usage: tsx scripts/_cleanOrphans.ts [--apply]
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import * as fs from "fs";
import { validateSet } from "./_validateSets";
const prisma = new PrismaClient();
const norm=(s:string)=>(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").trim();
const ft=(s:string)=>norm(s).split(/\s+/)[0]??"";
const covers=(target:string, entry:string)=>{ const [w,sf]=entry.split("||"); const a=norm(target),b=norm(w);
  if(a===b) return true; if(sf&&a===norm(sf)) return true;
  const ta=ft(a),tb=ft(b); let L=0; while(L<ta.length&&L<tb.length&&ta[L]===tb[L])L++;
  return L>=Math.max(3,Math.min(ta.length,tb.length)-3); };
(async () => {
  const apply = process.argv.includes("--apply");
  for (const f of fs.readdirSync("scripts/_sets").filter(f=>f.endsWith(".json"))){
    const slug=f.replace(".json","");
    const story=await prisma.journeyStory.findFirst({where:{slug,journeyId:"cmr92f0qz000032ff1dfd4fgx"},select:{vocab:true}}) as any;
    if(!story) continue;
    const entries=(story.vocab as any[]).map((v:any)=>v.surface&&v.surface!=="undefined"?`${v.word}||${v.surface}`:v.word);
    const covered=(t:string)=>entries.some((e:string)=>covers(t,e));
    const path=`scripts/_sets/${f}`;
    const exs:any[]=JSON.parse(fs.readFileSync(path,"utf8"));
    const removed:string[]=[];
    let kept=exs.filter((e:any)=>{
      if(e.type==="match_meaning") return true; // no tocar match
      if(!covered(e.word)){ removed.push(e.word); return false; }
      return true;
    });
    if(!removed.length) continue;
    // re-balancear featured=10: los primeros 10 (por orden) van featured, resto pool
    kept.forEach((e:any,i:number)=>{ if(e.type==="match_meaning") return; });
    let feat=0;
    for(const e of kept){ if(feat<10 && e.type!=="match_meaning"){ delete e.featured; feat++; } else if(e.type!=="match_meaning"){ e.featured=false; } }
    // el match cuenta como featured en el validador? featured!==false => sí. Ajuste: contar todos
    const featuredTarget=Math.min(10, kept.length);
    let fc=kept.filter((e:any)=>e.featured!==false).length;
    // si el match empuja el conteo, re-normalizar: exactamente featuredTarget con featured!==false
    let idx=0; fc=0;
    for(const e of kept){ if(fc<featuredTarget){ if(e.type!=="match_meaning") delete e.featured; fc++; } else { if(e.type!=="match_meaning") e.featured=false; } }
    const vocabList=entries;
    const issues=validateSet(kept, vocabList);
    const status=issues.length?`✗ ${issues.join("; ").slice(0,120)}`:"✓ válido";
    console.log(`${slug}: quita [${removed.join(", ")}] -> ${kept.length} ex, featured ${kept.filter((e:any)=>e.featured!==false).length}  ${status}`);
    if(!issues.length && apply){ fs.writeFileSync(path, JSON.stringify(kept,null,1)+"\n"); }
  }
})().finally(() => prisma.$disconnect());
