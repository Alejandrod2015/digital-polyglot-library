import { config } from "dotenv";
config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
(async () => {
  const s = await prisma.journeyStory.findFirst({ where: { slug: process.argv[2] }, select: { id: true } });
  const { generateWordTimingsForStory } = await import("../src/lib/audioWordTimings");
  await generateWordTimingsForStory(s!.id);
  console.log("re-alineado");
  await prisma.$disconnect();
})();
