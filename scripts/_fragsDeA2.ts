import "./_loadEnv";
import * as fs from "fs";
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const J='cmubidgaf0007j8np6g7n89iu';
(async()=>{
  const out:any[] = [];
  const slugs = process.argv.slice(3);
  for (const slug of slugs) {
    const s:any = await p.journeyStory.findFirst({ where:{ journeyId:J, slug } });
    for (const f of (s.audioFragments ?? []) as any[]) {
      if (!f.gateFlags?.length) continue;
      out.push({ id:`${slug}-${f.index}`, slug, historia:s.title, index:f.index,
        texto:f.text, url:f.url, startSec:f.startSec,
        flags:f.gateFlags.map((g:any)=>({kind:g.kind, detail:g.detail, pitchSt:g.pitchSt ?? null})) });
    }
  }
  fs.writeFileSync(process.argv[2], JSON.stringify(out,null,1));
  console.log(`${out.length} fragmentos marcados -> ${process.argv[2]}`);
  await p.$disconnect();
})();
