import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { PrismaClient } from "../src/generated/prisma";
const p=new PrismaClient();
const KEEP="cmqrtaj1p000032qtda86z6um";              // 24-jun limpia
const ARCHIVE=["cmovi4cvi000032q37a4823h3","cmqp6hal8000032cb4ywfs0gc"]; // 07-may, 22-jun
(async()=>{
  // safety: confirmar que la que conservamos sigue activa antes de tocar
  const keep=await p.journey.findUnique({where:{id:KEEP},select:{status:true}});
  if(keep?.status!=="active"){ console.log("ABORT: la journey a conservar no está active:", JSON.stringify(keep)); return; }
  for(const id of ARCHIVE){
    const before=await p.journey.findUnique({where:{id},select:{status:true}});
    const r=await p.journey.update({where:{id},data:{status:"archived"}});
    console.log(`archived ${id.slice(-6)}: ${before?.status} -> ${r.status}`);
  }
  // verificar estado final del set Traveler latam
  const all=await p.journey.findMany({where:{language:"spanish",variant:"latam",name:"Traveler"},select:{id:true,status:true,createdAt:true},orderBy:{createdAt:"asc"}});
  console.log("\nestado final Traveler latam:");
  for(const j of all) console.log(`  ${j.id.slice(-6)} ${j.createdAt.toISOString().slice(0,10)} -> ${j.status}${j.id===KEEP?"  (KEEP)":""}`);
})().finally(()=>p.$disconnect());
