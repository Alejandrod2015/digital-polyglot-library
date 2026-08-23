import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
const ID = "cmt09ehi60000320qf9efrypu";
(async () => {
  const j = await p.journey.findUnique({ where: { id: ID }, select: { topics: true } });
  const order = j?.topics ?? [];
  const st = (await p.journeyStory.findMany({ where: { journeyId: ID }, select: { slug: true, topic: true, slotIndex: true, vocab: true } }))
    .sort((a,b)=>(order.indexOf(a.topic)-order.indexOf(b.topic))||(a.slotIndex-b.slotIndex));
  st.forEach((s,i) => ((s.vocab as any[])??[]).forEach(v =>
    console.log(`${String(i+1).padStart(2)} ${String(v.word).padEnd(22)} ${String(v.type).padEnd(11)} ${v.anchor?"anc":"   "} ${v.definition}`)));
  await p.$disconnect();
})();
