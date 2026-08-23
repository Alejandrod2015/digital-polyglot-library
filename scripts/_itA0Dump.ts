import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
async function run(){
const js = await prisma.journey.findMany({ where: { language: "italian" }, orderBy: { createdAt: "asc" } });
for (const j of js) {
  const n = await prisma.journeyStory.count({ where: { journeyId: j.id } });
  console.log(`${j.id}  ${j.name.padEnd(28)} ${j.variant} ${JSON.stringify(j.levels)} ${j.status.padEnd(9)} type=${j.typeSlug} next=${j.nextJourneyId ?? "-"} stories=${n} spt=${j.storiesPerTopic}`);
  console.log(`   topics: ${JSON.stringify(j.topics)}`);
}
const A0 = "cmss0fkc40007j8dub1zpa1kc";
const st = await prisma.journeyStory.findMany({ where: { journeyId: A0 }, orderBy: [{ topic: "asc" }, { slotIndex: "asc" }] });
console.log(`\n=== A0 stories: ${st.length} ===`);
for (const s of st) {
  const v = (s.vocab as any[]) ?? [];
  console.log(`  ${String(s.slotIndex).padStart(2)} ${String(s.topic).padEnd(18)} ${String(s.title).padEnd(34)} ${s.status} wc=${s.wordCount} vc=${v.length} arc=${s.arcType} cast=${JSON.stringify((s.cast as any)?.characters?.map((c:any)=>c.name) ?? [])}`);
}
await prisma.$disconnect();
}
run();
