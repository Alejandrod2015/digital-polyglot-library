import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  for (const slug of process.argv.slice(2)) {
    const s = await p.journeyStory.findFirst({ where: { slug }, select: { vocab:true, text:true, title:true } });
    console.log(`=== ${slug} (${((s!.vocab as any[])??[]).length} plazas)`);
    for (const v of ((s!.vocab as any[]) ?? [])) console.log(`  ${v.word} [${v.type}] surf=${v.surface} :: ${v.definition}`);
  }
  await p.$disconnect();
})();
