import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  for (const t of process.argv.slice(2)) {
    const st = await p.journeyStory.findMany({ where: { topic: t, journey: { language: "spanish", status: { not: "archived" } } },
      select: { title: true, vocab: true, journey: { select: { name: true, variant: true, levels: true } } } });
    console.log(`\n### ${t}`);
    for (const s of st) console.log(`  [${s.journey.name}/${s.journey.variant}${JSON.stringify(s.journey.levels)}] ${s.title}: ${((s.vocab as any[])??[]).map((v)=>v.word).join(", ")}`);
  }
  await p.$disconnect();
})();
