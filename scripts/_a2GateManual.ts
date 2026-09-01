import { config } from "dotenv"; config({ path: ".env.local", quiet:true }); config({ path: ".env", quiet:true });
import { createRequire } from "module";
const __req = createRequire(__filename);
try { const q = __req.resolve("server-only"); (__req as any).cache[q] = { id:q, filename:q, loaded:true, exports:{} }; } catch {}
import { PrismaClient } from "../src/generated/prisma";
const p=new PrismaClient();
(async()=>{
  const { validateJourneyStories } = await import("@/lib/validateJourneyStories");
  const J="cmtgelq560007j84n3ujx9bpd";
  const j=await p.journey.findUnique({where:{id:J},select:{topics:true}});
  const filas=(await p.journeyStory.findMany({where:{journeyId:J},select:{slug:true,title:true,text:true,vocab:true,topic:true,slotIndex:true}}))
    .filter(f=>String(f.text??"").trim())
    .sort((a,b)=>(j!.topics.indexOf(a.topic)-j!.topics.indexOf(b.topic))||(a.slotIndex-b.slotIndex));
  const real=(await p.betaSignup.findMany({select:{email:true}})).flatMap(b=>String(b.email??"").split("@")[0].split(/[._\-+0-9]+/)).filter(w=>w.length>=3).map(w=>w[0].toUpperCase()+w.slice(1).toLowerCase());
  const todas=filas.map(f=>({slug:f.slug??"?",title:f.title??"",text:String(f.text),vocab:f.vocab as never,language:"ES",level:"a2", topic: f.topic}));
  console.log(`(${todas.length} historias con texto)`);
  for (const c of validateJourneyStories(todas,{language:"ES",level:"a2",realPeople:real}))
    console.log(`  ${c.status==="pass"?"ok  ":c.status==="fail"?"FAIL":"SIN-IMPL"} [${c.id}] ${(c.detail??"").slice(0,150)}`);
})().finally(()=>p.$disconnect());
