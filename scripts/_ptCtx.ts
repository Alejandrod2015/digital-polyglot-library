import { config } from "dotenv"; config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async()=>{
  const J="cmsou2uk0000732mqa4oatcmn";
  const st = await p.journeyStory.findMany({ where:{ journeyId:J }, select:{ topic:true, slotIndex:true, title:true, text:true, status:true }, orderBy:[{topic:"asc"},{slotIndex:"asc"}] });
  console.log("TÍTULOS EXISTENTES:", st.map(s=>s.title).filter(Boolean).join(" | "));
  const nombres = new Set<string>();
  for (const s of st) for (const m of (s.text??"").matchAll(/\b([A-ZÁÉÍÓÚÂÊÔÃÕ][a-záéíóúâêôãõç]{2,})\b/g)) nombres.add(m[1]);
  console.log("\nPALABRAS CAPITALIZADAS (nombres+lugares a evitar/reusar):", [...nombres].sort().join(", "));
  console.log("\nSLOTS meeting-people:");
  for (const s of st.filter(x=>x.topic==="meeting-people")) console.log(`  slot ${s.slotIndex} · ${s.status} · ${s.title}`);
})().finally(()=>p.$disconnect());
