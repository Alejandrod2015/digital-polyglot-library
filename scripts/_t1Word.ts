import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { createRequire } from "module"; import * as fs from "fs";
const __req = createRequire(__filename);
try { const q = __req.resolve("server-only"); (__req as any).cache[q] = { id:q, filename:q, loaded:true, exports:{} }; } catch {}
const lema=(w:string)=>w.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").trim();
const duro=new Set(fs.readFileSync("/tmp/t1-duro.txt","utf8").split("\n"));
const libres=new Set(fs.readFileSync("/tmp/t1-libres.txt","utf8").split("\n"));
(async()=>{
  const { filterSpanishWordsAtOrBelow } = await import("@/lib/cefr/spanishLevelJudge");
  const ws = process.argv.slice(2);
  const { aboveLevel } = await filterSpanishWordsAtOrBelow(ws, "a2");
  const alto=new Set((aboveLevel as any[]).map(a=>a.word));
  for (const w of ws){ const l=lema(w); const t:string[]=[];
    if(duro.has(l))t.push("BLOQUEADA");
    if(alto.has(w))t.push("FUERA-DE-NIVEL");
    if(!t.length)t.push(libres.has(l)?"libre":"ok(blando)");
    console.log(`${w.padEnd(20)} ${t.join(" · ")}`);}
})();
