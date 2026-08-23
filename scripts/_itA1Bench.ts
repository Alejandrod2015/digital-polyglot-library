import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
async function run(){
const js = await prisma.journey.findMany({ where: { status: { not: "archived" } }, select: { id:true,name:true,language:true,variant:true,levels:true,topics:true } });
for (const j of js) {
  const filas = (await prisma.journeyStory.findMany({ where: { journeyId: j.id }, select: { text:true, vocab:true, topic:true, slotIndex:true } }))
    .filter(f=>f.text?.trim());
  if (filas.length < 7) continue;
  const tok=(t:string)=>(t.toLowerCase().match(/\p{L}+/gu)??[]);
  const cuerpos=filas.map(f=>new Set(tok(f.text!)));
  const clave=(v:any)=>String(v.surface??v.word).toLowerCase().replace(/^(der|die|das|le|la|el|il|o|a)\s+/,"");
  const enc:number[]=[]; const palabras=new Map<string,number>(); let slots=0;
  let propias=0;
  for (const f of filas) for (const v of ((f.vocab as any[])??[])) {
    slots++; palabras.set(String(v.word),(palabras.get(String(v.word))??0)+1);
    const k=clave(v); const n=cuerpos.filter(c=>c.has(k)).length; enc.push(n);
    if (n>=1) propias++;
  }
  const media=enc.reduce((a,b)=>a+b,0)/(enc.length||1);
  const reensenadas=[...palabras.values()].filter(n=>n>1).reduce((a,b)=>a+b-1,0);
  const wc = filas.reduce((a,f)=>a+f.text!.trim().split(/\s+/).length,0)/filas.length;
  console.log(`${media.toFixed(2)}  ${String(j.name).padEnd(12)} ${j.language}/${j.variant} ${JSON.stringify(j.levels).padEnd(8)} hist=${String(filas.length).padStart(2)} slots=${slots} distintas=${palabras.size} reensenadas=${reensenadas} palabras/hist=${wc.toFixed(0)}`);
}
await prisma.$disconnect();
}
run();
