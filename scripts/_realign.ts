// Re-alinea los timings de karaoke tras empalmar un fragmento nuevo.
import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import Module from "module";
const orig = (Module as unknown as { _load:(...a:unknown[])=>unknown })._load;
(Module as unknown as { _load:(...a:unknown[])=>unknown })._load = function(r:string,...rest:unknown[]){ if(r==="server-only") return {}; return orig.call(this,r,...rest); } as typeof orig;
(async()=>{
  const { PrismaClient } = await import("../src/generated/prisma");
  const { generateWordTimingsForStory } = await import("../src/lib/audioWordTimings");
  const p = new PrismaClient();
  for (const slug of process.argv.slice(2)) {
    const s = await p.journeyStory.findFirst({ where:{ slug }, select:{ id:true } });
    if (!s) { console.log(`${slug}: no encontrada`); continue; }
    await generateWordTimingsForStory(s.id);
    console.log(`${slug}: timings re-alineados`);
  }
  await p.$disconnect();
})().catch(e=>{console.error("FALLÓ:", e instanceof Error?e.message:e); process.exit(1);});
