// ¿Cómo de largas son las frases de cada journey A0? Para calibrar un check
// con datos y no con criterio. Solo lee.
import { config } from "dotenv"; config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async()=>{
  const js = await p.journey.findMany({ where:{ status:{ notIn:["archived","draft"] } }, select:{ id:true, name:true, language:true, variant:true, levels:true } });
  for (const j of js) {
    const st = await p.journeyStory.findMany({ where:{ journeyId:j.id, status:"published" }, select:{ text:true } });
    const largos: number[] = [];
    for (const s of st) for (const o of (s.text ?? "").split(/(?<=[.!?])\s+/)) {
      const n = o.trim().split(/\s+/).filter(Boolean).length;
      if (n > 0) largos.push(n);
    }
    largos.sort((a,b)=>a-b);
    const pct = (q:number) => largos[Math.floor(largos.length*q)] ?? 0;
    const sobre = (n:number) => Math.round((largos.filter(x=>x>n).length/largos.length)*100);
    console.log(
      `${(j.language+"/"+j.variant).padEnd(20)} ${j.levels.join(",").padEnd(4)} ${j.name.padEnd(10)} ` +
      `mediana ${String(pct(0.5)).padStart(2)} · p90 ${String(pct(0.9)).padStart(2)} · máx ${String(largos[largos.length-1]).padStart(2)} · ` +
      `frases >14p: ${String(sobre(14)).padStart(2)}% · >16p: ${String(sobre(16)).padStart(2)}%`
    );
  }
})().finally(()=>p.$disconnect());
