import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const ID = "cmt09ehi60000320qf9efrypu";
(async () => {
  const j = await p.journey.findUnique({ where: { id: ID }, select: { topics: true } });
  const order = j?.topics ?? [];
  const st = (await p.journeyStory.findMany({ where: { journeyId: ID }, select: { slug: true, title: true, topic: true, slotIndex: true, text: true, vocab: true } }))
    .sort((a,b)=> (order.indexOf(a.topic)-order.indexOf(b.topic)) || (a.slotIndex-b.slotIndex));
  const from = Number(process.argv[2] ?? 1), to = Number(process.argv[3] ?? 21);
  st.slice(from-1, to).forEach((s,i)=>{
    console.log(`\n===== [${from+i}] ${s.slug} · ${s.title}`);
    console.log("VOCAB: " + ((s.vocab as any[])??[]).map(v=>`${v.word}=${v.translation ?? v.definition ?? ""}`).join(" | "));
    console.log("---\n" + s.text);
  });
  await p.$disconnect();
})();
