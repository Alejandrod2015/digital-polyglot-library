/** Mide el journey ENTERO del Friends DE B1 con validateJourneyStories. Sin escritura. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { createRequire } from "module";
const __req = createRequire(__filename);
try { const p = __req.resolve("server-only"); (__req as any).cache[p] = { id:p, filename:p, loaded:true, exports:{} }; } catch {}
import { PrismaClient } from "../src/generated/prisma";
import { validateJourneyStories } from "@/lib/validateJourneyStories";
const J = "cmufhdbsj0007j8rotoym061z";
(async () => {
  const p = new PrismaClient();
  const j = await p.journey.findUnique({ where:{id:J}, select:{topics:true,typeSlug:true} });
  const ss = await p.journeyStory.findMany({ where:{journeyId:J},
    select:{slug:true,title:true,text:true,vocab:true,topic:true,slotIndex:true} });
  const orden = j!.topics;
  ss.sort((a,b)=> orden.indexOf(a.topic!)-orden.indexOf(b.topic!) || a.slotIndex-b.slotIndex);
  const reales = (await p.betaSignup.findMany({ select:{firstName:true} })).map(r=>r.firstName).filter(Boolean) as string[];
  const checks = validateJourneyStories(
    ss.map(s=>({ slug:s.slug!, title:s.title!, text:s.text!, language:"GERMAN", level:"B1",
                 vocab:(s.vocab as any[])??[], topic:s.topic })),
    { language:"GERMAN", level:"B1", realPeople:reales, conjuntoCompleto:true,
      journeyId:J, journeyType:j!.typeSlug, plazasDelJourney:21 },
  );
  const orderStatus = { fail:0, "pending-set":1, "not-implemented":2, pass:3 } as any;
  checks.sort((a,b)=>orderStatus[a.status]-orderStatus[b.status]);
  for (const c of checks) console.log(`${c.status.toUpperCase().padEnd(16)} ${c.id.padEnd(38)} mag=${JSON.stringify((c as any).magnitud)??""} ${c.detail ? c.detail.slice(0,120) : ""}`);
  console.log(`\nfail=${checks.filter(c=>c.status==="fail").length} pending-set=${checks.filter(c=>c.status==="pending-set").length} not-impl=${checks.filter(c=>c.status==="not-implemented").length} pass=${checks.filter(c=>c.status==="pass").length}`);
  await p.$disconnect();
})();
