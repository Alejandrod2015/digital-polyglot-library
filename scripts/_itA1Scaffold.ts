/** Crea el Journey Traveler IT A1 (italy) y sus 21 huecos vacios. Sin contenido. */
import { config } from "dotenv";
config({ path: ".env" }); config({ path: ".env.local" });
import { PrismaClient } from "../src/generated/prisma";
const prisma = new PrismaClient();
const TOPICS = ["roads-and-driving","phones-and-signal","rooms-and-keys","forest-and-hiking","village-festivals","pharmacy-emergencies","bureaucracy-and-paperwork"];
async function run(){
  let j = await prisma.journey.findFirst({ where: { language: "italian", variant: "italy", typeSlug: "traveler", levels: { has: "a1" } } });
  if (!j) {
    j = await prisma.journey.create({ data: {
      name: "Traveler", language: "italian", variant: "italy", typeSlug: "traveler",
      levels: ["a1"], topics: TOPICS, storiesPerTopic: 3, status: "draft", createdBy: "claude",
    }});
    console.log(`journey creado: ${j.id}`);
  } else {
    await prisma.journey.update({ where: { id: j.id }, data: { topics: TOPICS, storiesPerTopic: 3 } });
    console.log(`journey ya existia: ${j.id}`);
  }
  for (const t of TOPICS) for (const i of [1,2,3]) {
    const ya = await prisma.journeyStory.findFirst({ where: { journeyId: j.id, topic: t, slotIndex: i } });
    if (ya) continue;
    await prisma.journeyStory.create({ data: { journeyId: j.id, level: "a1", topic: t, slotIndex: i, status: "draft" } });
  }
  console.log(`huecos: ${await prisma.journeyStory.count({ where: { journeyId: j.id } })}`);
  await prisma.$disconnect();
}
run();
