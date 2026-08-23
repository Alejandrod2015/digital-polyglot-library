/** La curva: vocabulario NUEVO por historia y peso de la capa portable. */
import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
const PORT=new Set(["verb","adjective","adverb","expression"]);
async function run(){
  const id="cmt5wqsf7000032ghesowd0jy";
  const j=await prisma.journey.findUnique({where:{id},select:{topics:true}});
  const rows=(await prisma.journeyStory.findMany({where:{journeyId:id},select:{topic:true,slotIndex:true,vocab:true}}))
    .sort((a,b)=>(j!.topics.indexOf(a.topic)-j!.topics.indexOf(b.topic))||(a.slotIndex-b.slotIndex));
  const visto=new Set<string>(); const nuevas:number[]=[]; const port:number[]=[];
  rows.forEach(r=>{
    const v=(r.vocab as any[])??[]; let n=0,p=0;
    for(const x of v){ const w=String(x.word).toLowerCase(); if(!visto.has(w)){n++;visto.add(w);} if(PORT.has(String(x.type).toLowerCase()))p++; }
    nuevas.push(n); port.push(p);
  });
  const t=(a:number[],i:number,j2:number)=>a.slice(i,j2).reduce((x,y)=>x+y,0);
  console.log("nuevas por historia:", nuevas.join(" "));
  console.log(`nuevas 1-15 ${t(nuevas,0,15)} · 16-21 ${t(nuevas,15,21)}`);
  console.log("portables por historia:", port.join(" "));
  // Lo que pide la curva: en la cola no entra ninguna portable NUEVA.
  const antes=new Set<string>();
  rows.slice(0,15).forEach(r=>((r.vocab as any[])??[]).forEach((v:any)=>antes.add(String(v.word).toLowerCase())));
  const nuevasPort = rows.slice(15).flatMap(r=>((r.vocab as any[])??[])
    .filter((v:any)=>PORT.has(String(v.type).toLowerCase()) && !antes.has(String(v.word).toLowerCase()))
    .map((v:any)=>String(v.word)));
  console.log(`portables NUEVAS en la cola 16-21: ${nuevasPort.length}${nuevasPort.length?" -> "+nuevasPort.join(" "):""}`);
  const recicladas = rows.slice(15).flatMap(r=>((r.vocab as any[])??[])
    .filter((v:any)=>antes.has(String(v.word).toLowerCase()))).length;
  console.log(`plazas de la cola que RECICLAN lo visto antes: ${recicladas}`);
  await prisma.$disconnect();
}
run();
