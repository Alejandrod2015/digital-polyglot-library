import "./_loadEnv";
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async()=>{
  const ss:any[] = await p.journeyStory.findMany({ where:{ journeyId:'cmubidgaf0007j8np6g7n89iu', topic:process.argv[2] }, orderBy:{ slotIndex:'asc' } });
  for (const s of ss) console.log(`slot ${s.slotIndex} · ${s.slug} · ${s.title} · ${s.title.length + s.text.length} c${s.audioUrl?' · narrada':''}`);
  const m = ss[0]; const par = m.text.split(/\n\n+/)[0].trim();
  console.log(`\nmuestra (titulo + parrafo 1 de ${m.slug}): ${m.title.length + par.length} c`);
  console.log(`tema entero: ${ss.reduce((a,s)=>a+s.title.length+s.text.length,0)} c`);
  await p.$disconnect();
})();
