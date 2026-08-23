/** La tabla del journey con lo que de verdad se mira por historia. Solo lectura. */
import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
const OPEN="“", CLOSE="”";
const w=(s:string)=>s.trim().split(/\s+/).filter(Boolean).length;
async function run(){
  const id = process.argv[2] ?? "cmt5wqsf7000032ghesowd0jy";
  const base = process.argv[3] ?? "http://localhost:3000/stories";
  const j = await prisma.journey.findUnique({ where: { id }, select: { topics:true } });
  const rows = (await prisma.journeyStory.findMany({ where: { journeyId: id },
    select: { topic:true, slotIndex:true, title:true, slug:true, text:true, vocab:true } }))
    .sort((a,b)=>(j!.topics.indexOf(a.topic)-j!.topics.indexOf(b.topic))||(a.slotIndex-b.slotIndex));
  const tok=(t:string)=>(t.toLowerCase().match(/\p{L}+/gu)??[]) as string[];
  const cuerpos = rows.map(r=>new Set(tok(r.text ?? "")));
  const clave=(v:any)=>String(v.surface??v.word).toLowerCase().replace(/^(der|die|das|le|la|el|il|o|a)\s+/,"");
  const cuenta=(t:string)=>cuerpos.filter(c=>c.has(t)).length;
  console.log("| # | historia | palabras | citada | plazas | escalera | salen 1 vez |");
  console.log("|---|---|---|---|---|---|---|");
  rows.forEach((r,i)=>{
    const t = r.text ?? "";
    let dentro=0;
    for (const m of t.matchAll(new RegExp(`${OPEN}([^${CLOSE}]*)${CLOSE}`,"g"))) dentro += w(m[1]);
    const voc = (r.vocab as any[]) ?? [];
    const enc = voc.map(v=>cuenta(clave(v)));
    const media = enc.length ? enc.reduce((a,b)=>a+b,0)/enc.length : 0;
    console.log(`| ${i+1} | [${r.title}](${base}/${r.slug}) | ${w(t)} | ${Math.round(100*dentro/w(t))}% | ${voc.length} | ${media.toFixed(2).replace(".",",")} | ${enc.filter(n=>n<=1).length} |`);
  });
  await prisma.$disconnect();
}
run();
