import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const J = "cmufhdbsj0007j8rotoym061z";
(async () => {
  const p = new PrismaClient();
  const ss = await p.journeyStory.findMany({ where:{journeyId:J}, orderBy:[{topic:"asc"},{slotIndex:"asc"}],
    select:{topic:true,slotIndex:true,title:true,text:true,vocab:true,arcType:true,synopsis:true,slug:true,status:true} });
  console.log(`historias: ${ss.length}  con texto: ${ss.filter(s=>s.text && s.text.length>50).length}`);
  for (const s of ss) {
    const paras = (s.text||"").split(/\n{2,}/).filter(x=>x.trim()).length;
    const words = (s.text||"").split(/\s+/).filter(Boolean).length;
    const v = (s.vocab as any[])?.length ?? 0;
    console.log(`${s.topic.slice(0,24).padEnd(24)} ${s.slotIndex}  par=${String(paras).padStart(2)} pal=${String(words).padStart(3)} voc=${String(v).padStart(2)} arc=${String(s.arcType).padEnd(28)} ${s.title}`);
  }
  await p.$disconnect();
})();
