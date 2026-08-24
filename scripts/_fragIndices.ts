import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  for (const slug of process.argv.slice(2)) {
    const s = await p.journeyStory.findFirst({ where: { slug }, select: { audioFragments: true } });
    const fr = (s?.audioFragments ?? []) as Array<{ index: number; text: string; startSec: number }>;
    console.log(`\n${slug}`);
    for (const f of fr) console.log(`  [${f.index}] ${f.startSec.toFixed(1)}s ${f.text.slice(0, 80)}`);
  }
  await p.$disconnect();
})();
