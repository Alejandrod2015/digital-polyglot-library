import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
const KEY = process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_API_KEY || "";
const J = "cmqfnp3tf000032afygkqp8z2";
(async () => {
  const stories = await prisma.journeyStory.findMany({ where: { journeyId: J }, select: { slug: true, dialogueSpec: true } });
  const voices = new Map<string, { speakers: Set<string>; n: number }>();
  for (const s of stories) {
    const spec:any[] = Array.isArray(s.dialogueSpec)?(s.dialogueSpec as any):[];
    for (const seg of spec) { if(!seg?.voice) continue; if(!voices.has(seg.voice)) voices.set(seg.voice,{speakers:new Set(),n:0}); const v=voices.get(seg.voice)!; v.speakers.add(seg.speaker||"?"); v.n++; }
  }
  console.log(`${voices.size} voiceIds distintos en el A1 alemán:\n`);
  for (const [id, info] of voices) {
    let status="?", name="";
    if (KEY) { try { const r=await fetch(`https://api.elevenlabs.io/v1/voices/${id}`,{headers:{"xi-api-key":KEY}}); status=String(r.status); if(r.ok){const j:any=await r.json(); name=j?.name||"";} } catch(e:any){status="ERR";} }
    console.log(`  ${status==="200"?"OK ":"!! "} ${id}  [${status}] ${name.padEnd(26)} speakers=${[...info.speakers].join("/")}  (${info.n} segs)`);
  }
  await prisma.$disconnect();
})().catch(e=>{console.log("FATAL",e.message);process.exit(1);});
