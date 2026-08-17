// Pasa el check nuevo por TODAS las historias A0 publicadas, para ver a quién
// tumba antes de dejarlo puesto. Solo lee.
import { config } from "dotenv"; config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async()=>{
  const js = await p.journey.findMany({ where:{ status:{ notIn:["archived","draft"] }, levels:{ has:"a0" } }, select:{ id:true, name:true, language:true, variant:true } });
  for (const j of js) {
    const st = await p.journeyStory.findMany({ where:{ journeyId:j.id, status:"published" }, select:{ title:true, text:true } });
    let fallan = 0; const ejemplos: string[] = [];
    for (const s of st) {
      const frases = (s.text ?? "").split(/(?<=[.!?])\s+/).map(f=>f.trim().split(/\s+/).filter(Boolean).length).filter(n=>n>0);
      if (frases.length < 5) continue;
      const ord=[...frases].sort((a,b)=>a-b); const mediana=ord[Math.floor(ord.length/2)];
      const largas=frases.filter(n=>n>22).length;
      if (mediana>14||largas>0){ fallan++; if(ejemplos.length<2) ejemplos.push(`${s.title} (mediana ${mediana}${largas?`, ${largas} >22p`:""})`); }
    }
    console.log(`${(j.language+"/"+j.variant).padEnd(20)} ${j.name.padEnd(10)} fallan ${String(fallan).padStart(2)}/${st.length}${ejemplos.length?"  ej: "+ejemplos.join(" · "):""}`);
  }
})().finally(()=>p.$disconnect());
