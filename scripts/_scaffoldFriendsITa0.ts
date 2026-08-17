import { config } from "dotenv"; config({ path: ".env.local", quiet: true }); config({ path: ".env", quiet: true });
import { PrismaClient } from "../src/generated/prisma";
// Journey A0 "Friends" (italian/italy): 7 ciudades icónicas x3. Narrador. Piso A0 real.
const TOPICS = ["roma", "firenze", "venezia", "milano", "napoli", "bologna", "palermo"];
(async () => {
  const p = new PrismaClient();
  let journey = await p.journey.findFirst({ where: { name: "Friends", language: "italian", variant: "italy" } });
  if (!journey) {
    journey = await p.journey.create({
      data: { name: "Friends", language: "italian", variant: "italy", levels: ["a0"], topics: TOPICS, storiesPerTopic: 3, status: "archived" },
    });
    console.log(`CREATED journey ${journey.id}`);
  } else console.log(`EXISTS journey ${journey.id}`);
  let created = 0, existed = 0;
  for (const topic of TOPICS) {
    for (let slot = 1; slot <= 3; slot++) {
      const dup = await p.journeyStory.findFirst({ where: { journeyId: journey.id, topic, slotIndex: slot }, select: { id: true } });
      if (dup) { existed++; continue; }
      await p.journeyStory.create({ data: { journeyId: journey.id, level: "a0", topic, slotIndex: slot, status: "draft" } });
      created++;
    }
  }
  console.log(`JOURNEY_ID=${journey.id} slots created=${created} existed=${existed}`);
  await p.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
