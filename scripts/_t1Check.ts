import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { createRequire } from "module"; import * as fs from "fs";
const __req = createRequire(__filename);
try { const q = __req.resolve("server-only"); (__req as any).cache[q] = { id:q, filename:q, loaded:true, exports:{} }; } catch {}
const lema=(w:string)=>w.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").trim();
const duro=new Set(fs.readFileSync("/tmp/t1-duro.txt","utf8").split("\n"));
const libres=new Set(fs.readFileSync("/tmp/t1-libres.txt","utf8").split("\n"));
(async()=>{
  const { renderedParagraphs, splitSentences } = await import("@/lib/readerParagraphs");
  const { filterSpanishWordsAtOrBelow } = await import("@/lib/cefr/spanishLevelJudge");
  const data=JSON.parse(fs.readFileSync(process.argv[2],"utf8"));
  const vistos=new Map<string,string>();
  for(const d of data){
    const w=d.text.trim().split(/\s+/).length;
    const q=[...d.text.matchAll(/“([^”]*)”/g)].reduce((a,m)=>a+m[1].trim().split(/\s+/).length,0);
    const bl=renderedParagraphs(d.text);
    const per=bl.map((b:string)=>d.vocab.filter((v:any)=>b.includes(v.surface??v.word)).length);
    const anc=d.vocab.filter((v:any)=>v.anchor).length;
    console.log(`\n#${d.slotIndex} "${d.title}"`);
    console.log(`  ${w}w (180-320, banda 220-280) · ${splitSentences(d.text).length} or · ${bl.length} bloques · citado ${(100*q/w).toFixed(1)}% (25-35)`);
    console.log(`  vocab ${d.vocab.length} = ${d.vocab.length-anc} portables + ${anc} ancladas · por bloque [${per.join(", ")}] max ${(100*Math.max(...per)/d.vocab.length).toFixed(0)}% (<=30)`);
    const bad:string[]=[];
    const freq=d.vocab.filter((v:any)=>v.type!=="expression"&&!["slang","colloquial","vulgar","cultural","realia"].includes((v.register??"").toLowerCase())).map((v:any)=>v.word);
    const {aboveLevel}=await filterSpanishWordsAtOrBelow(freq,"a2");
    const alto=new Set((aboveLevel as any[]).map(a=>a.word));
    let soft=0;
    for(const v of d.vocab){ const l=lema(v.word); const s=v.surface??v.word;
      if(duro.has(l)) bad.push(`${v.word}: BLOQUEADA`);
      if(alto.has(v.word)) bad.push(`${v.word}: fuera de A2`);
      if(!duro.has(l)&&!libres.has(l)) soft++;
      if(vistos.has(l)) bad.push(`${v.word}: ya en ${vistos.get(l)}`); else vistos.set(l,`#${d.slotIndex}`);
      if(!d.text.includes(s)) bad.push(`${v.word}: surface "${s}" fuera del cuerpo`);
      const dw=v.definition.trim().split(/\s+/).length;
      if(dw<8||dw>14) bad.push(`${v.word}: definicion ${dw}w`);
    }
    if(soft>2) bad.push(`${soft} de otros journeys (tope 2)`);
    const sw=d.synopsis.trim().split(/\s+/).length;
    if(sw<45||sw>90) bad.push(`sinopsis ${sw}w`);
    console.log(bad.length? "  PROBLEMAS:\n   - "+bad.join("\n   - ") : "  sin problemas de vocab/superficie");
  }
})();
