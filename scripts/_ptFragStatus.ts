import { config } from "dotenv"; config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async()=>{
  const st = await p.journeyStory.findMany({
    where:{ journeyId:"cmsou2uk0000732mqa4oatcmn" },
    select:{ slug:true, topic:true, slotIndex:true, audioUrl:true, audioFragments:true },
    orderBy:[{topic:"asc"},{slotIndex:"asc"}],
  });
  let sin=0;
  for (const s of st) {
    const fr = s.audioFragments as unknown[] | null;
    const n = Array.isArray(fr) ? fr.length : 0;
    if (s.audioUrl && n===0) { sin++; console.log(`SIN FRAGMENTOS  ${s.topic}#${s.slotIndex}  ${s.slug}`); }
  }
  console.log(`\n${sin} de ${st.length} historias con audio pero sin fragmentos`);
})().finally(()=>p.$disconnect());
