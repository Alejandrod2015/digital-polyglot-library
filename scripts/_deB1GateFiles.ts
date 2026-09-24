/** Los 19 gates de conjunto sobre el texto NUEVO de los ficheros de Codex. Sin escritura. */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { createRequire } from "module";
const __req = createRequire(__filename);
try { const p = __req.resolve("server-only"); (__req as any).cache[p] = { id:p, filename:p, loaded:true, exports:{} }; } catch {}
import * as fs from "fs";
import { PrismaClient } from "../src/generated/prisma";
import { validateJourneyStories } from "@/lib/validateJourneyStories";
const J = "cmufhdbsj0007j8rotoym061z";
const DIR = "/Users/alejandrodelcarpio/digital-polyglot-library/.claude/worktrees/de-b1-friends-texto/scripts/_deB1Friends";
(async () => {
  const p = new PrismaClient();
  const j = await p.journey.findUnique({ where:{id:J}, select:{topics:true,typeSlug:true} });
  const rows: any[] = [];
  for (let i=1;i<=7;i++) for (const s of JSON.parse(fs.readFileSync(`${DIR}/t${i}.json`,"utf8"))) rows.push(s);
  rows.sort((a,b)=> j!.topics.indexOf(a.topic)-j!.topics.indexOf(b.topic) || a.slotIndex-b.slotIndex);
  const reales = (await p.betaSignup.findMany({ select:{firstName:true} })).map(r=>r.firstName).filter(Boolean) as string[];
  const checks = validateJourneyStories(
    rows.map(s=>({ slug:s.slug ?? s.title.toLowerCase().replace(/[^a-z0-9]+/g,"-"), title:s.title, text:s.text,
                   language:"GERMAN", level:"B1", vocab:s.vocab??[], topic:s.topic })),
    { language:"GERMAN", level:"B1", realPeople:reales, conjuntoCompleto:true, journeyId:J, journeyType:j!.typeSlug, plazasDelJourney:21 },
  );
  const ord = { fail:0, "pending-set":1, "not-implemented":2, pass:3 } as any;
  checks.sort((a,b)=>ord[a.status]-ord[b.status]);
  for (const c of checks) console.log(`${c.status.toUpperCase().padEnd(16)} ${c.id.padEnd(38)} ${c.detail?c.detail.slice(0,170):""}`);
  console.log(`\nfail=${checks.filter(c=>c.status==="fail").length} pending-set=${checks.filter(c=>c.status==="pending-set").length} not-impl=${checks.filter(c=>c.status==="not-implemented").length} pass=${checks.filter(c=>c.status==="pass").length}`);
  await p.$disconnect();
})();
