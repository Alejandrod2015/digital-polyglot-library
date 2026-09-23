import "./_loadEnv";
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async()=>{
  const js:any[] = await p.journey.findMany({ where:{ language:"spanish" }, select:{ id:true, name:true, variant:true, status:true } });
  const mex = js.filter(j => (j.variant ?? "").toLowerCase().includes("mex"));
  for (const j of mex) {
    const ss:any[] = await p.journeyStory.findMany({ where:{ journeyId:j.id }, select:{ slug:true, level:true, coverDone:true, coverUrl:true, audioUrl:true } });
    const niveles = [...new Set(ss.map(s=>s.level))].join(",");
    console.log(`${j.id} · ${j.name} · ${j.variant} · ${j.status} · ${niveles} · ${ss.length} historias`);
    console.log(`   portadas: ${ss.filter(s=>s.coverUrl).length}/${ss.length} con coverUrl · ${ss.filter(s=>s.coverDone).length} con coverDone · audio: ${ss.filter(s=>s.audioUrl).length}`);
  }
  if (!mex.length) console.log("ningun journey con variant mexico");
  await p.$disconnect();
})();
