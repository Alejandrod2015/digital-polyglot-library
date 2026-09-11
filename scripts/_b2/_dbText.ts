import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../../src/generated/prisma";
const p = new PrismaClient();
(async () => {
  const s = await p.journeyStory.findFirst({ where: { slug: process.argv[2] }, select: { title: true, text: true } });
  console.log(s!.title); console.log(); console.log(s!.text);
  await p.$disconnect();
})();
