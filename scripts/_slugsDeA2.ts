import "./_loadEnv";
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async()=>{
  const ss = await p.journeyStory.findMany({ where:{ journeyId:'cmubidgaf0007j8np6g7n89iu' }, select:{ slug:true, title:true, audioUrl:true } });
  for (const s of ss) console.log(`${s.slug}\t${s.title}\t${s.audioUrl?'narrada':'-'}`);
  const sets = await p.tapGlossSet.findMany({ where:{ bundle:'german-friends-a2' }, select:{ slug:true } });
  const slugsHist = new Set(ss.map(s=>s.slug));
  const huerfanas = sets.filter(x=>x.slug && !slugsHist.has(x.slug)).map(x=>x.slug);
  console.log(`\nfilas de glosas: ${sets.length} · huerfanas (slug sin historia): ${huerfanas.length}${huerfanas.length?' -> '+huerfanas.join(', '):''}`);
  await p.$disconnect();
})();
