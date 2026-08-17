import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
const J = "cmovi4cvi000032q37a4823h3";
const wc = (t: string) => (t || "").trim().split(/\s+/).filter(Boolean).length;
(async () => {
  const rows = await prisma.journeyStory.findMany({
    where: { journeyId: J, level: "a1" },
    select: { slug: true, title: true, topic: true, slotIndex: true, text: true, vocab: true },
    orderBy: [{ topic: "asc" }, { slotIndex: "asc" }],
  });
  for (const r of rows) {
    const v: any[] = Array.isArray(r.vocab) ? (r.vocab as any) : [];
    const vocabList = v.map((x) => (typeof x === "string" ? x : x.word || x.term || x.es || JSON.stringify(x))).join(" · ");
    console.log(`\n#### [${r.topic} ${r.slotIndex}] ${r.slug} «${r.title}» (${wc(r.text || "")}w, vocab=${v.length})`);
    console.log(`VOCAB: ${vocabList}`);
    console.log(r.text);
  }
  await prisma.$disconnect();
})().catch((e) => { console.log("FATAL", e.message); process.exit(1); });
