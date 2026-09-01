import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { createRequire } from "module"; import * as fs from "fs";
const __req = createRequire(__filename);
try { const q = __req.resolve("server-only"); (__req as any).cache[q] = { id:q, filename:q, loaded:true, exports:{} }; } catch {}
const lema=(w:string)=>w.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").trim();
const duro=new Set(fs.readFileSync("/tmp/t1-duro.txt","utf8").split("\n"));
const libres=new Set(fs.readFileSync("/tmp/t1-libres.txt","utf8").split("\n"));
(async()=>{
  const { filterSpanishWordsAtOrBelow } = await import("@/lib/cefr/spanishLevelJudge");
  const data=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
  const i=Number(process.argv[3]??0); const d=data[i];
  const toks=[...new Set((d.text.toLowerCase().match(/[\p{L}]+/gu)??[]) as string[])].filter(t=>t.length>3);
  const ok=toks.filter(t=>!duro.has(lema(t))&&libres.has(lema(t)));
  const {aboveLevel}=await filterSpanishWordsAtOrBelow(ok,"a2");
  const alto=new Set((aboveLevel as any[]).map(a=>a.word));
  console.log(`#${d.slotIndex} palabras del cuerpo libres y en nivel (${ok.filter(t=>!alto.has(t)).length}):`);
  console.log(ok.filter(t=>!alto.has(t)).join(" "));
})();
