/** Reparte las glosas que faltan: las que salen de mi vocab y las que hay que escribir. */
import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import * as fs from "fs";
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
const TAPPABLE=/[\p{L}\p{N}][\p{L}\p{N}'\-]*/gu;
const key=(t:string)=>{const m=t.toLowerCase().match(/\p{L}+(?:-\p{L}+)*/u);return m?m[0]:"";};
const NOMBRES=/^(rosa|teo|marta|irene|dario|gaia|nico|martina)$/i;
async function run(){
  const id="cmt5wqsf7000032ghesowd0jy";
  const rows=await prisma.journeyStory.findMany({where:{journeyId:id},select:{title:true,text:true,vocab:true}});
  const toks=new Set<string>();
  for(const r of rows) for(const m of `${r.title} ${r.text}`.matchAll(TAPPABLE)){ const k=key(m[0]); if(k&&!NOMBRES.test(k)) toks.add(k); }
  const cubiertas=new Set<string>();
  for (const f of ["italian-traveler-a0","italian-friends-a0"])
    for (const k of Object.keys(JSON.parse(fs.readFileSync(`src/data/tapGlosses/${f}.json`,"utf8")).glosses)) cubiertas.add(k.toLowerCase());
  // superficie -> definicion del vocab que yo mismo escribi
  const mias=new Map<string,{d:string,t:string}>();
  for(const r of rows) for(const v of ((r.vocab as any[])??[]))
    mias.set(String(v.surface??v.word).toLowerCase(),{d:String(v.definition),t:String(v.type)});
  const faltan=[...toks].filter(t=>!cubiertas.has(t)).sort();
  const conFicha=faltan.filter(t=>mias.has(t));
  const aMano=faltan.filter(t=>!mias.has(t));
  console.log(`faltan ${faltan.length}: ${conFicha.length} tienen ficha de vocab mia · ${aMano.length} a mano`);
  fs.writeFileSync("scripts/_itA1/glosas_conficha.json", JSON.stringify(
    Object.fromEntries(conFicha.map(t=>[t,{def:mias.get(t)!.d,t:mias.get(t)!.t}])),null,1));
  fs.writeFileSync("scripts/_itA1/glosas_amano.json", JSON.stringify(aMano,null,1));
  console.log("\nA MANO:\n"+aMano.join(" "));
  await prisma.$disconnect();
}
run();
