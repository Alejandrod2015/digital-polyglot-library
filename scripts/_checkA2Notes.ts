import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
async function run() {
  const s = await prisma.journeyStory.findFirst({
    where: { journeyId: "cmqc6tojm000032el2ebwsgkn", slug: "esa-nina-soy-yo" },
    select: { slug: true, audioUrl: true, audioStatus: true, audioEditorNote: true },
  });
  console.log(s);
  await prisma.$disconnect();
}
run().catch(async (e) => { console.error(e); await prisma.$disconnect(); });
