// Devuelve una historia a un máster de audio anterior. No genera nada:
// solo apunta audioUrl al fichero que ya existe en R2 y re-alinea el karaoke.
//   npx tsx scripts/_revertMaster.ts <slug> <nombreDelFichero.mp3>
import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import Module from "module";
const orig = (Module as unknown as { _load:(...a:unknown[])=>unknown })._load;
(Module as unknown as { _load:(...a:unknown[])=>unknown })._load = function(r:string,...rest:unknown[]){ if(r==="server-only") return {}; return orig.call(this,r,...rest); } as typeof orig;
const BASE = "https://pub-ef067ab826f24d8fbe43b2ac2469bd3a.r2.dev/media/generated/audio/";
(async()=>{
  const [slug, fichero] = [process.argv[2], process.argv[3]];
  if (!slug || !fichero) throw new Error("uso: _revertMaster.ts <slug> <fichero.mp3>");
  const url = BASE + fichero;
  const head = await fetch(url, { method: "GET", headers: { Range: "bytes=0-1" } });
  if (!head.ok) throw new Error(`el máster no existe: ${head.status}`);
  const { PrismaClient, Prisma } = await import("../src/generated/prisma");
  const { generateWordTimingsForStory } = await import("../src/lib/audioWordTimings");
  const p = new PrismaClient();
  const s = await p.journeyStory.findFirst({ where:{ slug }, select:{ id:true, audioUrl:true } });
  if (!s) throw new Error("historia no encontrada");
  console.log(`${slug}\n  actual : ${s.audioUrl?.split("/").pop()}\n  vuelve : ${fichero}`);
  await p.journeyStory.update({
    where:{ id:s.id },
    data:{ audioUrl:url, audioFilename:fichero, audioStatus:"ready", audioWordTimings: Prisma.DbNull },
  });
  await generateWordTimingsForStory(s.id);
  console.log("  timings re-alineados");
  await p.$disconnect();
})().catch(e=>{console.error("FALLÓ:", e instanceof Error?e.message:e); process.exit(1);});
