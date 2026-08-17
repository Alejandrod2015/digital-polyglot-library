import { config } from "dotenv";
import { PrismaClient } from "../src/generated/prisma";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
(async () => {
  const p = new PrismaClient();
  const J = "cmqc6tojm000032el2ebwsgkn";
  const j = await p.journey.findUnique({ where: { id: J }, select: { topics: true } });
  const st = await p.journeyStory.findMany({ where: { journeyId: J },
    select: { topic:true, slotIndex:true, title:true, slug:true, synopsis:true, text:true, vocab:true, arcType:true } });
  const ord = new Map(j!.topics.map((t,i)=>[t,i]));
  st.sort((a,b)=> (ord.get(a.topic)! - ord.get(b.topic)!) || (a.slotIndex - b.slotIndex));
  require("fs").writeFileSync(process.argv[2], JSON.stringify(st, null, 2));
  console.log("exportadas", st.length);
  await p.$disconnect();
})();
