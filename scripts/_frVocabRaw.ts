import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const s = await p.journeyStory.findFirst({ where: { slug: process.argv[2] }, select: { vocab: true } });
  console.log(JSON.stringify((s!.vocab as any[]).slice(0, 3), null, 1));
  const t = await p.journeyStory.findFirst({ where: { slug: process.argv[3] ?? process.argv[2] }, select: { vocab: true } });
  console.log(JSON.stringify((t!.vocab as any[]).slice(-4), null, 1));
  await p.$disconnect();
})();
