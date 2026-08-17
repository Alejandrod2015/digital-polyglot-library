import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();

async function run() {
  const rows = await prisma.journeyStory.findMany({
    select: { slug: true, journeyId: true, level: true, vocab: true },
  });
  const byValue = new Map<string, { count: number; words: Set<string> }>();
  let items = 0;
  for (const r of rows) {
    for (const v of (r.vocab as { word?: string; register?: string }[] | null) ?? []) {
      items++;
      const reg = (v.register ?? "").trim().toLowerCase();
      if (!reg) continue;
      if (!byValue.has(reg)) byValue.set(reg, { count: 0, words: new Set() });
      const e = byValue.get(reg)!;
      e.count++;
      e.words.add(v.word ?? "?");
    }
  }
  console.log(`items de vocab en toda la base: ${items}\n`);
  for (const [reg, e] of [...byValue].sort((a, b) => b[1].count - a[1].count)) {
    console.log(`register="${reg}"  ${e.count} items  ${e.words.size} palabras distintas`);
    console.log(`   ${[...e.words].slice(0, 40).join(", ")}${e.words.size > 40 ? " …" : ""}\n`);
  }
  await prisma.$disconnect();
}
run().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
