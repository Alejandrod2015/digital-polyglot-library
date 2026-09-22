/** SOLO MIDE. La cota SUPERIOR: cada plaza que el prefijo da por cubierta y el
 *  estricto no, SIN filtrar la flexion legitima. Sirve para ver cuanto de ese
 *  bulto es ruido y cuanto es el defecto real. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import * as fs from "fs";
import { PrismaClient } from "../../src/generated/prisma";
const DIR = "scripts/_sets"; const p = new PrismaClient();
const norm = (s: string) => (s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").trim();
const ART = /^(der|die|das|den|dem|des|ein|eine|le|la|les|l|el|los|las|il|lo|gli|un|une|o|a|os|as)$/;
const firstTok = (s: string) => { const t = norm(s).split(/\s+/).filter(Boolean); return !t.length ? "" : (t.length>1 && ART.test(t[0]) ? t[t.length-1] : t[0]); };
function loose(t: string, w: string, s?: string) { const a=norm(t), b=norm(w); if(!a||!b) return false; if(a===b) return true; if(s&&a===norm(s)) return true;
  const ta=firstTok(a), tb=firstTok(b); let i=0; while(i<ta.length&&i<tb.length&&ta[i]===tb[i]) i++; return i>=Math.max(3,Math.min(ta.length,tb.length)-3); }
const strict = (t: string, w: string, s?: string) => { const a=norm(t); return a===norm(w)||a===firstTok(w)||(!!s&&a===norm(s)); };
(async () => {
  const ff = fs.readdirSync(DIR).filter(f=>f.endsWith(".json")).sort();
  const rows = await p.journeyStory.findMany({ where: { slug: { in: ff.map(f=>f.replace(".json","")) } },
    select: { slug:true, vocab:true, journey: { select: { status:true } } } });
  const m = new Map(rows.map(r=>[r.slug!, r]));
  let plazas=0, cota=0, sets=new Set<string>();
  for (const f of ff) {
    const slug=f.replace(".json",""); const r=m.get(slug); if(!r||!r.journey) continue;
    if (r.journey.status!=="active" && r.journey.status!=="draft") continue;
    const voc=((r.vocab as any[])??[]).filter(v=>v?.word); if(!voc.length) continue;
    const exs=JSON.parse(fs.readFileSync(`${DIR}/${f}`,"utf8")) as any[];
    const T: string[]=[]; for(const e of exs){ if(e?.type==="match_meaning") for(const pr of e.payload?.pairs??[]) T.push(pr.word); else if(e?.word) T.push(e.word); }
    for (const v of voc) { plazas++;
      if (T.some(t=>strict(t,v.word,v.surface))) continue;
      if (T.some(t=>loose(t,v.word,v.surface))) { cota++; sets.add(slug); } }
  }
  console.log(`plazas medidas: ${plazas}`);
  console.log(`cota superior (prefijo si, estricto no): ${cota} plazas en ${sets.size} sets`);
  await p.$disconnect();
})();
