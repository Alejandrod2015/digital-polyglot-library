import "./_loadEnv";
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async()=>{
  for (const slug of process.argv.slice(2)) {
    const s:any = await p.journeyStory.findFirst({ where:{ journeyId:'cmubidgaf0007j8np6g7n89iu', slug } });
    const f = ((s.audioFragments ?? []) as any[]).find(x=>x.index===0);
    console.log(slug + "\t" + f.url + "\t" + JSON.stringify(f.text));
  }
  await p.$disconnect();
})();
