import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
const J = "cmovi4cvi000032q37a4823h3";
(async () => {
  const stories = await prisma.journeyStory.findMany({
    where: { journeyId: J }, select: { id: true, slug: true, level: true,
      practiceSet: { select: { locked: true, exercises: { select: { orderIndex: true, type: true, word: true, sentence: true, audioUrl: true, payload: true, featured: true }, orderBy: { orderIndex: "asc" } } } } },
    orderBy: [{ level: "asc" }, { topic: "asc" }, { slotIndex: "asc" }],
  });
  const withSet = stories.filter(s => s.practiceSet);
  console.log(`${stories.length} historias | ${withSet.length} con practiceSet\n`);
  // type distribution + audio coverage
  const typeCount: Record<string, number> = {}; let total = 0, withAudio = 0, featured = 0;
  for (const s of withSet) for (const e of s.practiceSet!.exercises) { typeCount[e.type] = (typeCount[e.type]||0)+1; total++; if (e.audioUrl) withAudio++; if (e.featured) featured++; }
  console.log("Tipos:", JSON.stringify(typeCount));
  console.log(`Total ejercicios: ${total} | con audioUrl pre-render: ${withAudio} | featured: ${featured}\n`);
  // dump 2 stories fully
  for (const s of withSet.filter(x => ["sin-cumbia-no-hay-fiesta","la-promesa-del-mole"].includes(x.slug||""))) {
    console.log(`\n##### ${s.slug} (${s.level}) locked=${s.practiceSet!.locked}`);
    for (const e of s.practiceSet!.exercises) {
      const p: any = e.payload;
      console.log(` [${e.orderIndex}] ${e.type}  word="${e.word}"  audio=${e.audioUrl?"Y":"-"}`);
      console.log(`     sentence: ${e.sentence}`);
      if (p?.options) console.log(`     options: ${JSON.stringify(p.options)}  answer=${p.answer}`);
      else if (p?.pairs) console.log(`     pairs: ${JSON.stringify(p.pairs)} extras=${JSON.stringify(p.extras)}`);
      else console.log(`     payload: ${JSON.stringify(p).slice(0,160)}`);
    }
  }
  await prisma.$disconnect();
})().catch(e => { console.log("FATAL", e.message); process.exit(1); });
