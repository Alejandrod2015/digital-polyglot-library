import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const PY = join(process.env.HOME||"", ".cache","dpl-qa","venv","bin","python");
const TMP = "/private/tmp/claude-501/-Users-alejandrodelcarpio-digital-polyglot-library/82ad62b3-5b6d-4b5d-bd8d-fd63cd9908e7/scratchpad/oido";
const run = (c:string,a:string[]) => new Promise<number>(r=>{const x=spawn(c,a,{stdio:"inherit"});x.on("close",v=>r(v??1));});

async function urlDe(id: string): Promise<{url:string;word:string;journey:string}|null> {
  const [journey, slug, word] = id.split("|");
  const s: any = await p.journeyStory.findFirst({ where: { slug },
    select: { practiceSet: { select: { exercises: { select: { word:true, type:true, payload:true } } } } } });
  const e = (s?.practiceSet?.exercises ?? []).find((x:any)=>x.type==="meaning_in_context" && String(x.word).trim()===word);
  const u = e?.payload?.audioClip?.wordClipUrl;
  return u ? { url: u, word, journey } : null;
}

(async () => {
  const aud = JSON.parse(readFileSync("scripts/_auditoria-ciego.json","utf8"));
  const banda = aud.suben.filter((x:any)=>x.slope>10 && x.slope<=20);
  const alta  = aud.suben.filter((x:any)=>x.slope>20);
  const pick = <T,>(a:T[],n:number)=>a.slice().sort(()=>Math.random()-0.5).slice(0,n);
  const sel: any[] = [];
  for (const x of pick(banda,3)) { const u = await urlDe(x.id); if(u) sel.push({...u, grupo:"banda", slope:x.slope, span:x.span}); }
  for (const x of pick(alta,3))  { const u = await urlDe(x.id); if(u) sel.push({...u, grupo:"alta",  slope:x.slope, span:x.span}); }

  // CONTROLES: clips cortos que el gate da por BUENOS. No estaban en la
  // auditoria guardada (solo se guardaron los que suben), asi que se miden aqui.
  const js: any[] = await p.journey.findMany({ where:{status:"active"}, select:{id:true,language:true,variant:true,levels:true} });
  const cand: any[] = [];
  for (const j of js) {
    const st: any[] = await p.journeyStory.findMany({ where:{journeyId:j.id},
      select:{ slug:true, practiceSet:{select:{exercises:{select:{word:true,type:true,payload:true}}}} } });
    for (const s of st) for (const e of (s.practiceSet?.exercises ?? []) as any[]) {
      const u = e.payload?.audioClip?.wordClipUrl; const w = String(e.word).trim();
      if (e.type!=="meaning_in_context" || !u || /\s/.test(w) || w.length>8) continue;
      if (aud.suben.some((x:any)=>x.id.endsWith("|"+w))) continue;
      cand.push({ url:u, word:w, journey:`${j.language}/${j.variant}/${(j.levels??[]).join("")}` });
    }
  }
  const muestra = pick(cand, 40);
  rmSync(TMP,{recursive:true,force:true}); mkdirSync(TMP,{recursive:true});
  const items:any[] = [];
  for (const [k,c] of muestra.entries()) {
    try { const r = await fetch(c.url); if(!r.ok) continue;
      const f = join(TMP,`c${k}.mp3`); writeFileSync(f, Buffer.from(await r.arrayBuffer()));
      items.push({ file:f, id:String(k) }); } catch {}
  }
  writeFileSync(join(TMP,"in.json"), JSON.stringify(items));
  await run(PY,["scripts/_mideLote.py", join(TMP,"in.json"), join(TMP,"out.json")]);
  const med = JSON.parse(readFileSync(join(TMP,"out.json"),"utf8"));
  const ctrl = med.filter((m:any)=>m.medible && m.corta && m.slope < -20).slice(0,3);
  for (const c of ctrl) { const o = muestra[parseInt(c.id,10)]; sel.push({ ...o, grupo:"control", slope:c.slope, span:c.span }); }
  rmSync(TMP,{recursive:true,force:true});

  const barajado = sel.slice().sort(()=>Math.random()-0.5).map((x,i)=>({ n:i+1, ...x }));
  writeFileSync("scripts/_oido-clave.json", JSON.stringify(barajado,null,2));
  console.log(barajado.map(x=>`${x.n}. ${x.word.padEnd(10)} ${x.grupo.padEnd(8)} slope ${String(x.slope).padStart(7)} span ${x.span}`).join("\n"));
  console.log(`\nbanda ${sel.filter(s=>s.grupo==="banda").length} | alta ${sel.filter(s=>s.grupo==="alta").length} | control ${sel.filter(s=>s.grupo==="control").length}`);
  await p.$disconnect();
})();
