import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
const J = "cmovi4cvi000032q37a4823h3";
(async () => {
  const j = await prisma.journey.findUnique({ where: { id: J }, select: { topics: true } });
  console.log("journey.topics order:", j?.topics);
  const firstTopic = j!.topics[0];
  const s = await prisma.journeyStory.findFirst({ where: { journeyId: J, level: "a1", topic: firstTopic }, orderBy: { slotIndex: "asc" }, select: { slug: true, title: true, topic: true, slotIndex: true } });
  console.log(`\n1ra A1 = [${s?.topic} slot${s?.slotIndex}] ${s?.slug} «${s?.title}»`);
  await prisma.$disconnect();
})().catch(e => { console.log("FATAL", e.message); process.exit(1); });
