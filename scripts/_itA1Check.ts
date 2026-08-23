/** Clasifica palabras candidatas para el Traveler IT A1. Solo lectura. */
import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import * as fs from "fs";
import { PrismaClient } from "../src/generated/prisma";
import { ITALIAN_A1_A2_LEMMAS } from "../src/lib/cefr/italianA1A2";
const prisma = new PrismaClient();
async function run(){
  const words = fs.readFileSync(process.argv[2], "utf8").split(/[\n,|]+/).map(w=>w.trim()).filter(Boolean);
  const trav="cmss0fkc40007j8dub1zpa1kc", fr="cmrsiz1n40000320d6h8p8f5g";
  const rows = await prisma.journeyStory.findMany({ where: { journey: { language: "italian", status: { not: "archived" } } }, select: { journeyId:true, vocab:true } });
  const A0T=new Set<string>(), A0F=new Set<string>();
  for (const r of rows) for (const v of ((r.vocab as any[])??[])) { if(r.journeyId===trav) A0T.add(String(v.word)); else if(r.journeyId===fr) A0F.add(String(v.word)); }
  const L = ITALIAN_A1_A2_LEMMAS as Set<string>;
  const bad:string[]=[], soft:string[]=[], off:string[]=[], ok:string[]=[], dup=new Map<string,number>();
  for (const w of words) { dup.set(w,(dup.get(w)??0)+1); }
  for (const w of new Set(words)) {
    if (A0T.has(w)) { bad.push(w); continue; }
    if (A0F.has(w)) soft.push(w);
    if (!L.has(w)) off.push(w); else if(!A0F.has(w)) ok.push(w);
  }
  const repes=[...dup].filter(([,n])=>n>1).map(([w,n])=>`${w}x${n}`);
  console.log(`total=${words.length} distintas=${new Set(words).size}`);
  if(repes.length) console.log(`REPETIDAS EN LA LISTA (${repes.length}): ${repes.join(", ")}`);
  console.log(`\nBLOQUEA (ya la ensena el Traveler A0, tolerancia 0) ${bad.length}:\n  ${bad.join(" | ")}`);
  console.log(`\nBLANDA (la ensena Friends A0, tope 2 por historia) ${soft.length}:\n  ${soft.join(" | ")}`);
  console.log(`\nFUERA DE LA LISTA A1A2 (tope 2 por historia, warn) ${off.length}:\n  ${off.join(" | ")}`);
  console.log(`\nLIMPIAS ${ok.length}`);
  await prisma.$disconnect();
}
run();
