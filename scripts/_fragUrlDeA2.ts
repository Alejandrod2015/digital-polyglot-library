import "./_loadEnv";
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async()=>{
  const slug = process.argv[2];
  const idx = process.argv.slice(3).map(Number);
  const s:any = await p.journeyStory.findFirst({ where:{ journeyId:'cmubidgaf0007j8np6g7n89iu', slug } });
  for (const f of ((s.audioFragments ?? []) as any[])) {
    if (idx.length && !idx.includes(f.index)) continue;
    console.log(`${f.index}\t${Math.round((f.startSec??0)*10)/10}\t${f.url}\t${JSON.stringify((f.text??'').slice(0,200))}`);
  }
  await p.$disconnect();
})();
