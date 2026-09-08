import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
import { writeFileSync } from "fs";
const prisma = new PrismaClient();
(async () => {
  const s = await prisma.journeyStory.findFirst({ where: { slug: process.argv[2] }, select: { audioUrl: true } });
  writeFileSync(process.argv[3], Buffer.from(await (await fetch(s!.audioUrl!)).arrayBuffer()));
  console.log(s!.audioUrl);
  await prisma.$disconnect();
})();
