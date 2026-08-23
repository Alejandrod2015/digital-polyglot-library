/** Radiografía rápida de un fichero de historias: palabras, % habla citada,
 *  bloques del lector y vocab por bloque y por párrafo. Sin tocar la base. */
import * as fs from "fs";
import { renderedParagraphs } from "../src/lib/readerParagraphs";
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const stories = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
for (const d of stories) {
  const text: string = d.text;
  const total = words(text);
  let inside = 0;
  for (const m of text.matchAll(/“([^”]*)”/g)) inside += words(m[1]);
  const blocks = renderedParagraphs(text);
  const vocab = (d.vocab ?? []) as Array<{ word: string; surface?: string }>;
  const perBlock = blocks.map((b) => vocab.filter((v) => b.includes(v.surface ?? v.word)).length);
  const paras = text.split(/\n\s*\n/);
  const perPara = paras.map((p) => vocab.filter((v) => p.includes(v.surface ?? v.word)).length);
  const cap = Math.max(...perBlock) / vocab.length;
  console.log(`\n### ${d.topic}#${d.slotIndex} ${d.title}`);
  console.log(`  palabras ${total} (115-170) · citada ${((inside/total)*100).toFixed(0)}% (25-35) · vocab ${vocab.length}`);
  console.log(`  bloques ${blocks.length}: [${perBlock.join(", ")}] max ${(cap*100).toFixed(0)}% (<=30) · parrafos [${perPara.join(", ")}] (<=35%)`);
  const falta = vocab.filter((v) => !text.toLowerCase().includes(String(v.surface ?? v.word).toLowerCase()));
  if (falta.length) console.log(`  NO EN CUERPO: ${falta.map((v)=>v.surface??v.word).join(", ")}`);
  const raiz = new Map<string, string[]>();
  for (const v of vocab) { const r = v.word.slice(0,5).toLowerCase(); raiz.set(r, [...(raiz.get(r)??[]), v.word]); }
  const dup = [...raiz].filter(([,w]) => w.length>1);
  if (dup.length) console.log(`  MISMA RAIZ: ${dup.map(([r,w])=>w.join("+")).join("; ")}`);
  const defs = vocab.filter((v:any) => { const n = words(v.definition??""); return n<8||n>14; });
  if (defs.length) console.log(`  DEFS FUERA DE 8-14: ${defs.map((v:any)=>`${v.word}=${words(v.definition)}w`).join(", ")}`);
  if (process.argv.includes("--blocks")) blocks.forEach((b,i)=>console.log(`   [${i+1}|${perBlock[i]}] ${b}`));
}

// --map: que palabra cae en que bloque, para mover a mano.
if (process.argv.includes("--map")) {
  for (const d of stories) {
    const vocab = (d.vocab ?? []) as Array<{ word: string; surface?: string }>;
    console.log(`\n=== ${d.topic}#${d.slotIndex}`);
    const paras = String(d.text).split(/\n\s*\n/);
    paras.forEach((p: string, i: number) => {
      const n = renderedParagraphs(p).length;
      const w = vocab.filter((v) => p.includes(v.surface ?? v.word)).map((v) => v.surface ?? v.word);
      console.log(`  P${i + 1} (${splitCount(p)} oraciones): ${w.length} -> ${w.join(", ")}`);
    });
    renderedParagraphs(String(d.text)).forEach((b: string, i: number) => {
      const w = vocab.filter((v) => b.includes(v.surface ?? v.word)).map((v) => v.surface ?? v.word);
      console.log(`  B${i + 1}: ${w.length} -> ${w.join(", ")}`);
    });
  }
}
function splitCount(p: string): number { return renderedParagraphs(p, 1).length; }
