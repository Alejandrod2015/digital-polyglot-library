import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
(async () => {
  const p = new PrismaClient();
  const ids = ["cmu047bkz0007326jsgeptkox","cmu0dqr6y0007j8o52i1s3gf7","cmubidgaf0007j8np6g7n89iu","cmroo4w4v0000324ow1o9qlcp"];
  for (const id of ids) {
    const j = await p.journey.findUnique({ where:{id}, select:{name:true,levels:true,city:true} });
    const ss = await p.journeyStory.findMany({ where:{journeyId:id}, select:{text:true} });
    const txt = ss.map(s=>s.text||"").join("\n");
    const caps = [...txt.matchAll(/\b([A-ZÄÖÜ][a-zäöüß]{2,})\b/g)].map(m=>m[1]);
    const cnt = new Map<string,number>();
    for (const c of caps) cnt.set(c,(cnt.get(c)||0)+1);
    const top = [...cnt.entries()].filter(([,n])=>n>=8).sort((a,b)=>b[1]-a[1]).slice(0,18);
    console.log(`\n${j?.name} ${j?.levels} ${j?.city}: ` + top.map(([w,n])=>`${w}(${n})`).join(" "));
  }
  await p.$disconnect();
})();
