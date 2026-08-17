import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
// Journey ES C1 "Friends" (colombia): 7 ciudades colombianas, cada tema su color regional.
// Crea el journey (archived) si no existe y los 21 slots draft vacíos (sin text/vocab).
const TOPICS = ["bogota", "medellin", "cali", "barranquilla", "cartagena", "bucaramanga", "villavicencio"];
(async () => {
  const p = new PrismaClient();
  let journey = await p.journey.findFirst({ where: { name: "Friends", language: "spanish", variant: "colombia" } });
  if (!journey) {
    journey = await p.journey.create({
      data: { name: "Friends", language: "spanish", variant: "colombia", levels: ["c1"], topics: TOPICS, storiesPerTopic: 3, status: "archived" },
    });
    console.log(`CREATED journey ${journey.id}`);
  } else {
    console.log(`EXISTS journey ${journey.id}`);
  }
  let created = 0, existed = 0;
  for (const topic of TOPICS) {
    for (let slot = 1; slot <= 3; slot++) {
      const dup = await p.journeyStory.findFirst({ where: { journeyId: journey.id, topic, slotIndex: slot }, select: { id: true } });
      if (dup) { existed++; continue; }
      await p.journeyStory.create({ data: { journeyId: journey.id, level: "c1", topic, slotIndex: slot, status: "draft" } });
      created++;
    }
  }
  console.log(`JOURNEY_ID=${journey.id} slots created=${created} existed=${existed}`);
  await p.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
