import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
async function run() {
  const s = await prisma.journeyStory.findFirst({
    where: { journeyId: "cmqc6tojm000032el2ebwsgkn", slug: process.argv[2] ?? "todas-se-parecen" },
    select: { slug: true, dialogueSpec: true, cast: true, audioSegments: true },
  });
  console.log(JSON.stringify(s?.dialogueSpec, null, 2).slice(0, 2500));
  await prisma.$disconnect();
}
run().catch(async (e) => { console.error(e); await prisma.$disconnect(); });
